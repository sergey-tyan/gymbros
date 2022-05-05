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
  console.log('Connecting and fetching discount');
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
  if (!discount) {
    return alert('no NFTs found');
  }
  window.location.href = `/discount/${discount}`; // this will apply the discount
}

async function getDiscountCodeForAccount(account) {
  const apiUrl = HOST + '/claim-discount';

  const customerId = window.__st.cid;
  if (!customerId) {
    alert('User is not logged in');
  }

  const params = {
    customerId,
    account,
    shop: Shopify.shop,
  };
  const paramsString = new URLSearchParams(params).toString();

  const res = await fetch(`${apiUrl}?${paramsString}`);
  const data = await res.json();

  return data.discountCode;
}

// const button = document.querySelector('.header-wrapper');
const button = document.querySelector('#crypto-wallet-button');
if (button !== null) {
  button.addEventListener('click', connectWallet);
}

init();
