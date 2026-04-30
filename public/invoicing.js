/* ── Invoicing Demo — Client JS ── */

// ── State ──────────────────────────────────────────────────────────────────
let currentInvoiceId    = null;
let pollingInterval     = null;
let isPolling           = false;
let webhookPollInterval = null;
let webhookReceived     = false;

// ── Tab switching ───────────────────────────────────────────────────────────
document.querySelectorAll('.inv-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.inv-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
  });
});

// ── Line item helpers ───────────────────────────────────────────────────────
function addLineItem() {
  const container = document.getElementById('lineItemsContainer');
  const row = document.createElement('div');
  row.className = 'inv-line-item';
  row.innerHTML = `
    <input type="text"   class="li-name"  placeholder="Item name">
    <input type="number" class="li-qty"   placeholder="Qty"   value="1" min="1" step="1">
    <input type="number" class="li-price" placeholder="Price" value="0" min="0" step="0.01">
    <button class="btn-icon" onclick="removeLineItem(this)" title="Remove">✕</button>
  `;
  container.appendChild(row);
  updateTotals();
}

function removeLineItem(btn) {
  const rows = document.querySelectorAll('.inv-line-item');
  if (rows.length <= 1) return; // keep at least one
  btn.closest('.inv-line-item').remove();
  updateTotals();
}

function getLineItems() {
  return [...document.querySelectorAll('.inv-line-item')].map(row => ({
    name:  row.querySelector('.li-name').value.trim() || 'Item',
    qty:   parseFloat(row.querySelector('.li-qty').value)   || 1,
    price: parseFloat(row.querySelector('.li-price').value) || 0,
  }));
}

function updateTotals() {
  const items    = getLineItems();
  const currency = document.getElementById('invoiceCurrency').value;
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const fmt      = v => `${currency} ${v.toFixed(2)}`;
  document.getElementById('subtotalDisplay').textContent  = fmt(subtotal);
  document.getElementById('grandTotalDisplay').textContent = fmt(subtotal);
}

// Recalculate totals whenever inputs change
document.getElementById('lineItemsContainer').addEventListener('input', updateTotals);
document.getElementById('invoiceCurrency').addEventListener('change', updateTotals);
updateTotals(); // initial

// ── API Log ─────────────────────────────────────────────────────────────────
function logApiCall(method, url, description, status) {
  const log = document.getElementById('apiLog');
  const empty = log.querySelector('.inv-api-log-empty');
  if (empty) empty.remove();

  const ok = status >= 200 && status < 300;
  const entry = document.createElement('div');
  entry.className = 'inv-api-log-entry';
  entry.innerHTML = `
    <span class="inv-api-method ${method}">${method}</span>
    <span class="inv-api-url">${url}</span>
    <span class="inv-api-desc">${description}</span>
    <span class="inv-api-status ${ok ? 'ok' : 'err'}">${status}</span>
  `;
  log.prepend(entry);
}

// ── Generate Pay Link ───────────────────────────────────────────────────────
async function generatePayLink() {
  const customerEmail = document.getElementById('customerEmail').value.trim();
  const customerName  = document.getElementById('customerName').value.trim();
  const currency      = document.getElementById('invoiceCurrency').value;
  const note          = document.getElementById('invoiceNote').value.trim();
  const items         = getLineItems();

  if (!customerEmail) {
    showPayLinkError('Please enter a customer email (sandbox buyer account).');
    return;
  }

  setPayLinkLoading(true);
  resetPayLinkResult();
  currentInvoiceId = null;
  clearInterval(webhookPollInterval);
  webhookReceived = false;
  document.getElementById('webhookEmpty').style.display      = 'block';
  document.getElementById('webhookWaiting').style.display    = 'none';
  document.getElementById('webhookLive').style.display       = 'none';
  document.getElementById('webhookSimSection').style.display = 'none';

  try {
    console.log('[Invoicing] POST /api/invoicing/generate-pay-link', { customerEmail, customerName, currency, items });

    const res = await fetch('/api/invoicing/generate-pay-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerEmail, customerName, currency, note, items }),
    });

    console.log('[Invoicing] Response status:', res.status);
    const data = await res.json();
    console.log('[Invoicing] Response body:', data);

    if (data.apiLog) {
      data.apiLog.forEach(entry => logApiCall(entry.method, entry.url, entry.description, entry.status));
    }

    if (!res.ok || data.error) {
      throw new Error(data.error || `Server returned ${res.status}`);
    }

    console.log('[Invoicing] Invoice ID:', data.invoiceId);
    console.log('[Invoicing] Payer view URL:', data.payerViewUrl || '(empty — URL missing)');

    currentInvoiceId = data.invoiceId;
    showPayLinkResult(data);
    revealStatusPanel();
    simulateWebhookPayload(data);
    startWebhookPolling(data.invoiceId);

  } catch (err) {
    console.error('[Invoicing] Error:', err.message);
    showPayLinkError(err.message);
  } finally {
    setPayLinkLoading(false);
  }
}

