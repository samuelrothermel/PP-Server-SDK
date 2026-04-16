/**
 * JS SDK v6 — Card Eligibility Testing (BCDC & ACDC)
 *
 * Purpose:
 *   Probe isEligible() and getDetails() for every known/candidate key for
 *   Advanced Card Fields (ACDC) and Basic / Branded Card Fields (BCDC).
 *
 * Flow:
 *   1. User sets currencyCode, countryCode, amount, pageType in the config panel
 *   2. createInstance() → findEligibleMethods() with those params
 *   3. Each candidate key is passed to isEligible() and the result logged
 *   4. Any key returning true → getDetails() is called and displayed
 */

// ── Candidate key lists ───────────────────────────────────────────────────────

const ACDC_CANDIDATES = [
  'advanced_cards',   // confirmed in thread; most likely key
  'advanced-cards',   // hyphen variant
  'acdc',             // abbreviation variant
  'card_fields',      // field-oriented name
  'cards',            // generic
  'hosted_fields',    // older SDK nomenclature
];

const BCDC_CANDIDATES = [
  'bcdc',
  'branded_cards',
  'standard_cards',
  'debit_credit',
  'card',
  'credit_card',
  'inline_guest_checkout',
  'card_fields_bcdc',
];

const ALL_KNOWN_KEYS = [
  'paypal',
  'paylater',
  'venmo',
  'applepay',
  'googlepay',
  'card',
  'credit',
  'debit',
];

// ── DOM refs ──────────────────────────────────────────────────────────────────

const runBtn        = document.getElementById('run-btn');
const statusArea    = document.getElementById('status-area');
const rawLogContent = document.getElementById('raw-log-content');
const rawLogPanel   = document.getElementById('raw-log-panel');

const acdcTbody = document.getElementById('acdc-rows');
const bcdcTbody = document.getElementById('bcdc-rows');
const allTbody  = document.getElementById('all-rows');

// ── Helpers ───────────────────────────────────────────────────────────────────

function showStatus(message, type = 'info') {
  statusArea.textContent = message;
  statusArea.className = `status-area ${type}`;
}

function clearStatus() {
  statusArea.textContent = '';
  statusArea.className = 'status-area';
}

function makeBadge(value) {
  if (value === true)  return '<span class="badge-true">true</span>';
  if (value === false) return '<span class="badge-false">false</span>';
  return '<span class="badge-pending">—</span>';
}

function buildRow(key, eligible, details) {
  const tr = document.createElement('tr');

  const keyCell = document.createElement('td');
  keyCell.innerHTML = `<span class="candidate-key">"${key}"</span>`;

  const eligibleCell = document.createElement('td');
  eligibleCell.innerHTML = makeBadge(eligible);

  const detailsCell = document.createElement('td');
  if (eligible === true && details !== null) {
    const pre = document.createElement('pre');
    pre.className = 'details-block';
    pre.style.display = 'block';
    pre.textContent = JSON.stringify(details, null, 2);
    detailsCell.appendChild(pre);
  } else if (eligible === true && details === null) {
    detailsCell.innerHTML = '<span style="color:#888;font-size:0.85em;">no details returned</span>';
  } else {
    detailsCell.innerHTML = '<span style="color:#ccc;font-size:0.85em;">—</span>';
  }

  tr.appendChild(keyCell);
  tr.appendChild(eligibleCell);
  tr.appendChild(detailsCell);
  return tr;
}

function clearTable(tbody) {
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
}

function resetTables() {
  [acdcTbody, bcdcTbody, allTbody].forEach(clearTable);
}

