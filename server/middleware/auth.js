import { Shopify } from '@shopify/shopify-api';
import { ScriptTag } from '@shopify/shopify-api/dist/rest-resources/2022-04/index.js';
import axios from 'axios';
const APP_HOST = process.env.HOST;
import topLevelAuthRedirect from '../helpers/top-level-auth-redirect.js';

async function createShopifySection(client) {
  const content = `
    {% if customer %}
    <button 
    id="crypto-wallet-button" 
      id="crypto-wallet-button" 
    id="crypto-wallet-button" 
      id="crypto-wallet-button" 
    id="crypto-wallet-button" 
    style="
      background-color: {{section.settings.button_color}};
      color: {{section.settings.button_text_color}};
      border-radius: 5px;
      padding: 10px;
      width: 100px;
      border: none;
      cursor: pointer;
      "
    >
      Claim Discount
    </button>

    <button 
      id="claim-items-button" 
      style="
        margin-left: 10px;
        cursor: pointer;
        background-color: {{section.settings.button_color}};
        color: {{section.settings.button_text_color}};
        border-radius: 5px;
        padding: 10px;
        width: 100px;
        border: none;"
      >
        Claim Items
    </button>
    {% endif %}

    {% schema %}
    {
      "name": "Connect Wallet",
      "settings":[
        {
          "type": "text",
          "id": "button_label",
          "label": "Button Label",
          "default": "Connect with a Wallet"
        },
        {
          "type": "color",
          "id": "button_color",
          "label": "Button Color",
          "default": "#000000"
        },
        {
          "type": "color",
          "id": "button_text_color",
          "label": "Button Text Color",
          "default": "#FFFFFF"
        }
      ],
      "presets":[
        {
          "name": "Connect Wallet Button",
          "category": "Crypto"
        }
      ]
    }
    {% endschema %}
  `;

  const themesRaw = await client.get('/themes.json');
  const themes = themesRaw.data.themes;
  const mainTheme = themes.find((theme) => theme.role === 'main');
  const key = `sections/wallet-button.liquid`;

  try {
    const newAssetResult = await client.put(
      `/themes/${mainTheme.id}/assets.json`,
      {
        asset: { key, value: content },
      },
    );
  } catch (e) {
    console.log('error');
    // console.log(e.message);
    console.log(e);
    // console.log(e.request);
    console.log(e.response.data.errors);
  }
}

export default function applyAuthMiddleware(app, sessionStorage) {
  app.get('/auth', async (req, res) => {
    if (!req.signedCookies[app.get('top-level-oauth-cookie')]) {
      return res.redirect(
        `/auth/toplevel?${new URLSearchParams(req.query).toString()}`,
      );
    }

    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      req.query.shop,
      '/auth/callback',
      false,
    );

    res.redirect(redirectUrl);
  });

  app.get('/auth/toplevel', (req, res) => {
    res.cookie(app.get('top-level-oauth-cookie'), '1', {
      signed: true,
      httpOnly: true,
      sameSite: 'strict',
    });

    res.set('Content-Type', 'text/html');

    res.send(
      topLevelAuthRedirect({
        apiKey: Shopify.Context.API_KEY,
        hostName: Shopify.Context.HOST_NAME,
        host: req.query.host,
        query: req.query,
      }),
    );
  });

  app.get('/auth/callback', async (req, res) => {
    try {
      const session = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query,
      );
      console.log({ session });
      if (!session.isOnline) {
        sessionStorage.saveAccessToken(session.shop, session.accessToken);
        const redirectUrl = await Shopify.Auth.beginAuth(
          req,
          res,
          req.query.shop,
          '/auth/callback',
          true,
        );

        return res.redirect(redirectUrl);
      }

      const host = req.query.host;
      app.set(
        'active-shopify-shops',
        Object.assign(app.get('active-shopify-shops'), {
          [session.shop]: session.scope,
        }),
      );

      const response = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: 'APP_UNINSTALLED',
        path: '/webhooks',
      });

      const client = axios.create({
        baseURL: `https://${session.shop}/admin/api/2022-04`,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': session.accessToken,
        },
      });

      await client.post('/webhooks.json', {
        webhook: {
          topic: 'orders/paid',
          address: `${APP_HOST}/webhooks/orders-paid`,
          format: 'json',
        },
      });

      if (!response['APP_UNINSTALLED'].success) {
        console.log(
          `Failed to register APP_UNINSTALLED webhook: ${response.result}`,
        );
      }
      const src = `${APP_HOST}/wallet-connect-script.min.js`;
      const existingTag = await ScriptTag.find({
        session,
        fields: ['src', src],
      });
      if (!existingTag) {
        const newTag = new ScriptTag({ session });
        newTag.event = 'onload';
        newTag.src = src;
        await newTag.save({});
      }

      createShopifySection(client);

      // Redirect to app with shop parameter upon auth
      res.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (e) {
      console.log('error');
      console.log(e.message);
      console.log(e.response?.data?.errors);
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400);
          res.send(e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          res.redirect(`/auth?shop=${req.query.shop}`);
          break;
        default:
          res.status(500);
          res.send(e.message);
          break;
      }
    }
  });
}
