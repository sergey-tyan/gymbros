# Shopify App For Gymbros

## Config variables

- `CLAIM_SEASON` - (default is 1) current claim season, should be incremented every time new season starts
- `S_1_TIER_1_PRODUCT_ID` - product id for the corresponding season and tier
- `S_1_TIER_2_PRODUCT_ID` - product id for the corresponding season and tier
- `S_1_TIER_3_PRODUCT_ID` - product id for the corresponding season and tier
- `S_1_TIER_4_PRODUCT_ID` - product id for the corresponding season and tier
- `NFT_ADDRESS` - address of the NFT contract
- `INFURA_ID` - infura ID is needed for server to connect to the blockchain
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `HOST` - app server host
- `PORT` - 3000
- `REDIS_URL` - redis url that stores all the data
- `NODE_ENV` - `dev` or `production`

## 50% site-wide discount for NFT holders

Each time user presses "Claim discount" button, the server checks if the user currently holds any NFT-s, and if so, it will create a one-time 50% discount bound to that user. This is done to prevent users from sharing the discount codes with other users. After purchasing user will be able to claim another 50% discount.

## One-off free items.

This is a bit complicated, but it works like this:

- Current season and product id-s for each season and tier are stored in the config variables
- Whenever user claims a free item according to user's tier, server creates a one-time discount code from user's address and season number using a hash function:

```js
function createHash({ account, season }) {
  const input = `${account}_${season}`;
  return crypto.createHash('md5').update(input).digest('hex');
}
```

- Since each discount code on Shopify has to be unique, this ensures that user can only claim once during the season.
- Discount amount is the price of the product
- The webhook that is triggered when user purchases the item marks the wallet that has claimed.

## Front-end buttons

You can use existing or create 2 buttons with following id-s:

- `claim-50-discount-button` - for 50% discount claiming button
- `claim-items-button` - for claiming free items button
- Clicking on each button connects to the metamask and sends a request to the server that fetches discount
