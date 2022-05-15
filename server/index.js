// @ts-check
import { resolve } from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Shopify, ApiVersion } from '@shopify/shopify-api';
import 'dotenv/config';

import RedisStore from './helpers/session-store.js';
import applyAuthMiddleware from './middleware/auth.js';
import verifyRequest from './middleware/verify-request.js';
import { setup } from './logic.js';

const USE_ONLINE_TOKENS = true;
const TOP_LEVEL_OAUTH_COOKIE = 'shopify_top_level_oauth';

const PORT = parseInt(process.env.PORT || '8081', 10);
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD;

const SCOPES =
  'read_products,read_customers,read_discounts,write_discounts,write_script_tags,read_themes,write_themes,write_price_rules,read_orders';
const sessionStorage = new RedisStore();
Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: SCOPES.split(','),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ''),
  API_VERSION: ApiVersion.April22,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(
    sessionStorage.storeCallback.bind(sessionStorage),
    sessionStorage.loadCallback.bind(sessionStorage),
    sessionStorage.deleteCallback.bind(sessionStorage),
  ),
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};
Shopify.Webhooks.Registry.addHandler('APP_UNINSTALLED', {
  path: '/webhooks',
  webhookHandler: async (topic, shop, body) => {
    console.log('APP_UNINSTALLED');
    delete ACTIVE_SHOPIFY_SHOPS[shop];
  },
});

// export for test use only
export async function createServer(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === 'production',
) {
  const app = express();
  setup(app);
  app.set('top-level-oauth-cookie', TOP_LEVEL_OAUTH_COOKIE);
  app.set('active-shopify-shops', ACTIVE_SHOPIFY_SHOPS);
  app.set('use-online-tokens', USE_ONLINE_TOKENS);
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));
  app.use(express.json());

  applyAuthMiddleware(app, sessionStorage);

  app.post('/webhooks', async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
      if (!res.headersSent) {
        res.status(500).send(error.message);
      }
    }
  });

  app.post('/webhooks/orders-paid', async (req, res) => {
    try {
      const { customer, line_items, discount_codes } = req.body;
      // const keys = Object.keys(req.body);
      const { id: customerId } = customer;
      console.log({
        customerId,
        line_item: line_items[0],
        discount_codes,
      });

      const account = await sessionStorage.getAddressByCustomer(customerId);
      const season = process.env.CLAIM_SEASON || 1;

      sessionStorage.markAddressWhoClaimed(account, season);

      res.sendStatus(200);
    } catch (error) {
      console.log(`Failed to process webhook in orders-paid: ${error}`);
      if (!res.headersSent) {
        res.status(500).send(error.message);
      }
    }
  });

  app.use((req, res, next) => {
    const shop = req.query.shop;
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader(
        'Content-Security-Policy',
        `frame-ancestors https://${shop} https://admin.shopify.com;`,
      );
    } else {
      res.setHeader('Content-Security-Policy', `frame-ancestors 'none';`);
    }
    next();
  });
  app.use(
    '/wallet-connect-script.min.js',
    express.static(resolve(root, 'dist/wallet-connect-script.min.js')),
  );
  app.use('/*', (req, res, next) => {
    const { shop } = req.query;
    // Detect whether we need to reinstall the app, any request from Shopify will
    // include a shop in the query parameters.
    if (app.get('active-shopify-shops')[shop] === undefined && shop) {
      res.redirect(`/auth?${new URLSearchParams(req.query).toString()}`);
    } else {
      next();
    }
  });

  /**
   * @type {import('vite').ViteDevServer}
   */
  let vite;
  if (!isProd) {
    vite = await import('vite').then(({ createServer }) =>
      createServer({
        root,
        logLevel: isTest ? 'error' : 'info',
        server: {
          port: PORT,
          hmr: {
            protocol: 'ws',
            host: 'localhost',
            port: 64999,
            clientPort: 64999,
          },
          middlewareMode: 'html',
        },
      }),
    );
    app.use(vite.middlewares);
  } else {
    const compression = await import('compression').then(
      ({ default: fn }) => fn,
    );
    const serveStatic = await import('serve-static').then(
      ({ default: fn }) => fn,
    );
    const fs = await import('fs');
    app.use(compression());
    app.use(serveStatic(resolve('dist/client')));
    app.use('/*', (req, res, next) => {
      // Client-side routing will pick up on the correct route to render, so we always render the index here
      res
        .status(200)
        .set('Content-Type', 'text/html')
        .send(fs.readFileSync(`${process.cwd()}/dist/client/index.html`));
    });
  }

  return { app, vite };
}

if (!isTest) {
  createServer().then(({ app }) => {
    console.log('starting server on ' + PORT);
    app.listen(PORT);
  });
}
