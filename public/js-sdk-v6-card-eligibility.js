/**
 * JS SDK v6 — Card Eligibility Testing
 * Tests isEligible() keys for Guest (BCDC) and Advanced (ACDC) card fields.
 */

const GUEST_CANDIDATES = [
  'card',        // BCDC — the only valid key per SDK FundingSource types
];

const ADVANCED_CANDIDATES = [
  'advanced_cards', // ACDC — correct key; requires merchant account enablement
];

const runBtn = document.getElementById('run-btn');

function showStatus(msg, type = 'info') {
  const el = document.getElementById('status-area');
  el.textContent = msg;
  el.className = `status-area ${type}`;
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

  const guestBody = document.getElementById('guest-rows');
  const advBody   = document.getElementById('advanced-rows');

  if (!guestBody || !advBody) {
    console.error('[v6] DOM elements not found. guest-rows:', guestBody, 'advanced-rows:', advBody);
    showStatus('Page error: result table elements not found. Check console.', 'error');
    return;
  }

  runBtn.disabled = true;
  guestBody.innerHTML = '';
  advBody.innerHTML = '';
  showStatus('Initializing SDK…', 'info');

  try {
    const sdkInstance = await window.paypal.createInstance({
      clientId: CLIENT_ID,
      components: ['paypal-payments', 'card-payments', 'advanced-card-payments'],
      pageType: 'checkout',
      locale: 'en-US',
      clientMetadataId: crypto.randomUUID(),
    });

    showStatus('Calling findEligibleMethods()…', 'info');
    const pm = await sdkInstance.findEligibleMethods({ currency: 'USD', paymentFlow: 'ONE_TIME_PAYMENT' });
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
