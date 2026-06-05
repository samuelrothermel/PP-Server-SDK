/**
 * ACH Pay with Bank — JS SDK v6
 *
 * Flow per official limited-release docs:
 *   1. GET /api/ach/client-token → clientToken (oauth2/token, response_type=client_token)
 *   2. createInstance({ clientToken, components: ['bank-ach-payments'] })
 *   3. findEligibleMethods({ currencyCode, paymentFlow: 'ONE_TIME_PAYMENT', amount })
 *   4. isEligible('ach') gate
 *   5. createBankAchOneTimePaymentSession({ onApprove, onCancel, onError })
 *   6. bank-ach-button click → session.start({ presentationMode: 'popup' }, createOrderPromise)
 *   7. onApprove: GET order details → show debit auth modal → buyer confirms → capture
 *
 * Sandbox: bank = "Open Finance Bank OAUTH", user = john_surname, pw = ob_user
 */

const sdkLoadingEl = document.getElementById('sdk-loading');
const statusArea   = document.getElementById('status-area');
const responsePanel   = document.getElementById('response-panel');
const responseContent = document.getElementById('response-content');
const authOverlay  = document.getElementById('auth-overlay');
const authText     = document.getElementById('auth-text');
const authConfirm  = document.getElementById('auth-confirm-btn');
const authCancel   = document.getElementById('auth-cancel-btn');

const AMOUNT = '50.00';
const CURRENCY = 'USD';

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

async function getClientToken() {
  const res = await fetch('/api/ach/client-token');
  if (!res.ok) throw new Error(`Client token fetch failed: ${res.status}`);
  return res.json(); // { clientId, clientToken }
}

async function createOrder() {
  const res = await fetch('/api/ach/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: AMOUNT }),
  });
  if (!res.ok) throw new Error(`Order creation failed: ${res.status}`);
  const data = await res.json();
  console.log('[ach-sdk] Order created:', data.id);
  return data.id;
}

async function getOrderDetails(orderId) {
  const res = await fetch(`/api/ach/orders/${orderId}`);
  if (!res.ok) throw new Error(`Order fetch failed: ${res.status}`);
  return res.json();
}

async function captureOrder(orderId) {
  const res = await fetch(`/api/ach/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Capture failed: ${res.status}`);
  return res.json();
}

// ── Debit authorization modal ─────────────────────────────────────────────────

function buildAuthText(orderDetails) {
  const ach = orderDetails?.payment_source?.bank?.ach_debit;
  const amount = orderDetails?.purchase_units?.[0]?.amount?.value || AMOUNT;
  const currency = orderDetails?.purchase_units?.[0]?.amount?.currency_code || CURRENCY;
  const bankName = ach?.bank_name || 'your bank';
  const lastDigits = ach?.last_digits ? `ending in ${ach.last_digits}` : '';
  const holderName = ach?.account_holder_name || '';
  const accountType = ach?.account_type || 'bank account';
  const routingNumber = ach?.routing_number || '';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `I authorize [Merchant] to initiate a one-time ACH/electronic debit to my account as follows:\n\n` +
    `Amount: ${currency} ${amount}\n` +
    `Authorization Date: ${today}\n` +
    (holderName ? `Account holder: ${holderName}\n` : '') +
    `Bank: ${bankName}${lastDigits ? ` — ${accountType} ${lastDigits}` : ''}\n` +
    (routingNumber ? `Routing Number: ${routingNumber}\n` : '') +
    `\nI agree that ACH transactions I authorize comply with all applicable laws.`;
}

function showAuthModal(orderDetails, orderId) {
  return new Promise((resolve, reject) => {
    authText.textContent = buildAuthText(orderDetails);
    authOverlay.classList.add('visible');

    function cleanup() {
      authOverlay.classList.remove('visible');
      authConfirm.removeEventListener('click', onConfirm);
      authCancel.removeEventListener('click', onCancel);
    }

    function onConfirm() {
      cleanup();
      resolve(orderId);
    }

    function onCancel() {
      cleanup();
      reject(new Error('Buyer cancelled debit authorization'));
    }

    authConfirm.addEventListener('click', onConfirm);
    authCancel.addEventListener('click', onCancel);
  });
}

// ── Main initialisation ───────────────────────────────────────────────────────

async function init() {
  if (!window.paypal) {
    showStatus('PayPal JS SDK v6 failed to load.', 'error');
    hideSdkLoading();
    return;
  }

  try {
    showStatus('Fetching client token…', 'info');
    const { clientToken } = await getClientToken();

    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ['bank-ach-payments'],
      pageType: 'checkout',
      locale: 'en-US',
      clientMetadataId: crypto.randomUUID(),
    });
    console.log('[ach-sdk] SDK instance created');

    const eligibleMethods = await sdkInstance.findEligibleMethods({
      currencyCode: CURRENCY,
      paymentFlow: 'ONE_TIME_PAYMENT',
      amount: AMOUNT,
    });
    console.log('[ach-sdk] Eligible methods:', eligibleMethods);

    hideSdkLoading();

    if (!eligibleMethods.isEligible('ach')) {
      showStatus(
        'ACH is not eligible for this merchant account. ' +
        'Ensure the account has Expanded Checkout approval and ACH provisioned.',
        'info'
      );
      return;
    }

    statusArea.style.display = 'none';

    const bankAchSession = sdkInstance.createBankAchOneTimePaymentSession({
      async onApprove(data) {
        showStatus('Bank verified — loading authorization details…', 'info');
        try {
          const orderDetails = await getOrderDetails(data.orderId);
          await showAuthModal(orderDetails, data.orderId);

          showStatus('Capturing payment…', 'info');
          const captureData = await captureOrder(data.orderId);
          console.log('[ach-sdk] Capture response:', captureData);

          const captureStatus = captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
          if (captureStatus === 'PENDING') {
            showStatus(
              'ACH payment captured — PENDING. Funds settle in ~5 calendar days. ' +
              'Wait for PAYMENT.CAPTURE.COMPLETED webhook before fulfilling.',
              'info'
            );
          } else {
            showStatus(`Payment captured — status: ${captureStatus || captureData.status}`, 'success');
          }
          showResponse(captureData);
        } catch (err) {
          if (err.message.includes('cancelled debit authorization')) {
            showStatus('Buyer cancelled authorization.', 'info');
          } else {
            console.error('[ach-sdk] onApprove error:', err);
            showStatus(`Error: ${err.message}`, 'error');
          }
        }
      },

      onCancel(data) {
        console.log('[ach-sdk] Cancelled:', data);
        showStatus('Bank payment cancelled.', 'info');
      },

      onError(error) {
        console.error('[ach-sdk] Error:', error);
        showStatus(`Payment error: ${error.message || 'Unknown error'}`, 'error');
      },
    });

    const achButton = document.getElementById('ach-button');
    achButton.removeAttribute('hidden');

    achButton.addEventListener('click', async () => {
      try {
        const checkoutOptionsPromise = createOrder().then(id => ({ orderId: id }));
        await bankAchSession.start({ presentationMode: 'popup' }, checkoutOptionsPromise);
      } catch (err) {
        if (!err.isRecoverable) {
          showStatus(`ACH error: ${err.message}`, 'error');
        }
      }
    });

  } catch (err) {
    console.error('[ach-sdk] Init error:', err);
    hideSdkLoading();
    showStatus(`Initialization failed: ${err.message}`, 'error');
  }
}

init();