function setPayLinkLoading(on) {
  document.getElementById('payLinkLoading').style.display = on ? 'flex' : 'none';
  document.getElementById('generateBtn').disabled = on;
}

function resetPayLinkResult() {
  document.getElementById('payLinkResult').style.display = 'none';
  document.getElementById('payLinkError').style.display  = 'none';
  document.getElementById('payLinkEmpty').style.display  = 'block';
}

function showPayLinkResult(data) {
  document.getElementById('payLinkEmpty').style.display  = 'none';
  document.getElementById('payLinkError').style.display  = 'none';
  document.getElementById('payLinkResult').style.display = 'block';

  document.getElementById('invoiceMeta').textContent =
    `Invoice ID: ${data.invoiceId} · Total: ${data.currency} ${data.total}`;

  const urlInput = document.getElementById('payLinkUrl');
  urlInput.value = data.payerViewUrl;

  const openLink = document.getElementById('payLinkOpen');
  openLink.href = data.payerViewUrl;
}

function showPayLinkError(msg) {
  document.getElementById('payLinkEmpty').style.display  = 'none';
  document.getElementById('payLinkResult').style.display = 'none';
  const box = document.getElementById('payLinkError');
  box.style.display = 'block';
  box.textContent   = msg;
}

function copyPayLink() {
  const url = document.getElementById('payLinkUrl').value;
  navigator.clipboard.writeText(url).catch(() => {
    document.getElementById('payLinkUrl').select();
    document.execCommand('copy');
  });
}

// ── Payment Status Polling ──────────────────────────────────────────────────
function revealStatusPanel() {
  document.getElementById('statusEmpty').style.display = 'none';
  document.getElementById('statusPanel').style.display = 'block';
}

function togglePolling() {
  if (isPolling) {
    stopPolling();
  } else {
    startPolling();
  }
}

function startPolling() {
  if (!currentInvoiceId) return;
  isPolling = true;
  document.getElementById('pollBtn').textContent = 'Stop Polling';
  pollStatus();
  pollingInterval = setInterval(pollStatus, 5000);
}

function stopPolling() {
  isPolling = false;
  clearInterval(pollingInterval);
  pollingInterval = null;
  document.getElementById('pollBtn').textContent = 'Start Polling';
}

async function pollStatus() {
  if (!currentInvoiceId) return;

  try {
    const res = await fetch('/api/invoicing/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: currentInvoiceId }),
    });
    const data = await res.json();

    if (data.apiLog) {
      data.apiLog.forEach(entry => logApiCall(entry.method, entry.url, entry.description, entry.status));
    }

    if (data.status) {
      updateStatusBadge(data.status);
      appendStatusHistory(data.status);

      if (data.status === 'PAID' || data.status === 'MARKED_AS_PAID') {
        stopPolling();
      }
    }
  } catch (err) {
    appendStatusHistory(`ERROR: ${err.message}`);
  }
}

function updateStatusBadge(status) {
  const badge = document.getElementById('paymentStatusBadge');
  badge.textContent = status;
  badge.className   = `inv-status-badge ${status}`;
}

function appendStatusHistory(status) {
  const history = document.getElementById('statusHistory');
  const entry   = document.createElement('div');
  const time    = new Date().toLocaleTimeString();
  entry.textContent = `${time} — ${status}`;
  history.prepend(entry);
}

