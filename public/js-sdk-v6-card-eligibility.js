/**
 * JS SDK v6 — Card Eligibility Testing
 * Tests isEligible() keys for Guest (BCDC) and Advanced (ACDC) card fields.
 */

const GUEST_CANDIDATES = [
  'card',
  'bcdc',
  'branded_cards',
  'standard_cards',
  'debit_credit',
  'credit_card',
  'inline_guest_checkout',
];

const ADVANCED_CANDIDATES = [
  'advanced_cards',
  'advanced-cards',
  'acdc',
  'card_fields',
  'cards',
  'hosted_fields',
];

const runBtn    = document.getElementById('run-btn');
const statusEl  = document.getElementById('status-area');
const guestBody = document.getElementById('guest-rows');
const advBody   = document.getElementById('advanced-rows');

function showStatus(msg, type = 'info') {
  statusEl.textContent = msg;
  statusEl.className = `status-area ${type}`;
}

function appendResult(tbody, key, eligible, details) {
  const tr = document.createElement('tr');

  const badge = eligible
    ? '<span class="badge-true">true</span>'
    : '<span class="badge-false">false</span>';

  let detailsHtml = '—';
  if (eligible && details) {
    detailsHtml = `<pre class="details-block">${JSON.stringify(details, null, 2)}</pre>`;
  } else if (eligible) {
    detailsHtml = '<em style="color:#888">no details</em>';
  }

  tr.innerHTML = `
    <td><span class="candidate-key">"${key}"</span></td>
    <td>${badge}</td>
    <td>${detailsHtml}</td>
  `;
  tbody.appendChild(tr);
}

async function runTests() {
  if (!window.paypal) {
    showStatus('PayPal JS SDK v6 failed to load.', 'error');
    return;
  }

  runBtn.disabled = true;
  guestBody.innerHTML = '';
  advBody.innerHTML = '';
  showStatus('Initializing SDK…', 'info');

  const currency = document.getElementById('currency-code').value;
  const pageType = document.getElementById('page-type').value;

  try {
    const sdkInstance = await window.paypal.createInstance({
      clientId: CLIENT_ID,
      components: ['paypal-payments'],
      pageType,
      locale: 'en-US',
      clientMetadataId: crypto.randomUUID(),
    });

    showStatus('Calling findEligibleMethods()…', 'info');
    const pm = await sdkInstance.findEligibleMethods({ currency });
    console.log('[v6] findEligibleMethods() object:', pm);

    GUEST_CANDIDATES.forEach(key => {
      let eligible = false;
      let details = null;
      try { eligible = pm.isEligible(key); } catch (_) {}
      if (eligible) { try { details = pm.getDetails(key); } catch (_) {} }
      console.log(`[v6] guest isEligible("${key}"):`, eligible);
      appendResult(guestBody, key, eligible, details);
    });

    ADVANCED_CANDIDATES.forEach(key => {
      let eligible = false;
      let details = null;
      try { eligible = pm.isEligible(key); } catch (_) {}
      if (eligible) { try { details = pm.getDetails(key); } catch (_) {} }
      console.log(`[v6] advanced isEligible("${key}"):`, eligible);
      appendResult(advBody, key, eligible, details);
    });

    showStatus('Done.', 'success');
  } catch (err) {
    console.error('[v6] Error:', err);
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener('click', runTests);
