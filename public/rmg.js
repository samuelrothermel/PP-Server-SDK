/**
 * Real-Money Gaming (RMG) demo page
 * Covers: PayPal deposit, Venmo deposit, Payouts withdrawal, vault/MIT
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

const Utils = {
  showMessage(message, type = 'info') {
    const container = document.getElementById('message-container');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => div.remove(), 6000);
  },

  clearMessages() {
    document.getElementById('message-container').innerHTML = '';
  },

  showResult(resultBoxId, jsonId, data) {
    const box = document.getElementById(resultBoxId);
    document.getElementById(jsonId).textContent = JSON.stringify(data, null, 2);
    box.style.display = 'block';
  },

  hideResult(resultBoxId) {
    const box = document.getElementById(resultBoxId);
    if (box) box.style.display = 'none';
  },

  async apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || res.statusText);
    return data;
  },

  async apiGet(path) {
    const res = await fetch(path);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || res.statusText);
    return data;
  },

  getVal(id) {
    return document.getElementById(id)?.value?.trim() || '';
  },

  randomBatchId() {
    return `rmg_batch_${Date.now()}`;
  },
};

// ─── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  // Match button by its onclick attribute content
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`'${name}'`)) btn.classList.add('active');
  });
}

// ─── Main RMG namespace ────────────────────────────────────────────────────────

const RMG = {

  // ── PayPal Deposit ──────────────────────────────────────────────────────────

  initPayPalButton() {
    if (!window.paypal) {
      Utils.showMessage('PayPal SDK not loaded — please refresh.', 'error');
      return;
    }

    const btn = window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,

      style: { label: 'pay', color: 'blue', shape: 'rect', height: 50 },

      createOrder: async () => {
        Utils.clearMessages();
        Utils.showMessage('Creating deposit order…', 'info');

        const amount = Utils.getVal('pp-amount') || '25.00';
        const customerId = Utils.getVal('pp-player-id') || `rmg_player_${Date.now()}`;
        const vault = document.getElementById('pp-vault')?.checked;

        try {
          const order = await Utils.apiPost('/api/checkout-orders', {
            source: 'paypal',
            totalAmount: amount,
            customerId,
            vault,
            intentType: 'CAPTURE',
            description: 'RMG Deposit',
            shippingPreference: 'NO_SHIPPING',
            userAction: 'PAY_NOW',
          });
          Utils.showMessage(`Order created: ${order.id}`, 'info');
          return order.id;
        } catch (err) {
          Utils.showMessage(`Create order failed: ${err.message}`, 'error');
          throw err;
        }
      },

      onApprove: async (data) => {
        Utils.clearMessages();
        Utils.showMessage('Capturing deposit…', 'info');
        try {
          const capture = await Utils.apiPost(`/api/orders/${data.orderID}/capture`, {});
          Utils.showMessage('Deposit captured successfully!', 'success');
          Utils.showResult('pp-result', 'pp-result-json', capture);

          // Persist vault customer ID if returned
          const vaultId =
            capture?.payment_source?.paypal?.attributes?.vault?.id ||
            capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
          if (vaultId) {
            const ids = JSON.parse(localStorage.getItem('rmg_customer_ids') || '[]');
            const customerId = Utils.getVal('pp-player-id') || 'unknown';
            if (!ids.includes(customerId)) { ids.push(customerId); localStorage.setItem('rmg_customer_ids', JSON.stringify(ids)); }
          }
        } catch (err) {
          Utils.showMessage(`Capture failed: ${err.message}`, 'error');
        }
      },

      onCancel() { Utils.showMessage('Deposit cancelled.', 'info'); },
      onError(err) {
        console.error('PayPal button error:', err);
        Utils.showMessage(`PayPal error: ${err.message || 'Unknown error'}`, 'error');
      },
    });

    if (btn.isEligible()) {
      btn.render('#paypal-button-container');
    } else {
      Utils.showMessage('PayPal button not eligible in this environment.', 'info');
    }
  },

  // ── Venmo Deposit ───────────────────────────────────────────────────────────

  initVenmoButton() {
    if (!window.paypal) return;

    const btn = window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.VENMO,
      enableVenmoSandbox: true,

      style: { label: 'pay', color: 'blue', shape: 'rect', height: 50 },

      // Venmo requires payment_source.venmo in the order payload; use actions.order.create
      // so the JS SDK handles the proper Venmo order structure client-side.
      createOrder: (data, actions) => {
        Utils.clearMessages();
        Utils.showMessage('Creating Venmo deposit order…', 'info');

        const amount     = Utils.getVal('venmo-amount') || '10.00';
        const customerId = Utils.getVal('venmo-player-id') || `rmg_player_${Date.now()}`;

        return actions.order.create({
          purchase_units: [{
            reference_id: 'RMG_VENMO_DEPOSIT',
            amount: { currency_code: 'USD', value: amount },
          }],
          payment_source: {
            venmo: {
              attributes: { customer: { id: customerId } },
              experience_context: {
                return_url: `${window.location.origin}/rmg`,
                cancel_url: `${window.location.origin}/rmg`,
                shipping_preference: 'NO_SHIPPING',
              },
            },
          },
        });
      },

      onApprove: async (data) => {
        Utils.clearMessages();
        Utils.showMessage('Capturing Venmo deposit…', 'info');
        try {
          const capture = await Utils.apiPost(`/api/venmo/orders/${data.orderID}/capture`, {});
          Utils.showMessage('Venmo deposit captured!', 'success');
          Utils.showResult('venmo-result', 'venmo-result-json', capture);
        } catch (err) {
          Utils.showMessage(`Venmo capture failed: ${err.message}`, 'error');
        }
      },

      onCancel() { Utils.showMessage('Venmo deposit cancelled.', 'info'); },
      onError(err) {
        console.error('Venmo error:', err);
        Utils.showMessage(`Venmo error: ${err.message || 'Unknown error'}`, 'error');
      },
    });

    if (btn.isEligible()) {
      btn.render('#venmo-button-container');
    } else {
      document.getElementById('venmo-button-container').innerHTML =
        '<p style="color:#888; font-style:italic;">Venmo is not available in this environment. Test on mobile or check sandbox settings.</p>';
    }
  },

  // ── Withdrawal (Payouts API) ────────────────────────────────────────────────

  async sendWithdrawal() {
    Utils.clearMessages();

    const recipientId = Utils.getVal('payout-paypal-id');
    const amount      = Utils.getVal('payout-amount');
    const note        = Utils.getVal('payout-note') || 'Your winnings withdrawal';

    if (!recipientId) { Utils.showMessage('Enter the recipient PayPal ID.', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { Utils.showMessage('Enter a valid withdrawal amount.', 'error'); return; }

    Utils.showMessage('Sending withdrawal…', 'info');

    try {
      const result = await Utils.apiPost('/api/payouts/create', {
        senderBatchId: Utils.randomBatchId(),
        emailSubject: 'Your RMG withdrawal',
        emailMessage: note,
        items: [{ recipientId, amount, note }],
      });

      Utils.showMessage('Withdrawal sent!', 'success');
      Utils.showResult('withdrawal-result', 'withdrawal-result-json', result);

      const batchIdEl = document.getElementById('payout-batch-id-display');
      if (batchIdEl) {
        batchIdEl.value =
          result?.batch_header?.payout_batch_id ||
          result?.payout_batch_id ||
          '';
      }
    } catch (err) {
      Utils.showMessage(`Withdrawal failed: ${err.message}`, 'error');
    }
  },

  async checkWithdrawalStatus() {
    Utils.clearMessages();
    const batchId = document.getElementById('payout-batch-id-display')?.value?.trim();
    if (!batchId) { Utils.showMessage('No batch ID available. Send a withdrawal first.', 'error'); return; }

    Utils.showMessage('Fetching payout status…', 'info');
    try {
      const status = await Utils.apiGet(`/api/payouts/${batchId}`);
      Utils.showResult('payout-status-result', 'payout-status-json', status);
      Utils.showMessage('Status loaded.', 'success');
    } catch (err) {
      Utils.showMessage(`Status check failed: ${err.message}`, 'error');
    }
  },

  // ── Vault — Save Without Purchase ──────────────────────────────────────────
  // Uses the SDK's createVaultSetupToken callback pattern (not createOrder).
  // The SDK calls createVaultSetupToken first, then shows the PayPal flow,
  // then calls onApprove with the vaultSetupToken — no purchase is made.

  initVaultButton() {
    if (!window.paypal) return;

    const btn = window.paypal.Buttons({
      style: { label: 'pay', color: 'gold', shape: 'rect', height: 50 },

      createVaultSetupToken: async () => {
        Utils.clearMessages();
        Utils.showMessage('Creating vault setup token…', 'info');

        const customerId = Utils.getVal('vault-player-id') || `rmg_player_${Date.now()}`;

        try {
          const setupToken = await Utils.apiPost('/api/vault/setup-token', {
            paymentSource: 'paypal',
            customerId,
          });
          Utils.showMessage(`Setup token created: ${setupToken.id}`, 'info');
          return setupToken.id;
        } catch (err) {
          Utils.showMessage(`Setup token failed: ${err.message}`, 'error');
          throw err;
        }
      },

      onApprove: async (data) => {
        Utils.clearMessages();
        Utils.showMessage('Exchanging setup token for payment token…', 'info');
        try {
          const token = await Utils.apiPost(`/api/vault/payment-token/${data.vaultSetupToken}`, {});

          Utils.showMessage('Payment method saved!', 'success');
          Utils.showResult('vault-save-result', 'vault-save-result-json', token);

          const customerId = Utils.getVal('vault-player-id') || token?.customer?.id;
          if (customerId) {
            const ids = JSON.parse(localStorage.getItem('rmg_customer_ids') || '[]');
            if (!ids.includes(customerId)) { ids.push(customerId); localStorage.setItem('rmg_customer_ids', JSON.stringify(ids)); }
            document.getElementById('returning-player-id').value = customerId;
          }
        } catch (err) {
          Utils.showMessage(`Token exchange failed: ${err.message}`, 'error');
        }
      },

      onCancel() { Utils.showMessage('Vault setup cancelled.', 'info'); },
      onError(err) {
        console.error('Vault button error:', err);
        Utils.showMessage(`Vault error: ${err.message || 'Unknown error'}`, 'error');
      },
    });

    if (btn.isEligible()) btn.render('#vault-button-container');
  },

  // ── Vault — Load tokens for returning player ────────────────────────────────

  async loadVaultTokens() {
    Utils.clearMessages();
    const customerId = Utils.getVal('returning-player-id');
    if (!customerId) { Utils.showMessage('Enter a Customer ID to load saved methods.', 'error'); return; }

    Utils.showMessage('Loading saved payment methods…', 'info');

    const list = document.getElementById('vault-token-list');
    list.innerHTML = '<li class="empty-state">Loading…</li>';

    try {
      const result = await Utils.apiPost('/api/vault/customers', {
        customerIds: [customerId],
      });

      const tokens = result?.payment_tokens || result?.tokens || result || [];
      if (!tokens.length) {
        list.innerHTML = '<li class="empty-state">No saved payment methods found for this Customer ID.</li>';
        Utils.showMessage('No tokens found.', 'info');
        return;
      }

      list.innerHTML = '';
      tokens.forEach(token => {
        const method = token.payment_source?.paypal || token.payment_source?.card || {};
        const label  = method.email_address || (method.brand ? `${method.brand} ••••${method.last_digits}` : 'PayPal Account');

        const li = document.createElement('li');
        li.innerHTML = `
          <div class="token-info">
            <strong>${label}</strong>
            <div class="token-id">Token ID: ${token.id}</div>
          </div>
          <button class="use-token-btn" data-token-id="${token.id}">Deposit</button>
        `;
        li.querySelector('.use-token-btn').addEventListener('click', () => {
          RMG.chargeWithToken(token.id);
        });
        list.appendChild(li);
      });

      Utils.showMessage(`Loaded ${tokens.length} saved method(s).`, 'success');
    } catch (err) {
      list.innerHTML = '<li class="empty-state">Failed to load tokens.</li>';
      Utils.showMessage(`Load failed: ${err.message}`, 'error');
    }
  },

  // ── Vault — Charge with stored token (MIT) ──────────────────────────────────

  async chargeWithToken(tokenId) {
    Utils.clearMessages();
    const amount = Utils.getVal('returning-amount') || '25.00';

    Utils.showMessage(`Charging token ${tokenId} for $${amount}…`, 'info');
    try {
      const order = await Utils.apiPost('/api/vault/recurring-order', {
        paymentTokenId: tokenId,
        amount,
      });
      Utils.showMessage('Returning deposit completed!', 'success');
      Utils.showResult('mit-result', 'mit-result-json', order);
    } catch (err) {
      Utils.showMessage(`Deposit failed: ${err.message}`, 'error');
    }
  },
};

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  console.log('RMG demo page loaded');

  if (window.paypal) {
    RMG.initPayPalButton();
    RMG.initVenmoButton();
    RMG.initVaultButton();
  } else {
    ['paypal-button-container', 'venmo-button-container', 'vault-button-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p style="color:#c00;">PayPal SDK failed to load. Please refresh.</p>';
    });
  }

  // Pre-populate returning customer id from localStorage if available
  const savedIds = JSON.parse(localStorage.getItem('rmg_customer_ids') || '[]');
  if (savedIds.length) {
    const returningEl = document.getElementById('returning-player-id');
    if (returningEl && !returningEl.value) returningEl.value = savedIds[savedIds.length - 1];
  }
});

// Expose for inline onclick handlers
window.RMG       = RMG;
window.switchTab = switchTab;