// ── Webhook Simulation ──────────────────────────────────────────────────────
function simulateWebhookPayload(invoiceData) {
  const payload = buildWebhookPayload(invoiceData, 'INVOICING.INVOICE.SENT');
  renderWebhookPayload(payload);
}

function buildWebhookPayload(invoiceData, eventType) {
  const now = new Date().toISOString();
  return {
    id: `WH-${Math.random().toString(36).substr(2, 16).toUpperCase()}`,
    event_version: '1.0',
    create_time: now,
    resource_type: 'invoice',
    resource_version: '2.0',
    event_type: eventType,
    summary: `An invoice ${eventType === 'INVOICING.INVOICE.PAID' ? 'was paid' : 'was sent'}.`,
    resource: {
      id: invoiceData.invoiceId,
      detail: {
        currency_code: invoiceData.currency,
        note: document.getElementById('invoiceNote').value.trim() || '',
        invoice_date: now.split('T')[0],
        payment_term: { term_type: 'DUE_ON_RECEIPT' },
      },
      invoicer: { email_address: 'merchant@sandbox.com' },
      primary_recipients: [{ billing_info: { email_address: invoiceData.customerEmail } }],
      amount: {
        currency_code: invoiceData.currency,
        value: invoiceData.total,
        breakdown: { item_total: { currency_code: invoiceData.currency, value: invoiceData.total } },
      },
      status: eventType === 'INVOICING.INVOICE.PAID' ? 'PAID' : 'SENT',
      payments: eventType === 'INVOICING.INVOICE.PAID' ? {
        paid_amount: { currency_code: invoiceData.currency, value: invoiceData.total },
        transactions: [{
          payment_id: `PAY-${Math.random().toString(36).substr(2,12).toUpperCase()}`,
          payment_date: now,
          method: 'PAYPAL',
          amount: { currency_code: invoiceData.currency, value: invoiceData.total },
        }],
      } : undefined,
    },
    links: [
      { href: `https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${invoiceData.invoiceId}`, rel: 'self', method: 'GET' },
    ],
  };
}

function renderWebhookPayload(payload) {
  // Show simulated payload section (collapsible reference)
  document.getElementById('webhookEmpty').style.display      = 'none';
  document.getElementById('webhookSimSection').style.display = 'block';
  document.getElementById('webhookTime').textContent         = new Date().toLocaleTimeString();
  document.getElementById('webhookPayload').textContent      = JSON.stringify(payload, null, 2);
  document.getElementById('webhookType').textContent         = payload.event_type;
}

// ── Real Webhook Polling ────────────────────────────────────────────────────
function startWebhookPolling(invoiceId) {
  webhookReceived = false;
  clearInterval(webhookPollInterval);

  // Show the waiting indicator on the webhook tab
  document.getElementById('webhookEmpty').style.display   = 'none';
  document.getElementById('webhookWaiting').style.display = 'flex';
  document.getElementById('webhookLive').style.display    = 'none';

  webhookPollInterval = setInterval(() => pollWebhookEvents(invoiceId), 5000);
}

async function pollWebhookEvents(invoiceId) {
  if (webhookReceived) {
    clearInterval(webhookPollInterval);
    return;
  }
  try {
    const res  = await fetch(`/api/invoicing/webhook-events/${invoiceId}`);
    const data = await res.json();
    if (data.events && data.events.length > 0) {
      webhookReceived = true;
      clearInterval(webhookPollInterval);
      showLiveWebhookEvent(data.events[data.events.length - 1]);
    }
  } catch (_) {
    // network blip — keep polling
  }
}

function showLiveWebhookEvent(event) {
  document.getElementById('webhookWaiting').style.display = 'none';
  document.getElementById('webhookLive').style.display    = 'block';

  const receivedAt = new Date(event.receivedAt).toLocaleTimeString();
  document.getElementById('webhookLiveTime').textContent    = receivedAt;
  document.getElementById('webhookLiveType').textContent    = event.payload.event_type || 'INVOICING.INVOICE.PAID';
  document.getElementById('webhookLivePayload').textContent = JSON.stringify(event.payload, null, 2);

  // Auto-switch to webhook tab so the user notices
  document.querySelector('[data-tab="webhook"]').click();
}
