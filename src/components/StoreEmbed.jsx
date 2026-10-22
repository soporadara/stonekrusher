import { useEffect, useMemo, useState } from 'react';

const ECWID_SCRIPT_SRC = 'https://app.ecwid.com/script.js?80100025&data_platform=code&data_date=2026-02-23';
const ECWID_SCRIPT_ID = 'konstructz-ecwid-script';
const STORE_ID = 'my-store-80100025';
const STORE_OPTIONS = [
  'categoriesPerRow=3',
  'views=grid(20,3) list(60) table(60)',
  'categoryView=grid',
  'searchView=list',
  `id=${STORE_ID}`
];

let ecwidScriptPromise;

const waitFor = (condition, timeout = 8000) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  const check = () => {
    if (condition()) {
      resolve();
    } else if (Date.now() - startedAt >= timeout) {
      reject(new Error('Store API timed out'));
    } else {
      window.setTimeout(check, 50);
    }
  };
  check();
});

// Shared with the cart page so the checkout script starts loading before checkout.
// eslint-disable-next-line react-refresh/only-export-components
export const preloadStore = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (typeof window.xProductBrowser === 'function') return Promise.resolve();
  if (ecwidScriptPromise) return ecwidScriptPromise;

  ecwidScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(ECWID_SCRIPT_ID);
    const onLoad = () => waitFor(() => typeof window.xProductBrowser === 'function')
      .then(resolve)
      .catch(reject);

    if (existingScript) {
      existingScript.addEventListener('load', onLoad, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      onLoad();
      return;
    }

    const script = document.createElement('script');
    script.id = ECWID_SCRIPT_ID;
    script.dataset.cfasync = 'false';
    script.type = 'text/javascript';
    script.src = ECWID_SCRIPT_SRC;
    script.charset = 'utf-8';
    script.async = true;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.body.appendChild(script);
  }).catch(error => {
    ecwidScriptPromise = undefined;
    throw error;
  });

  return ecwidScriptPromise;
};

const getEcwidProductId = (item) => {
  if (Number(item?.ecwidProductId)) return Number(item.ecwidProductId);
  const storeUrl = item?.checkoutUrl || item?.externalUrl || item?.hash || '';
  const match = storeUrl.match(/(?:-p|\/p\/)(\d+)/);
  return match ? Number(match[1]) : null;
};

const clearStoreCart = () => new Promise(resolve => {
  let finished = false;
  const finish = (success = false, error) => {
    if (finished) return;
    finished = true;
    if (!success && error) console.error('Ecwid could not clear the cart', error);
    resolve(Boolean(success));
  };

  try {
    window.Ecwid.Cart.clear(finish);
    window.setTimeout(() => finish(false), 3000);
  } catch (error) {
    console.error('Could not clear the Ecwid cart', error);
    finish(false);
  }
});

const addStoreProduct = (item) => new Promise(resolve => {
  let finished = false;
  const finish = (success = true, product, cart, error) => {
    if (finished) return;
    finished = true;
    if (!success) console.error('Ecwid could not add a cart item', error || item);
    resolve(Boolean(success));
  };

  try {
    window.Ecwid.Cart.addProduct({ ...item, callback: finish });
    window.setTimeout(() => finish(false), 5000);
  } catch (error) {
    console.error('Could not add product to the Ecwid cart', error);
    finish(false);
  }
});

const getStoreCart = () => new Promise(resolve => {
  try {
    window.Ecwid.Cart.get(cart => resolve(cart || { items: [] }));
  } catch (error) {
    console.error('Could not verify the Ecwid cart', error);
    resolve({ items: [] });
  }
});

const ensureStoreCartIsEmpty = async () => {
  let cleared = await clearStoreCart();
  let cart = await getStoreCart();

  if (!cleared || (cart.items || []).length > 0) {
    cleared = await clearStoreCart();
    cart = await getStoreCart();
  }

  return cleared && (cart.items || []).length === 0;
};

// Used by checkout cancellation buttons to prevent old items carrying over.
// eslint-disable-next-line react-refresh/only-export-components
export const clearStoreCheckout = async () => {
  await preloadStore();
  await waitFor(() => window.Ecwid?.Cart);
  return ensureStoreCartIsEmpty();
};

