import fetch from 'node-fetch';
import { generateAccessToken } from '../services/authApi.js';

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

// In-memory store: invoiceId → array of received webhook events
const invoiceWebhookEvents = new Map();

/** Called by webhookService when INVOICING.INVOICE.PAID fires. */
export function recordInvoiceWebhook(invoiceId, eventPayload) {
  if (!invoiceWebhookEvents.has(invoiceId)) {
    invoiceWebhookEvents.set(invoiceId, []);
  }
  invoiceWebhookEvents.get(invoiceId).push({
    receivedAt: new Date().toISOString(),
    payload: eventPayload,
  });
}

/** GET /api/invoicing/webhook-events/:invoiceId */
export function getInvoiceWebhookEvents(req, res) {
  const { invoiceId } = req.params;
  const events = invoiceWebhookEvents.get(invoiceId) || [];
  res.json({ events });
}

export async function generatePayLink(req, res) {
  const { customerEmail, customerName, currency, note, items } = req.body;
  const apiLog = [];

  try {
    const token = await generateAccessToken();
    apiLog.push({ method: 'POST', url: '/v1/oauth2/token', description: 'Get access token', status: 200 });

    // Build invoice payload
    const lineItems = (items || []).map(item => ({
      name: item.name,
      quantity: String(item.qty),
      unit_amount: { currency_code: currency, value: Number(item.price).toFixed(2) },
      unit_of_measure: 'QUANTITY',
    }));

    const subtotal = (items || []).reduce((s, i) => s + i.qty * i.price, 0);

    const invoicePayload = {
      detail: {
        currency_code: currency,
        note: note || '',
        payment_term: { term_type: 'DUE_ON_RECEIPT' },
      },
      invoicer: {},
      primary_recipients: [{
        billing_info: {
          email_address: customerEmail,
          name: { given_name: customerName || 'Customer' },
        },
      }],
      items: lineItems,
      amount: {
        currency_code: currency,
        breakdown: {
          item_total: { currency_code: currency, value: subtotal.toFixed(2) },
        },
      },
    };

    // 1. Create draft invoice
    const createUrl = `${SANDBOX_BASE}/v2/invoicing/invoices`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(invoicePayload),
    });
    apiLog.push({ method: 'POST', url: '/v2/invoicing/invoices', description: 'Create draft invoice', status: createRes.status });
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Create invoice failed (${createRes.status}): ${text}`);
    }
    // The create endpoint returns 201 with a Location header; body is empty.
    const location  = createRes.headers.get('location') || '';
    const invoiceId = location.split('/').pop();
    if (!invoiceId) {
      throw new Error('Could not extract invoice ID from Location header');
    }

    // 2. Send invoice (required to get payer_view_url)
    const sendUrl = `${SANDBOX_BASE}/v2/invoicing/invoices/${invoiceId}/send`;
    const sendRes = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ send_to_invoicer: false }),
    });
    apiLog.push({ method: 'POST', url: `/v2/invoicing/invoices/${invoiceId}/send`, description: 'Send invoice', status: sendRes.status });
    // 200 or 204 are both success; no body on 204

    // 3. Fetch invoice details to get payer_view_url
    const getUrl = `${SANDBOX_BASE}/v2/invoicing/invoices/${invoiceId}`;
    const getRes = await fetch(getUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    apiLog.push({ method: 'GET', url: `/v2/invoicing/invoices/${invoiceId}`, description: 'Fetch invoice (get payer_view_url)', status: getRes.status });
    if (!getRes.ok) {
      const text = await getRes.text();
      throw new Error(`Get invoice failed (${getRes.status}): ${text}`);
    }
    const invoiceData   = await getRes.json();
    const payerViewUrl  = invoiceData.detail?.payer_view_url
      || invoiceData.links?.find(l => l.rel === 'payer-view')?.href
      || '';

    res.json({
      invoiceId,
      payerViewUrl,
      currency,
      total: subtotal.toFixed(2),
      customerEmail,
      apiLog,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, apiLog });
  }
}

export async function getInvoiceStatus(req, res) {
  const { invoiceId } = req.body;
  const apiLog = [];

  try {
    const token  = await generateAccessToken();
    apiLog.push({ method: 'POST', url: '/v1/oauth2/token', description: 'Get access token', status: 200 });
    const getUrl = `${SANDBOX_BASE}/v2/invoicing/invoices/${invoiceId}`;
    const getRes = await fetch(getUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    apiLog.push({ method: 'GET', url: `/v2/invoicing/invoices/${invoiceId}`, description: 'Poll invoice status', status: getRes.status });
    if (!getRes.ok) {
      const text = await getRes.text();
      throw new Error(`Get invoice failed (${getRes.status}): ${text}`);
    }
    const data = await getRes.json();
    res.json({ status: data.status, apiLog });
  } catch (err) {
    res.status(500).json({ error: err.message, apiLog });
  }
}
