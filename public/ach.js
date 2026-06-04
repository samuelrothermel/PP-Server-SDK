/**
 * ACH Bank Payment — JS SDK v6 (discovery / probe mode)
 *
 * ACH is limited-release only. The component name, eligibility key, and
 * session method are not published in public docs. This file probes the live
 * SDK instance to surface what's actually available, then attempts the
 * integration if an ACH-related method is found.
 *
 * Component candidates tried in order: bankAchPayments, bank-ach-payments,
 * achPayments, ach-payments (the SDK silently ignores unknown component names,
 * so we try the most likely one and inspect the resulting instance).
 */

const sdkLoadingEl = document.getElementById('sdk-loading');
const statusArea = document.getElementById('status-area');
const responsePanel = document.getElementById('response-panel');
const responseContent = document.getElementById('response-content');
const probePanel = document.getElementById('probe-panel');
const probeContent = document.getElementById('probe-content');

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

function showProbe(data) {
  probeContent.textContent = JSON.stringify(data, null, 2);
  probePanel.style.display = 'block';
}

function hideSdkLoading() {
  sdkLoadingEl.style.display = 'none';
}

function getMethods(obj) {
  const names = new Set();
  let cur = obj;
  while (cur && cur !== Object.prototype) {
    Object.getOwnPropertyNames(cur).forEach(n => names.add(n));
    cur = Object.getPrototypeOf(cur);
  }
  return [...names].sort();
}

function findAchMethods(instance) {
  return getMethods(instance).filter(n =>
    /ach|bank|debit/i.test(n) && n !== 'constructor'
  );
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
  console.log('[ach] Order created:', order.id);
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

// ── Main initialisation ───────────────────────────────────────────────────────

async function init() {
  if (!window.paypal) {
    showStatus('PayPal JS SDK v6 failed to load.', 'error');
    hideSdkLoading();
    return;
  }

  try {
    // Try the most likely component name; SDK silently drops unknown names.
    const sdkInstance = await window.paypal.createInstance({
      clientId: CLIENT_ID,
      components: ['bankAchPayments'],
      pageType: 'checkout',
      locale: 'en-US',
      clientMetadataId: crypto.randomUUID(),
    });

    const allMethods = getMethods(sdkInstance);
    const achMethods = findAchMethods(sdkInstance);
    console.log('[ach] All instance methods:', allMethods);
    console.log('[ach] ACH-related methods found:', achMethods);

    const eligibleMethods = await sdkInstance.findEligibleMethods({ currency: 'USD' });
    const eligibilityKeys = ['ach', 'bank', 'bank_transfer', 'bank_debit', 'direct_debit'];
    const eligibilityResults = Object.fromEntries(
      eligibilityKeys.map(k => [k, eligibleMethods.isEligible(k)])
    );
    console.log('[ach] Eligibility probe:', eligibilityResults);

    hideSdkLoading();

    // Surface probe results on the page
    showProbe({
      instanceMethods: allMethods,
      achRelatedMethods: achMethods,
      eligibilityProbe: eligibilityResults,
      note: 'ACH component and session method names are not in public docs. ' +
            'Use achRelatedMethods to find the correct createXxxSession() call, ' +
            'and eligibilityProbe to find the correct isEligible() key.',
    });

    const achEligible = Object.values(eligibilityResults).some(Boolean);
    if (!achEligible) {
      showStatus(
        'No ACH/bank eligibility detected. This merchant account likely does not have ' +
        'ACCEPT_PYMTS_VIA_ACH provisioned, or the component name was not recognised.',
        'info'
      );
      return;
    }

    // Find whichever session method the SDK actually exposes
    const SESSION_METHOD_CANDIDATES = [
      'createBankPaymentSession',
      'createAchPaymentSession',
      'createBankAchPaymentSession',
      'createAchOneTimePaymentSession',
      'createBankTransferSession',
    ];
    const sessionMethodName = SESSION_METHOD_CANDIDATES.find(
      m => typeof sdkInstance[m] === 'function'
    );

    if (!sessionMethodName) {
      showStatus(
        `ACH is eligible but no session method was found. ` +
        `Tried: ${SESSION_METHOD_CANDIDATES.join(', ')}. ` +
        `Check the probe panel below for the full instance method list.`,
        'error'
      );
      return;
    }

    console.log('[ach] Using session method:', sessionMethodName);
    showStatus(`ACH eligible — using session method: ${sessionMethodName}`, 'info');

    const achSession = sdkInstance[sessionMethodName]({
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

      onCancel() { showStatus('Bank payment cancelled by buyer.', 'info'); },
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
        if (!err.isRecoverable) showStatus(`ACH error: ${err.message}`, 'error');
      }
    });

  } catch (err) {
    console.error('[ach] Init error:', err);
    hideSdkLoading();
    showStatus(`SDK initialization failed: ${err.message}`, 'error');
  }
}

init();
