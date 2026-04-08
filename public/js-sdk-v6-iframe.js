/**
 * JS SDK v6 — iFrame Buttons (guest-only)
 *
 * Minimal button-only page for embedding in an iframe.
 * Same flow as the standard page but without page chrome.
 *
 * Flow:
 *   1. createInstance() with clientId
 *   2. findEligibleMethods() — only show buttons the buyer can use
 *   3. createPayPalOneTimePaymentSession() / createPayLaterOneTimePaymentSession() / createVenmoOneTimePaymentSession()
 *   4. Wire each button click → session.start()
 *   5. onApprove → POST /api/orders/:id/capture → show result
 */

const sdkLoadingEl = document.getElementById('sdk-loading');
const statusArea = document.getElementById('status-area');

// ── Helpers ──────────────────────────────────────────────────────────────────

function showStatus(message, type = 'info') {
  statusArea.textContent = message;
  statusArea.className = type;
  statusArea.style.display = 'block';
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
      items: [
        {
          name: 'Wooden Bowl',
          quantity: 1,
          unitAmount: '50.00',
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Order creation failed: ${response.status}`);
  }

  const order = await response.json();
  console.log('[v6-iframe] Order created:', order.id);

  return { orderId: order.id };
}

async function captureOrder(orderId) {
  const response = await fetch(`/api/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Capture failed: ${response.status}`);
  }

  return response.json();
}

// ── Payment session options ───────────────────────────────────────────────────

function buildPaymentSessionOptions() {
  return {
    async createOrder() {
      showStatus('Creating order…', 'info');
      return createOrder();
    },

    async onApprove({ orderId }) {
      showStatus('Payment approved — capturing…', 'info');
      try {
        const captureData = await captureOrder(orderId);
        console.log('[v6-iframe] Capture response:', captureData);
        showStatus('Payment captured successfully!', 'success');
        // Notify parent frame if embedded
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'PAYPAL_CAPTURE_COMPLETE', data: captureData }, '*');
        }
      } catch (err) {
        console.error('[v6-iframe] Capture error:', err);
        showStatus(`Capture failed: ${err.message}`, 'error');
      }
    },

    onCancel() {
      showStatus('Payment cancelled by buyer.', 'info');
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'PAYPAL_CANCELLED' }, '*');
      }
    },

    onError(error) {
      console.error('[v6-iframe] Payment error:', error);
      showStatus(`Payment error: ${error.message || 'Unknown error'}`, 'error');
    },
  };
}

// ── Main initialisation ───────────────────────────────────────────────────────

async function init() {
  if (!window.paypal) {
    showStatus('PayPal JS SDK v6 failed to load.', 'error');
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
          await paypalSession.start({ presentationMode: 'auto' }, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) {
            showStatus(`PayPal error: ${err.message}`, 'error');
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
          await payLaterSession.start({ presentationMode: 'auto' }, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) {
            showStatus(`Pay Later error: ${err.message}`, 'error');
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
          await venmoSession.start({ presentationMode: 'auto' }, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) {
            showStatus(`Venmo error: ${err.message}`, 'error');
          }
        }
      });
    }

    if (
      !eligibleMethods.isEligible('paypal') &&
      !eligibleMethods.isEligible('paylater') &&
      !eligibleMethods.isEligible('venmo')
    ) {
      showStatus('No eligible payment methods for this buyer / region.', 'info');
    }

  } catch (err) {
    console.error('[v6-iframe] Init error:', err);
    hideSdkLoading();
    showStatus(`SDK initialization failed: ${err.message}`, 'error');
  }
}

init();
