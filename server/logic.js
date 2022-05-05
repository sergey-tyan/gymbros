import 'dotenv/config';
import Web3 from 'web3';
import cors from 'cors';
import crypto from 'crypto';
import axios from 'axios';
import RedisStore from './helpers/session-store.js';

const redisStore = new RedisStore();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const { INFURA_ID, NFT_ADDRESS } = process.env;

const corsOptions = {
  origin: 'https://sergey-metamask-test.myshopify.com',
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

async function getNFTCount(address) {
  const abiModule = await import(`./abi/${IS_PRODUCTION ? 'prod' : 'dev'}.js`);
  const ABI = abiModule.default;
  const RPC = `${
    IS_PRODUCTION
      ? 'https://mainnet.infura.io/v3/'
      : 'https://rinkeby.infura.io/v3/'
  }${INFURA_ID}`;
  const web3 = new Web3(RPC);
  const contract = new web3.eth.Contract(ABI, NFT_ADDRESS);
  try {
    const res = await contract.methods.balanceOf(address).call();
    console.log({ res });
    return parseInt(res);
  } catch (e) {
    console.log(e.reason);
    return 0;
  }
}

async function createOneTime50percentDiscount({ shop, customerId }) {
  const token = await redisStore.getAccessToken(shop);
  if (!token) {
    throw new Error('No token saved');
  }
  const discountCode = crypto.randomBytes(4).toString('hex');
  const client = axios.create({
    baseURL: `https://${shop}/admin/api/2022-04`,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
  });
  try {
    const priceRuleData = {
      price_rule: {
        title: discountCode,
        allocation_method: 'across',
        target_type: 'line_item',
        target_selection: 'all',
        value_type: 'percentage',
        value: '-50',
        customer_selection: 'prerequisite',
        prerequisite_customer_ids: [customerId],
        starts_at: new Date().toISOString(),
        usage_limit: 1,
      },
    };

    const priceRuleRaw = await client.post('/price_rules.json', priceRuleData);
    const priceRule = priceRuleRaw.data.price_rule;

    await client.post(`/price_rules/${priceRule.id}/discount_codes.json`, {
      discount_code: {
        code: discountCode,
      },
    });
    return discountCode;
  } catch (e) {
    console.log('errors');
    console.log(e.response?.data?.errors);
    return null;
  }
}

export function setup(app) {
  app.get('/claim-discount', cors(corsOptions), async (req, res) => {
    const { account, shop, customerId } = req.query;
    const count = await getNFTCount(account);
    if (count === 0) {
      return res.send(null);
    }

    const discountCode = await createOneTime50percentDiscount({
      shop,
      customerId,
    });
    res.send({ discountCode });
  });

  app.get('/claim-items', async (req, res) => {
    console.log('bababa');
    const { account } = req.query;
    const count = await getNFTCount(address);
    // Check which tier the user is in
    // Check if certain amount of products are available
    // Create a one-time discount for a product depending on a Tier
    res.send({ address, count });
  });
}
