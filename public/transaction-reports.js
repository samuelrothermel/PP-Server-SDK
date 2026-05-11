// State
let lastRawResponse = null;
let currentPage = 1;
let totalPages = 1;

// Disbursement transaction type codes
const DISBURSEMENT_TYPES = new Set(['T0100', 'T0106', 'T0400', 'T1106']);

const TYPE_LABELS = {
  T0001: 'PayPal payment',
  T0002: 'Currency conversion',
  T0007: 'Payment received',
  T0100: 'Bank deposit',
  T0106: 'Bank transfer',
  T0200: 'Reversal',
  T0400: 'Withdrawal',
  T1106: 'Bank reversal',
  T1107: 'Refund',
};

const STATUS_LABELS = {
  S: 'Success',
  P: 'Pending',
  V: 'Reversed',
  F: 'Failed',
  D: 'Denied',
};

// Set default date range to last 7 days on load
document.addEventListener('DOMContentLoaded', () => {
  setDateRange(7);

  document.querySelectorAll('.preset-btn[data-days]').forEach(btn => {
    btn.addEventListener('click', () => setDateRange(parseInt(btn.dataset.days, 10)));
  });

  document.querySelector('.disbursement-preset').addEventListener('click', () => {
    setDateRange(30);
    document.getElementById('transaction-type').value = 'T0106';
  });
});

function setDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  document.getElementById('end-date').value = toLocalISOString(end);
  document.getElementById('start-date').value = toLocalISOString(start);
}

