/**
 * JS SDK v6 — Advanced Checkout
 *
 * Extends the standard integration with:
 *   - Selectable presentation modes (auto / payment-handler / popup / modal / fallback loop)
 *   - Fallback loop: tries payment-handler → popup → modal, skipping recoverable errors
 *   - Dynamic order total from shipping option selection
 *   - Shipping address collected from form
 */

// ── DOM refs ──────────────────────────────────────────────────────────────────

const sdkLoadingEl   = document.getElementById('sdk-loading');
const statusBar      = document.getElementById('status-bar');
const responsePanel  = document.getElementById('response-panel');
const responseContent = document.getElementById('response-content');

const paypalOption   = document.getElementById('paypal-option');
const payLaterOption = document.getElementById('paylater-option');
const venmoOption    = document.getElementById('venmo-option');

// ── Helpers ───────────────────────────────────────────────────────────────────

function showStatus(message, type = 'info') {
  statusBar.textContent = message;
  statusBar.className = `status-bar ${type}`;
  statusBar.style.display = 'block';
}

function showResponse(data) {
  responseContent.textContent = JSON.stringify(data, null, 2);
  responsePanel.style.display = 'block';
}

function hideSdkLoading() {
  sdkLoadingEl.style.display = 'none';
}

function getPresentationMode() {
  const checked = document.querySelector('input[name="presentation-mode"]:checked');
  return checked ? checked.value : 'auto';
}

function getOrderTotal() {
  const shippingInput = document.querySelector('input[name="shipping-option"]:checked');
  const shipping = shippingInput ? parseFloat(shippingInput.value) : 0;
  const base = 100;
  return { total: (base + shipping).toFixed(2), shipping: shipping.toFixed(2) };
}

// Keep displayed totals in sync with shipping selection
document.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const { total, shipping } = getOrderTotal();
    document.getElementById('shipping-amount').textContent = shipping;
    document.getElementById('amount-total').textContent = total;
  });
});

function getShippingAddress() {
  return {
    addressLine1: document.getElementById('shipping-address-line1').value,
    adminArea2:   document.getElementById('shipping-city').value,
    adminArea1:   document.getElementById('shipping-state').value,
    postalCode:   document.getElementById('shipping-postal-code').value,
    countryCode:  document.getElementById('shipping-country-code').value,
  };
}

// ── Server API calls ──────────────────────────────────────────────────────────

async function createOrder() {
  const { total, shipping } = getOrderTotal();
  const addr = getShippingAddress();

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentSource: 'paypal',
      totalAmount: total,
      currency: 'USD',
      items: [
        { name: 'Sample Product', quantity: 1, unitAmount: '100.00' },
      ],
      shipping: {
        amount: shipping,
        address: addr,
      },
    }),
  });

  if (!response.ok) throw new Error(`Order creation failed: ${response.status}`);

  const order = await response.json();
  console.log('[v6-advanced] Order created:', order.id);
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

// ── Presentation mode start ───────────────────────────────────────────────────

/**
 * Start a payment session using the selected presentation mode.
 * When mode is 'fallback', tries payment-handler → popup → modal in sequence,
 * continuing on recoverable errors and throwing on non-recoverable ones.
 */
async function startSession(session, createOrderPromise) {
  const mode = getPresentationMode();

  if (mode === 'fallback') {
    const modesToTry = ['payment-handler', 'popup', 'modal'];
    for (const presentationMode of modesToTry) {
      try {
        console.log(`[v6-advanced] Trying presentationMode: ${presentationMode}`);
        await session.start({ presentationMode }, createOrderPromise);
        break; // success — stop trying
      } catch (error) {
        if (error.isRecoverable) {
          console.warn(`[v6-advanced] ${presentationMode} failed (recoverable), trying next…`);
          continue;
        }
        throw error; // non-recoverable — bubble up
      }
    }
  } else {
    await session.start({ presentationMode: mode }, createOrderPromise);
  }
}

// ── Payment session options ───────────────────────────────────────────────────

function buildSessionOptions() {
  return {
    async createOrder() {
      showStatus('Creating order…', 'info');
      return createOrder();
    },

    async onApprove({ orderId }) {
      showStatus('Payment approved — capturing…', 'info');
      try {
        const captureData = await captureOrder(orderId);
        console.log('[v6-advanced] Capture:', captureData);
        showStatus('Payment captured successfully!', 'success');
        showResponse(captureData);
      } catch (err) {
        console.error('[v6-advanced] Capture error:', err);
        showStatus(`Capture failed: ${err.message}`, 'error');
      }
    },

    onCancel() {
      showStatus('Payment cancelled by buyer.', 'info');
    },

    onError(error) {
      console.error('[v6-advanced] Payment error:', error);
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
    console.log('[v6-advanced] SDK instance created');

    const eligibleMethods = await sdkInstance.findEligibleMethods({ currency: 'USD' });
    console.log('[v6-advanced] Eligible methods:', eligibleMethods);

    hideSdkLoading();

    const sessionOptions = buildSessionOptions();

    // ── PayPal ──
    if (eligibleMethods.isEligible('paypal')) {
      const paypalSession = sdkInstance.createPayPalOneTimePaymentSession(sessionOptions);
      const paypalButton = document.getElementById('paypal-button');
      paypalOption.style.display = '';

      paypalButton.addEventListener('click', async () => {
        try {
          await startSession(paypalSession, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) showStatus(`PayPal error: ${err.message}`, 'error');
        }
      });
    }

    // ── Pay Later ──
    if (eligibleMethods.isEligible('paylater')) {
      const details = eligibleMethods.getDetails('paylater');
      const payLaterSession = sdkInstance.createPayLaterOneTimePaymentSession(sessionOptions);
      const payLaterButton = document.getElementById('pay-later-button');
      payLaterButton.productCode = details.productCode;
      payLaterButton.countryCode = details.countryCode;
      payLaterOption.style.display = '';

      payLaterButton.addEventListener('click', async () => {
        try {
          await startSession(payLaterSession, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) showStatus(`Pay Later error: ${err.message}`, 'error');
        }
      });
    }

    // ── Venmo ──
    if (eligibleMethods.isEligible('venmo')) {
      const venmoSession = sdkInstance.createVenmoOneTimePaymentSession(sessionOptions);
      const venmoButton = document.getElementById('venmo-button');
      venmoOption.style.display = '';

      venmoButton.addEventListener('click', async () => {
        try {
          await startSession(venmoSession, sessionOptions.createOrder());
        } catch (err) {
          if (!err.isRecoverable) showStatus(`Venmo error: ${err.message}`, 'error');
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
    console.error('[v6-advanced] Init error:', err);
    hideSdkLoading();
    showStatus(`SDK initialization failed: ${err.message}`, 'error');
  }
}

init();
