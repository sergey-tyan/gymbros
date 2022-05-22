const HOST = process.env.HOST;

function init() {
  if (!window.ethereum) {
    throw Error('Install Metamask');
  }

  ethereum.on('chainChanged', (_chainId) => {
    console.log({ _chainId });
    if (_chainId !== '0x1') {
      alert('Please switch to the Ethereum mainnet');
    }
    window.location.reload();
  });
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

async function connectToMetamask() {
  console.log('Connecting and fetching discount');
  if (!window.ethereum) {
    throw Error('No ethereum provider found');
  }

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  const account = accounts[0];
  if (!account) {
    throw Error('No account found');
  }
  return account;
}

const DISCOUNT_TYPES = {
  FIFTY: '/claim-discount',
  ITEMS: '/claim-items',
};

async function addProductToCart(variantId) {
  if (!variantId) return;
  await fetch(window.Shopify.routes.root + 'cart/add.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
  });
}

function claimDiscount(type) {
  return async function () {
    //alert('claiming ' + type);
    const url = DISCOUNT_TYPES[type];
    const account = await connectToMetamask();
    const discountData = await getDiscountCodeForAccount(account, url);
    console.log({ discountData });
    if (!discountData.discountCode) {
      return alert('Cant claim discount');
    }
    await addProductToCart(discountData.variantId);
    if (type === 'ITEMS') {
      alert('Checkout to get your free items');
    }
    // this will apply the discount and redirect to cart
    window.location.href = `/discount/${discountData.discountCode}?redirect=/cart`;
  };
}

async function getDiscountCodeForAccount(account, url) {
  const apiUrl = HOST + url;

  const customerId = window.__st.cid;
  if (!customerId) {
    alert('Please login at the checkout first!');
  }

  const params = {
    customerId,
    account,
    shop: Shopify.shop,
  };
  const paramsString = new URLSearchParams(params).toString();

  const res = await fetch(`${apiUrl}?${paramsString}`);
  const data = await res.json();
  if (!data.discountCode) {
    alert(JSON.stringify(data.error));
  }
  return data;
}

// const button = document.querySelector('.header-wrapper');
const button = document.querySelector('#claim-50-discount-button');
if (button != null) {
  button.addEventListener('click', claimDiscount('FIFTY'));
}

const claimItemsButton = document.querySelector('#claim-items-button');
console.log({ claimItemsButton, button });
if (claimItemsButton != null) {
  claimItemsButton.addEventListener('click', claimDiscount('ITEMS'));
}

init();