export default function StoreEmbed({ cartItems = [], browseOnly = false, browseProduct = null }) {
  const [status, setStatus] = useState('Loading secure checkout...');

  const checkoutItems = useMemo(() => {
    const itemsById = new Map();

    cartItems.forEach(item => {
      const id = getEcwidProductId(item);
      if (!id) return;
      itemsById.set(id, {
        id,
        quantity: (itemsById.get(id)?.quantity || 0) + Math.max(1, Number(item.quantity) || 1)
      });
    });

    return Array.from(itemsById.values());
  }, [cartItems]);

  const checkoutSignature = checkoutItems
    .map(item => `${item.id}:${item.quantity}`)
    .sort()
    .join('|');
  const browseProductId = getEcwidProductId(browseProduct);

  useEffect(() => {
    let cancelled = false;
    let cleanUrlHandler = null;
    let productOpenTimer = null;
    let productOpenRequested = false;

    const initializeCheckout = async () => {
      try {
        setStatus('Loading secure checkout...');
        await preloadStore();
        if (cancelled) return;

        const container = document.getElementById(STORE_ID);
        if (!container) return;

        if (browseOnly && browseProductId && window.Ecwid?.OnPageLoaded) {
          const cleanStoreUrl = `/store/${encodeURIComponent(browseProduct?.slug || browseProduct?.id || browseProductId)}/`;
          const openRequestedProduct = () => {
            if (cancelled || productOpenRequested || !window.Ecwid?.openPage) return;
            productOpenRequested = true;
            window.Ecwid.openPage('product', { id: browseProductId });
          };

          cleanUrlHandler = (page) => {
            if (cancelled) return;

            const pageType = String(page?.type || '').toUpperCase();
            const loadedProductId = Number(page?.productId || page?.product?.id || page?.id);
            if (pageType === 'PRODUCT' && (!loadedProductId || loadedProductId === browseProductId)) {
              window.history.replaceState({}, '', cleanStoreUrl);
              setStatus('');
              return;
            }

            // Ecwid must finish its initial catalog load before product navigation.
            openRequestedProduct();
          };
          window.Ecwid.OnPageLoaded.add(cleanUrlHandler);

          // Fallback in case the initial page event is delayed or not emitted.
          productOpenTimer = window.setTimeout(openRequestedProduct, 1500);
        }

        container.innerHTML = '';
        window.xProductBrowser(...STORE_OPTIONS);

        if (browseOnly) {
          if (!browseProductId) setStatus('');
          return;
        }

        setStatus('Preparing your cart...');

        await waitFor(() => window.Ecwid?.Cart && window.Ecwid?.openPage);
        if (cancelled) return;

        if (checkoutItems.length === 0) {
          throw new Error('This product is not linked to an Ecwid store ID');
        }

        const cartWasCleared = await ensureStoreCartIsEmpty();
        if (!cartWasCleared) {
          throw new Error('The previous store cart could not be cleared');
        }
        for (const item of checkoutItems) {
          if (cancelled) return;
          await addStoreProduct(item);
        }

        // Confirm every requested product and quantity before opening checkout.
        const synchronizedCart = await getStoreCart();
        const synchronizedQuantities = new Map(
          (synchronizedCart.items || []).map(item => [Number(item.product?.id), Number(item.quantity) || 0])
        );
        const missingItems = checkoutItems.filter(
          item => (synchronizedQuantities.get(item.id) || 0) < item.quantity
        );

        for (const item of missingItems) {
          if (cancelled) return;
          const missingQuantity = item.quantity - (synchronizedQuantities.get(item.id) || 0);
          await addStoreProduct({ ...item, quantity: missingQuantity });
        }

        if (!cancelled) {
          window.Ecwid.openPage('cart');
          setStatus('');
        }
      } catch (error) {
        console.error('Could not load checkout', error);
        if (!cancelled) {
          setStatus('Checkout could not load. Please retry or open the product in the store.');
        }
      }
    };

    initializeCheckout();

    return () => {
      cancelled = true;
      if (productOpenTimer) window.clearTimeout(productOpenTimer);
      if (cleanUrlHandler && window.Ecwid?.OnPageLoaded?.remove) {
        window.Ecwid.OnPageLoaded.remove(cleanUrlHandler);
      }
    };
    // The signature prevents reinitializing when React receives an equivalent array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutSignature, browseOnly, browseProductId]);

  return (
    <div className="store-embed-wrap" aria-busy={Boolean(status)}>
      {status && <p className="store-loading-message">{status}</p>}
      <div id={STORE_ID}></div>
    </div>
  );
}
