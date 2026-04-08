/**
 * JS SDK v6 — iFrame content page
 *
 * Runs inside an iframe embedded in the merchant/host page.
 * Communicates with the parent via postMessage using standardised event types.
 *
 * postMessage events sent to parent:
 *   { type: 'payment-flow-start' }
 *   { type: 'payment-flow-approved', orderId }
 *   { type: 'payment-flow-canceled' }
 *   { type: 'payment-flow-error', message }
 *   { type: 'presentationMode-changed', mode }
 *   { type: 'iframe-ready' }
 */

const sdkLoadingEl = document.getElementById('sdk-loading');
const PARENT_ORIGIN = window.location.origin;

function postToParent(payload) {
  if (window.parent !== window) {
    window.parent.postMessage(payload, PARENT_ORIGIN);
  }
}

function hideSdkLoading() {
  sdkLoadingEl.style.display = 'none';
}

// ── Server API calls ──────────────────────────────────────────────────────────

async function createOrder() {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentSource: 'paypal',
      totalAmount: '50.00',
      currency: 'USD',
      items: [{ name: 'Wooden Bowl', quantity: 1, unitAmount: '50.00' }],
    }),
  });

  if (!response.ok) throw new Error(`Order creation failed: ${response.status}`);

  const order = await response.json();
  console.log('[v6-iframe] Order created:', order.id);
  return { orderId: order.id };
}

async function captureOrder(orderId) {
  const response = await fetch(`/api/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) throw new Error(`Capture failed: ${response.status}`);
  return response.json();
}

// ── Payment session options ───────────────────────────────────────────────────

function buildPaymentSessionOptions() {
  return {
    async createOrder() {
      postToParent({ type: 'payment-flow-start' });
      return createOrder();
    },

    async onApprove({ orderId }) {
      try {
        const captureData = await captureOrder(orderId);
        console.log('[v6-iframe] Capture response:', captureData);
        postToParent({ type: 'payment-flow-approved', orderId, captureData });
      } catch (err) {
        console.error('[v6-iframe] Capture error:', err);
        postToParent({ type: 'payment-flow-error', message: err.message });
      }
    },

    onCancel() {
      postToParent({ type: 'payment-flow-canceled' });
    },

    onError(error) {
      console.error('[v6-iframe] Payment error:', error);
      postToParent({ type: 'payment-flow-error', message: error.message || 'Unknown error' });
    },
  };
}

// ── Main initialisation ───────────────────────────────────────────────────────

async function init() {
  if (!window.paypal) {
    postToParent({ type: 'payment-flow-error', message: 'PayPal JS SDK v6 failed to load.' });
    hideSdkLoading();
    return;
  }

  try {
    const sdkInstance = await window.paypal.createInstance({
      clientId: CLIENT_ID,
      components: ['paypal-payments', 'venmo-payments'],
      pageType: 'checkout',
      locale: 'en-US',
      clientMetadataId: crypto.randomUUID(),
    });
    console.log('[v6-iframe] SDK instance created');

    const eligibleMethods = await sdkInstance.findEligibleMethods({ currency: 'USD' });
    console.log('[v6-iframe] Eligible methods:', eligibleMethods);

    hideSdkLoading();

    const sessionOptions = buildPaymentSessionOptions();

    // ── PayPal button ──
    if (eligibleMethods.isEligible('paypal')) {
      const paypalSession = sdkInstance.createPayPalOneTimePaymentSession(sessionOptions);
      const paypalButton = document.getElementById('paypal-button');
      paypalButton.removeAttribute('hidden');

      paypalButton.addEventListener('click', async () => {
        try {
          postToParent({ type: 'presentationMode-changed', mode: 'auto' });
          await paypalSession.start({ presentationMode: 'auto' }, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) {
            postToParent({ type: 'payment-flow-error', message: err.message });
          }
        }
      });
    }

    // ── Pay Later button ──
    if (eligibleMethods.isEligible('paylater')) {
      const details = eligibleMethods.getDetails('paylater');
      const payLaterSession = sdkInstance.createPayLaterOneTimePaymentSession(sessionOptions);
      const payLaterButton = document.getElementById('pay-later-button');
      payLaterButton.productCode = details.productCode;
      payLaterButton.countryCode = details.countryCode;
      payLaterButton.removeAttribute('hidden');

      payLaterButton.addEventListener('click', async () => {
        try {
          postToParent({ type: 'presentationMode-changed', mode: 'auto' });
          await payLaterSession.start({ presentationMode: 'auto' }, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) {
            postToParent({ type: 'payment-flow-error', message: err.message });
          }
        }
      });
    }

    // ── Venmo button ──
    if (eligibleMethods.isEligible('venmo')) {
      const venmoSession = sdkInstance.createVenmoOneTimePaymentSession(sessionOptions);
      const venmoButton = document.getElementById('venmo-button');
      venmoButton.removeAttribute('hidden');

      venmoButton.addEventListener('click', async () => {
        try {
          postToParent({ type: 'presentationMode-changed', mode: 'auto' });
          await venmoSession.start({ presentationMode: 'auto' }, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) {
            postToParent({ type: 'payment-flow-error', message: err.message });
          }
        }
      });
    }

    postToParent({ type: 'iframe-ready' });

  } catch (err) {
    console.error('[v6-iframe] Init error:', err);
    hideSdkLoading();
    postToParent({ type: 'payment-flow-error', message: err.message });
  }
}

init();
