const HOST = process.env.HOST;

function init() {
  if (!window.ethereum) {
    throw Error('Install Metamask');
  }

  ethereum.on('chainChanged', () => window.location.reload());
  ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length > 0) {
      console.log(`Using account ${accounts[0]}`);
      window.location.reload();
    } else {
      console.error('0 accounts.');
    }
  });

  ethereum.on('message', (message) => console.log({ message }));

  ethereum.on('connect', (info) => {
    console.log(`Connected to network`, info);
  });

  ethereum.on('disconnect', (error) => {
    console.log(`Disconnected from network`, error);
  });
}

async function connectWallet() {
  if (!window.ethereum) {
    throw Error('No ethereum provider found');
  }

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  const account = accounts[0];
  if (!account) {
    throw Error('No account found');
  }
  const discount = await getDiscountCodeForAccount(account);
  console.log({ discount });
}

async function getDiscountCodeForAccount(account) {
  const apiUrl = HOST + '/claim-discount';

  // const apiUrl = 'https://powrful.ngrok.io/claim-discount';
  console.log({ apiUrl });
  const res = await fetch(`${apiUrl}?address=${account}&shop=${Shopify.shop}`);
  const data = await res.json();
  alert(JSON.stringify(data));

  // TODO: check if account is eligible for discount on the backend
  // Generate one time unique discount code using https://shopify.dev/api/admin-rest/2021-07/resources/discountcode#[post]/admin/api/2021-07/price_rules/%7Bprice_rule_id%7D/discount_codes.json
  return 'pepe';
}

// const button = document.querySelector('.header-wrapper');
const button = document.querySelector('#crypto-wallet-button');
button.addEventListener('click', connectWallet);

init();
