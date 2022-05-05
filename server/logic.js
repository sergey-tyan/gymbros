import 'dotenv/config';
import Web3 from 'web3';
import cors from 'cors';
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

export function setup(app) {
  app.get('/claim-discount', cors(corsOptions), async (req, res) => {
    //check if address contains certain NFTs
    const { address, shop } = req.query;
    const count = await getNFTCount(address);

    // TODO:
    // const token = await redisStore.get(shop);
    // const client = axios.create({
    //   baseURL: `https://${shop}/admin/api/2022-04`,
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-Shopify-Access-Token': token,
    //   },
    // });
    // generate a 50% discount code
    // need to get customer ID
    // first order will save the customer ID, next discounts will be bound only to that customer
    res.send({ address, NFT_count: count });
  });

  app.get('/claim-items', async (req, res) => {
    console.log('bababa');
    //check if address contains certain NFTs
    const { address } = req.query;
    const count = await getNFTCount(address);
    res.send({ address, count });
  });
}
