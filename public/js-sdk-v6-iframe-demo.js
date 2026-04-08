/**
 * JS SDK v6 — iFrame host/merchant page
 *
 * Listens for postMessage events from the embedded /js-sdk-v6/iframe-buttons iframe
 * and updates the UI (status area, response panel) accordingly.
 *
 * postMessage events handled:
 *   { type: 'iframe-ready' }
 *   { type: 'payment-flow-start' }
 *   { type: 'payment-flow-approved', orderId, captureData }
 *   { type: 'payment-flow-canceled' }
 *   { type: 'payment-flow-error', message }
 *   { type: 'presentationMode-changed', mode }
 */

const statusArea = document.getElementById('status-area');
const responsePanel = document.getElementById('response-panel');
const responseContent = document.getElementById('response-content');
const paypalIframe = document.getElementById('paypal-iframe');

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

// ── Resize iframe to fit its content ─────────────────────────────────────────

function resizeIframe() {
  try {
    const doc = paypalIframe.contentDocument || paypalIframe.contentWindow.document;
    paypalIframe.style.height = doc.body.scrollHeight + 'px';
  } catch (_) {
    // cross-origin — ignore
  }
}

paypalIframe.addEventListener('load', resizeIframe);

// ── postMessage listener ──────────────────────────────────────────────────────

const ALLOWED_ORIGIN = window.location.origin;

window.addEventListener('message', (event) => {
  // CRITICAL: validate origin
  if (event.origin !== ALLOWED_ORIGIN) return;

  const { type, captureData, message } = event.data || {};

  switch (type) {
    case 'iframe-ready':
      console.log('[host] iframe ready');
      resizeIframe();
      break;

    case 'payment-flow-start':
      showStatus('Creating order…', 'info');
      break;

    case 'presentationMode-changed':
      showStatus('Opening payment flow…', 'info');
      break;

    case 'payment-flow-approved':
      showStatus('Payment captured successfully!', 'success');
      if (captureData) showResponse(captureData);
      resizeIframe();
      break;

    case 'payment-flow-canceled':
      showStatus('Payment cancelled by buyer.', 'info');
      break;

    case 'payment-flow-error':
      showStatus(`Payment error: ${message || 'Unknown error'}`, 'error');
      break;

    default:
      break;
  }
});
