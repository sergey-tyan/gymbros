import "dotenv/config";
import Web3 from "web3";
import cors from "cors";
import crypto from "crypto";
import axios from "axios";
import RedisStore from "./helpers/session-store.js";

const redisStore = new RedisStore();
const IS_PRODUCTION = process.env.PROD === "true";
const { INFURA_ID, NFT_ADDRESS, SHOP_URL } = process.env;

const corsOptions = {
  origin: SHOP_URL,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

function createApiClient(shop, token) {
  return axios.create({
    baseURL: `https://${shop}/admin/api/2022-04`,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
  });
}

async function getNFTCount(address) {
  const abiModule = await import(`./abi/${IS_PRODUCTION ? "prod" : "dev"}.js`);
  const ABI = abiModule.default;
  const RPC = `${
    IS_PRODUCTION
      ? "https://mainnet.infura.io/v3/"
      : "https://rinkeby.infura.io/v3/"
  }${INFURA_ID}`;
  const web3 = new Web3(RPC);
  const contract = new web3.eth.Contract(ABI, NFT_ADDRESS);
  try {
    const res = await contract.methods.balanceOf(address).call();
    console.log({ res });
    return parseInt(res);
  } catch (e) {
    console.log(e);
    return 0;
  }
}

async function createOneTime50percentDiscount({ shop, customerId }) {
  const token = await redisStore.getAccessToken(shop);
  if (!token) {
    throw new Error("No token saved");
  }
  const discountCode = crypto.randomBytes(4).toString("hex");
  const apiClient = createApiClient(shop, token);
  try {
    const priceRuleData = {
      price_rule: {
        title: discountCode,
        allocation_method: "across",
        target_type: "line_item",
        target_selection: "all",
        value_type: "percentage",
        value: "-50",
        customer_selection: "prerequisite",
        prerequisite_customer_ids: [customerId],
        starts_at: new Date().toISOString(),
        usage_limit: 1,
      },
    };

    const priceRuleRaw = await apiClient.post(
      "/price_rules.json",
      priceRuleData
    );
    const priceRule = priceRuleRaw.data.price_rule;

    await apiClient.post(`/price_rules/${priceRule.id}/discount_codes.json`, {
      discount_code: {
        code: discountCode,
      },
    });
    return discountCode;
  } catch (e) {
    console.log("createOneTime50percentDiscount errors");
    console.log(e.response?.data?.errors);
    return null;
  }
}

export function createHash({ account, season }) {
  const input = `${account}_${season}`;
  return crypto.createHash("md5").update(input).digest("hex").toLowerCase();
}

async function createOneTimeProductDiscount({
  apiClient,
  productId,
  customerId,
  code,
  price,
}) {
  try {
    const priceRuleData = {
      price_rule: {
        title: code,
        allocation_method: "across",
        target_type: "line_item",
        target_selection: "entitled",
        entitled_product_ids: [productId],
        value_type: "fixed_amount",
        value: `-${price}`,
        customer_selection: "prerequisite",
        prerequisite_customer_ids: [customerId],
        starts_at: new Date().toISOString(),
        usage_limit: 1,
      },
    };

    const priceRuleRaw = await apiClient.post(
      "/price_rules.json",
      priceRuleData
    );
    const priceRule = priceRuleRaw.data.price_rule;

    const discountCodeRaw = await apiClient.post(
      `/price_rules/${priceRule.id}/discount_codes.json`,
      {
        discount_code: { code },
      }
    );
    return discountCodeRaw.data.discount_code;
  } catch (e) {
    console.log("createOneTimeProductDiscount errors");
    console.log("Error creating discount code", e.message);
    console.log(e.response?.data?.errors);
    return null;
  }
}

export function setup(app) {
  app.get("/claim-discount", cors(corsOptions), async (req, res) => {
    const { account, shop, customerId } = req.query;
    const count = await getNFTCount(account);
    if (count === 0) {
      return res.send({
        error: "Account doesn't have any Gymbros NFT-s",
      });
    }

    const discountCode = await createOneTime50percentDiscount({
      shop,
      customerId,
    });

    if (!discountCode) {
      return res.send({
        error: "Cant generate discount code, check server logs",
      });
    }

    res.send({ discountCode });
  });

  app.get("/claim-items", cors(corsOptions), async (req, res) => {
    const { account, shop, customerId } = req.query;
    if (!customerId) {
      return res.send({ error: `User is not logged in` });
    }
    await redisStore.mapCustomerToAddress(customerId, account);
    const count = await getNFTCount(account);

    if (count === 0) {
      return res.send({ error: `No NFTs found for ${account}` });
    }
    const tier = count >= 20 ? 4 : count >= 10 ? 3 : count >= 5 ? 2 : 1;
    console.log({ NFTCount: count, tier });

    const season = process.env.CLAIM_SEASON || 1;
    const alreadyClaimed = await redisStore.didAddressClaim(account, season);
    if (alreadyClaimed) {
      return res.send({
        error: `Address ${account} has already claimed in Season ${season}`,
      });
    }

    const productId = process.env[`S_${season}_TIER_${tier}_PRODUCT_ID`];
    if (productId == null) {
      return res.send({ error: `No product found for tier ${tier}` });
    }

    const token = await redisStore.getAccessToken(shop);
    console.log({ token });

    const apiClient = createApiClient(shop, token);
    // Checking if product is active in Shopify Admin panel
    const productRaw = await apiClient.get(`/products/${productId}.json`);
    const { status, variants } = productRaw.data.product;
    const { id: variantId, price } = variants[0];

    if (status !== "active") {
      return res.send({ error: "Claiming is not possible at the moment" });
    }

    const codeFromHash = createHash({ account, season });
    createOneTimeProductDiscount({
      apiClient,
      productId,
      customerId,
      price,
      code: codeFromHash,
    }).then(() => res.send({ discountCode: codeFromHash, variantId }));
  });
}
