/**
 * ACH Bank Payment — JS SDK v6
 *
 * Flow:
 *   1. createInstance() with clientId + bankAchPayments component
 *   2. findEligibleMethods() — check isEligible('ach') before rendering
 *   3. createBankPaymentSession() with createOrder / onApprove callbacks
 *   4. bank-payment-button click → session.start()
 *   5. Buyer links bank via Finicity UI (Yodlee in sandbox)
 *   6. onApprove → POST /api/orders/:id/capture → show result
 *
 * Merchant requirements: PPCP/Unbranded, US only, ACCEPT_PYMTS_VIA_ACH
 * feature provisioned, 10-digit NACHA Company ID, Expanded Checkout approval.
 *
 * IMPORTANT — unconfirmed API surface:
 * The component name 'bank-ach-payments', eligibility key 'ach', session
 * method 'createBankPaymentSession', and web component 'bank-payment-button'
 * are sourced from internal PayPal altpay docs. None of these appear in the
 * public JS SDK v6 reference at developer.paypal.com. Confirm exact names
 * with the PayPal altpay team before shipping. The button will only render
 * if the merchant account has ACH provisioned AND the names match.
 */

const sdkLoadingEl = document.getElementById('sdk-loading');
const statusArea = document.getElementById('status-area');
const responsePanel = document.getElementById('response-panel');
const responseContent = document.getElementById('response-content');

// ── Helpers ──────────────────────────────────────────────────────────────────

function showStatus(message, type = 'info') {
  statusArea.textContent = message;
  statusArea.className = `status-area ${type}`;
  statusArea.style.display = 'block';
}

function showResponse(data) {
  responseContent.textContent = JSON.stringify(data, null, 2);
  responsePanel.style.display = 'block';
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
  console.log('[ach] Order created:', order.id);

  // v6 SDK requires { orderId }
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
      // bankAchPayments is the v6 component for ACH
      components: ['bank-ach-payments'],
      pageType: 'checkout',
      locale: 'en-US',
      clientMetadataId: crypto.randomUUID(),
    });
    console.log('[ach] SDK instance created');

    // Dump all methods on the instance to identify the correct ACH session method name
    console.log('[ach] sdkInstance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(sdkInstance)).concat(Object.keys(sdkInstance)));

    const eligibleMethods = await sdkInstance.findEligibleMethods({ currency: 'USD' });
    console.log('[ach] Eligible methods:', eligibleMethods);
    console.log('[ach] eligibleMethods keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(eligibleMethods)).concat(Object.keys(eligibleMethods)));

    hideSdkLoading();

    if (!eligibleMethods.isEligible('ach')) {
      showStatus(
        'ACH is not eligible for this merchant account or transaction. ' +
        'Ensure ACCEPT_PYMTS_VIA_ACH is provisioned and the transaction is under the ACH limit tier.',
        'info'
      );
      return;
    }

    const achSession = sdkInstance.createBankPaymentSession({
      async createOrder() {
        showStatus('Creating order…', 'info');
        return createOrder();
      },

      async onApprove({ orderId }) {
        showStatus('Bank payment approved — capturing…', 'info');
        try {
          const captureData = await captureOrder(orderId);
          console.log('[ach] Capture response:', captureData);
          showStatus(
            'ACH payment captured. Note: ACH settlements take 1–3 business days — ' +
            'do not fulfill until the PAYMENT.CAPTURE.COMPLETED webhook confirms settlement.',
            'success'
          );
          showResponse(captureData);
        } catch (err) {
          console.error('[ach] Capture error:', err);
          showStatus(`Capture failed: ${err.message}`, 'error');
        }
      },

      onCancel() {
        showStatus('Bank payment cancelled by buyer.', 'info');
      },

      onError(error) {
        console.error('[ach] Payment error:', error);
        showStatus(`Payment error: ${error.message || 'Unknown error'}`, 'error');
      },
    });

    const achButton = document.getElementById('ach-button');
    achButton.removeAttribute('hidden');

    achButton.addEventListener('click', async () => {
      try {
        await achSession.start({ presentationMode: 'auto' }, achSession.createOrder());
      } catch (err) {
        if (!err.isRecoverable) {
          showStatus(`ACH error: ${err.message}`, 'error');
        }
      }
    });

  } catch (err) {
    console.error('[ach] Init error:', err);
    hideSdkLoading();
    showStatus(`SDK initialization failed: ${err.message}`, 'error');
  }
}

init();
