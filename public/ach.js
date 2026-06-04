/**
 * ACH Direct Debit — sandbox test page
 *
 * No JS SDK. Two server calls:
 *   POST /api/ach/orders           → create order, returns { id }
 *   POST /api/ach/orders/:id/capture → capture with payment_source.bank.ach_debit
 */

// ── DOM refs ─────────────────────────────────────────────────────────────────

const createBtn = document.getElementById('create-btn');
const captureBtn = document.getElementById('capture-btn');

const createStatus = document.getElementById('create-status');
const captureStatus = document.getElementById('capture-status');

const createResponsePanel = document.getElementById('create-response');
const createResponseContent = document.getElementById('create-response-content');

const captureResponsePanel = document.getElementById('capture-response');
const captureResponseContent = document.getElementById('capture-response-content');

// ── Helpers ──────────────────────────────────────────────────────────────────

function setStatus(el, message, type) {
  el.textContent = message;
  el.className = `status-area ${type}`;
}

function showResponse(panel, pre, data) {
  pre.textContent = JSON.stringify(data, null, 2);
  panel.style.display = 'block';
}

function val(id) {
  return document.getElementById(id).value.trim();
}

// ── Step 1: Create order ──────────────────────────────────────────────────────

createBtn.addEventListener('click', async () => {
  createBtn.disabled = true;
  setStatus(createStatus, 'Creating order…', 'info');
  createResponsePanel.style.display = 'none';

  try {
    const res = await fetch('/api/ach/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: val('amount') }),
    });

    const data = await res.json();
    showResponse(createResponsePanel, createResponseContent, data);

    if (!res.ok) {
      setStatus(createStatus, `Error ${res.status}: ${data.message || data.error || 'Order creation failed'}`, 'error');
      return;
    }

    document.getElementById('order-id').value = data.id;
    setStatus(createStatus, `Order created: ${data.id}`, 'success');
  } catch (err) {
    setStatus(createStatus, `Network error: ${err.message}`, 'error');
  } finally {
    createBtn.disabled = false;
  }
});

// ── Step 2: Capture with ACH ──────────────────────────────────────────────────

captureBtn.addEventListener('click', async () => {
  const orderId = val('order-id');
  if (!orderId) {
    setStatus(captureStatus, 'Complete Step 1 first — order ID is required.', 'error');
    return;
  }

  captureBtn.disabled = true;
  setStatus(captureStatus, 'Capturing with bank details…', 'info');
  captureResponsePanel.style.display = 'none';

  const billingAddress = {
    address_line_1: val('addr-line1'),
    admin_area_2: val('addr-city'),
    admin_area_1: val('addr-state'),
    postal_code: val('addr-zip'),
    country_code: val('addr-country'),
  };

  // Only include billing address if at least a line 1 was entered
  const includeBilling = billingAddress.address_line_1.length > 0;

  const body = {
    account_number: val('account-number'),
    routing_number: val('routing-number'),
    account_type: val('account-type'),
    account_holder_name: val('account-holder'),
    ownership_type: val('ownership-type'),
    sec_code: val('sec-code'),
    ...(includeBilling ? { billing_address: billingAddress } : {}),
  };

  try {
    const res = await fetch(`/api/ach/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    showResponse(captureResponsePanel, captureResponseContent, data);

    if (!res.ok) {
      setStatus(captureStatus, `Error ${res.status}: ${data.message || data.error || 'Capture failed'}`, 'error');
      return;
    }

    const captureStatus2 = data?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (captureStatus2 === 'PENDING') {
      setStatus(captureStatus,
        'Capture PENDING — ACH funds settle in ~5 calendar days. ' +
        'Wait for the PAYMENT.CAPTURE.COMPLETED webhook before fulfilling.',
        'info'
      );
    } else {
      setStatus(captureStatus, `Capture status: ${captureStatus2 || data.status}`, 'success');
    }
  } catch (err) {
    setStatus(captureStatus, `Network error: ${err.message}`, 'error');
  } finally {
    captureBtn.disabled = false;
  }
});