function toLocalISOString(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toPayPalDate(localDt) {
  if (!localDt) return null;
  return new Date(localDt).toISOString();
}

function buildParams(page = 1) {
  const params = {};
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  const type = document.getElementById('transaction-type').value;
  const status = document.getElementById('transaction-status').value;
  const currency = document.getElementById('currency-code').value;
  const pageSize = document.getElementById('page-size').value;

  if (!start || !end) {
    showMessage('Please select a start and end date.', 'error');
    return null;
  }

  params.start_date = toPayPalDate(start);
  params.end_date = toPayPalDate(end);
  if (type)     params.transaction_type = type;
  if (status)   params.transaction_status = status;
  if (currency) params.currency_code = currency;
  params.page_size = pageSize;
  params.page = page;
  params.fields = 'all';

  return params;
}

async function searchTransactions(page = 1) {
  const params = buildParams(page);
  if (!params) return;

  currentPage = page;
  setLoading(true);
  clearMessage();
  hideResults();
  hidePanels();

  try {
    const res = await fetch('/api/reports/transactions?' + new URLSearchParams(params));
    const data = await res.json();

    lastRawResponse = data;
    updateRaw(data);

    if (!res.ok) {
      showMessage(data.error || 'API request failed.', 'error');
      return;
    }

    renderResults(data, params);
  } catch (err) {
    showMessage('Network error: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function renderResults(data, params) {
  const txns = data.transaction_details || [];
  const totalItems = data.total_items || 0;
  const pageSize = parseInt(params.page_size, 10);
  totalPages = Math.ceil(totalItems / pageSize) || 1;

  document.getElementById('result-count').textContent = `(${totalItems.toLocaleString()} transactions)`;

  if (txns.length === 0) {
    document.getElementById('empty-state').style.display = 'block';
    return;
  }

  // Stats
  let totalCredit = 0, totalDebit = 0, totalFees = 0;
  txns.forEach(t => {
    const info = t.transaction_info || {};
    const amt = parseFloat(info.transaction_amount?.value || 0);
    const fee = parseFloat(info.fee_amount?.value || 0);
    if (amt > 0) totalCredit += amt;
    else totalDebit += Math.abs(amt);
    totalFees += Math.abs(fee);
  });

  const currency = txns[0]?.transaction_info?.transaction_amount?.currency_code || '';
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-chip credit">
      <div class="chip-label">Total Credits</div>
      <div class="chip-value">${formatAmount(totalCredit, currency)}</div>
    </div>
    <div class="stat-chip debit">
      <div class="chip-label">Total Debits</div>
      <div class="chip-value">${formatAmount(totalDebit, currency)}</div>
    </div>
    <div class="stat-chip">
      <div class="chip-label">Total Fees</div>
      <div class="chip-value">${formatAmount(totalFees, currency)}</div>
    </div>
    <div class="stat-chip">
      <div class="chip-label">Transactions</div>
      <div class="chip-value">${txns.length}</div>
    </div>
  `;

  // Table rows
  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = txns.map(t => {
    const info = t.transaction_info || {};
    const txId = info.transaction_id || '-';
    const date = info.transaction_initiation_date
      ? new Date(info.transaction_initiation_date).toLocaleString()
      : '-';
    const typeCode = info.transaction_event_code || '-';
    const typeLabel = TYPE_LABELS[typeCode] || typeCode;
    const statusCode = info.transaction_status || '-';
    const statusLabel = STATUS_LABELS[statusCode] || statusCode;
    const gross = info.transaction_amount?.value;
    const fee = info.fee_amount?.value;
    const net = info.transaction_amount?.value && info.fee_amount?.value
      ? (parseFloat(gross) + parseFloat(fee)).toFixed(2)
      : gross;
    const cur = info.transaction_amount?.currency_code || '';
    const desc = info.transaction_subject || info.transaction_note || '';
    const isDisbursement = DISBURSEMENT_TYPES.has(typeCode);
    const isCredit = parseFloat(gross || 0) > 0;

    return `<tr>
      <td><span class="tx-id">${txId}</span></td>
      <td style="white-space:nowrap;">${date}</td>
      <td><span class="type-badge ${isDisbursement ? 'type-disbursement' : ''}">${typeCode}</span><br><small style="color:#777;">${typeLabel}</small></td>
      <td><span class="status-badge status-${statusCode}">${statusLabel}</span></td>
      <td class="${isCredit ? 'amount-credit' : 'amount-debit'}">${gross ? formatAmount(gross, '') : '-'}</td>
      <td style="color:#888;">${fee ? formatAmount(fee, '') : '-'}</td>
      <td>${net ? formatAmount(net, '') : '-'}</td>
      <td>${cur}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${desc}">${desc || '-'}</td>
    </tr>`;
  }).join('');

  renderPagination(totalPages);
  document.getElementById('results-content').style.display = 'block';
  document.getElementById('export-btn').style.display = 'inline-block';
}

function renderPagination(total) {
  if (total <= 1) {
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  let html = `<button class="page-btn" onclick="searchTransactions(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Prev</button>`;

  const start = Math.max(1, currentPage - 2);
  const end = Math.min(total, currentPage + 2);
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="searchTransactions(${i})">${i}</button>`;
  }

  html += `<button class="page-btn" onclick="searchTransactions(${currentPage + 1})" ${currentPage === total ? 'disabled' : ''}>Next &raquo;</button>`;
  html += `<span style="font-size:0.82em;color:#888;">Page ${currentPage} of ${total}</span>`;
  document.getElementById('pagination').innerHTML = html;
}

async function getAccountBalance() {
  setLoading(true);
  clearMessage();
  hidePanels();
  hideResults();

  try {
    const res = await fetch('/api/reports/balance');
    const data = await res.json();

    lastRawResponse = data;
    updateRaw(data);

    if (!res.ok) {
      showMessage(data.error || 'Failed to fetch balance.', 'error');
      return;
    }

    const balances = data.balances || [];
    const panel = document.getElementById('balance-panel');
    const content = document.getElementById('balance-content');

    if (balances.length === 0) {
      content.innerHTML = '<p style="color:#888;">No balance data returned.</p>';
    } else {
      content.innerHTML = balances.map(b => `
        <div class="balance-item">
          <div class="bal-label">Available Balance</div>
          <div class="bal-value">${formatAmount(b.available_balance?.value, '')}</div>
          <div class="bal-currency">${b.available_balance?.currency_code || ''}</div>
          ${b.withheld_balance ? `<div class="bal-label" style="margin-top:8px;">Withheld</div><div class="bal-value" style="font-size:1em;">${formatAmount(b.withheld_balance?.value, '')} ${b.withheld_balance?.currency_code}</div>` : ''}
        </div>
      `).join('');
    }

    panel.style.display = 'block';
  } catch (err) {
    showMessage('Network error: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function getDailySummary() {
  const params = buildParams();
  if (!params) return;

  setLoading(true);
  clearMessage();
  hidePanels();
  hideResults();

  try {
    const res = await fetch('/api/reports/summary?' + new URLSearchParams({
      start_date: params.start_date,
      end_date: params.end_date,
    }));
    const data = await res.json();

    lastRawResponse = data;
    updateRaw(data);

    if (!res.ok) {
      showMessage(data.error || 'Failed to fetch summary.', 'error');
      return;
    }

    const days = data.transaction_summaries || [];
    const panel = document.getElementById('summary-panel');
    const content = document.getElementById('summary-content');

    if (days.length === 0) {
      content.innerHTML = '<p style="color:#888;">No summary data for the selected range.</p>';
    } else {
      content.innerHTML = `
        <table class="summary-table">
          <thead>
            <tr><th>Date</th><th>Currency</th><th>Activity</th><th>Credits</th><th>Debits</th><th>Fees</th><th>Net</th></tr>
          </thead>
          <tbody>
            ${days.map(d => `
              <tr>
                <td>${d.date || '-'}</td>
                <td>${d.activity_amount?.currency_code || '-'}</td>
                <td>${formatAmount(d.activity_amount?.value, '')}</td>
                <td class="amount-credit">${formatAmount(d.credit_amount?.value, '')}</td>
                <td class="amount-debit">${formatAmount(d.debit_amount?.value, '')}</td>
                <td style="color:#888;">${formatAmount(d.fee_amount?.value, '')}</td>
                <td style="font-weight:600;">${formatAmount(d.net_amount?.value, '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    panel.style.display = 'block';
  } catch (err) {
    showMessage('Network error: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function exportCSV() {
  const rows = document.querySelectorAll('.reports-table tr');
  if (!rows.length) return;

  const lines = Array.from(rows).map(row =>
    Array.from(row.querySelectorAll('th, td'))
      .map(cell => `"${cell.innerText.replace(/"/g, '""').replace(/\n/g, ' ')}"`)
      .join(',')
  );

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paypal-transactions-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function toggleRaw() {
  const el = document.getElementById('raw-response');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function updateRaw(data) {
  document.getElementById('raw-response').textContent = JSON.stringify(data, null, 2);
}

function formatAmount(value, currency) {
  if (value === undefined || value === null) return '-';
  const n = parseFloat(value);
  return (currency ? currency + ' ' : '') + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setLoading(on) {
  document.getElementById('loading').style.display = on ? 'block' : 'none';
  document.getElementById('search-btn').disabled = on;
}

function showMessage(msg, type) {
  document.getElementById('message-container').innerHTML =
    `<div class="message ${type}">${msg}</div>`;
}

function clearMessage() {
  document.getElementById('message-container').innerHTML = '';
}

function hideResults() {
  document.getElementById('results-content').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('export-btn').style.display = 'none';
  document.getElementById('result-count').textContent = '';
  document.getElementById('stats-row').innerHTML = '';
  document.getElementById('results-tbody').innerHTML = '';
  document.getElementById('pagination').innerHTML = '';
}

function hidePanels() {
  document.getElementById('balance-panel').style.display = 'none';
  document.getElementById('summary-panel').style.display = 'none';
}