function appendPendingRows(tbody, candidates) {
  candidates.forEach(key => {
    const tr = document.createElement('tr');
    tr.id = `row-${key.replace(/[^a-z0-9]/gi, '_')}`;
    tr.innerHTML = `
      <td><span class="candidate-key">"${key}"</span></td>
      <td><span class="badge-pending">…</span></td>
      <td><span style="color:#ccc;font-size:0.85em;">—</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateRow(tbody, key, eligible, details) {
  const id = `row-${key.replace(/[^a-z0-9]/gi, '_')}`;
  const existing = document.getElementById(id);
  const newRow = buildRow(key, eligible, details);
  newRow.id = id;
  if (existing) {
    tbody.replaceChild(newRow, existing);
  } else {
    tbody.appendChild(newRow);
  }
}

// ── Probe a single key ────────────────────────────────────────────────────────

function probeKey(paymentMethods, key) {
  let eligible = false;
  let details = null;

  try {
    eligible = paymentMethods.isEligible(key);
  } catch (e) {
    console.warn(`[v6][eligibility] isEligible("${key}") threw:`, e);
    eligible = false;
  }

  if (eligible) {
    try {
      details = paymentMethods.getDetails(key);
      console.log(`[v6][eligibility] getDetails("${key}"):`, details);
    } catch (e) {
      console.warn(`[v6][eligibility] getDetails("${key}") threw:`, e);
    }
  }

  console.log(`[v6][eligibility] isEligible("${key}"):`, eligible);
  return { eligible, details };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runTests() {
  if (!window.paypal) {
    showStatus('PayPal JS SDK v6 failed to load.', 'error');
    return;
  }

  runBtn.disabled = true;
  showStatus('Initializing SDK instance…', 'info');
  resetTables();

  // Pre-populate all tables with "loading" rows
  appendPendingRows(acdcTbody, ACDC_CANDIDATES);
  appendPendingRows(bcdcTbody, BCDC_CANDIDATES);
  appendPendingRows(allTbody,  ALL_KNOWN_KEYS);

  const currencyCode = document.getElementById('currency-code').value;
  const countryCode  = document.getElementById('country-code').value;
  const amount       = document.getElementById('amount').value.trim() || '100.00';
  const pageType     = document.getElementById('page-type').value;

  try {
    const sdkInstance = await window.paypal.createInstance({
      clientId: CLIENT_ID,
      components: ['paypal-payments'],
      pageType,
      locale: 'en-US',
      clientMetadataId: crypto.randomUUID(),
    });
    console.log('[v6][eligibility] SDK instance created');

    showStatus('Calling findEligibleMethods()…', 'info');

    const paymentMethods = await sdkInstance.findEligibleMethods({
      currencyCode,
      countryCode,
      amount,
    });

    console.log('[v6][eligibility] findEligibleMethods() response object:', paymentMethods);

    // Dump raw response for display — the object may not be plain-JSON-serialisable,
    // so we extract what we can.
    let rawDump = {};
    try {
      rawDump = JSON.parse(JSON.stringify(paymentMethods));
    } catch (_) {
      rawDump = { note: 'Response object is not fully JSON-serialisable. Check browser console for full output.' };
    }
    rawLogContent.textContent = JSON.stringify(rawDump, null, 2);
    rawLogPanel.open = true;

    showStatus('Running isEligible() probes…', 'info');

    let anyTrue = false;

    // ── ACDC candidates ──
    ACDC_CANDIDATES.forEach(key => {
      const { eligible, details } = probeKey(paymentMethods, key);
      updateRow(acdcTbody, key, eligible, details);
      if (eligible) anyTrue = true;
    });

    // ── BCDC candidates ──
    BCDC_CANDIDATES.forEach(key => {
      const { eligible, details } = probeKey(paymentMethods, key);
      updateRow(bcdcTbody, key, eligible, details);
      if (eligible) anyTrue = true;
    });

    // ── All known keys ──
    ALL_KNOWN_KEYS.forEach(key => {
      const { eligible, details } = probeKey(paymentMethods, key);
      updateRow(allTbody, key, eligible, details);
      if (eligible) anyTrue = true;
    });

    if (anyTrue) {
      showStatus('Done — one or more keys returned true. See results below.', 'success');
    } else {
      showStatus('Done — no keys returned true for this configuration.', 'info');
    }

  } catch (err) {
    console.error('[v6][eligibility] Error:', err);
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener('click', runTests);
