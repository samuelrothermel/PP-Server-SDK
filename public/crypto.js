/**
 * Pay with Crypto Sandbox Testing Page
 *
 * Flow:
 * 1. POST /api/crypto/orders  → returns PAYER_ACTION_REQUIRED + payer-action link
 * 2. Redirect buyer to sandbox.paypal.com/payment/crypto?token=<ORDER_ID>
 * 3. Buyer connects wallet and approves
 * 4. PayPal auto-captures (ORDER_COMPLETE_ON_PAYMENT_APPROVAL)
 * 5. GET /api/orders/{id} to confirm COMPLETED status
 */

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

  showResponse(containerId, jsonId, data) {
    const container = document.getElementById(containerId);
    const pre = document.getElementById(jsonId);
    pre.textContent = JSON.stringify(data, null, 2);
    container.style.display = 'block';
  },
};

const CryptoFlow = {
  currentOrderId: null,

  async createOrder() {
    Utils.clearMessages();
    Utils.showMessage('Creating crypto order...', 'info');

    const amount = document.getElementById('payment-amount').value || '10.00';
    const btn = document.getElementById('create-order-btn');
    btn.disabled = true;

    try {
      const givenName = document.getElementById('given-name').value.trim() || 'Test';
      const surname = document.getElementById('surname').value.trim() || 'Buyer';
      const countryCode = document.getElementById('country-code').value.trim().toUpperCase() || 'US';

      const response = await fetch('/api/crypto/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: amount, givenName, surname, countryCode }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      const order = await response.json();
      console.log('Crypto order created:', order);

      this.currentOrderId = order.id;

      // Auto-fill the order ID field for Step 2
      document.getElementById('order-id-input').value = order.id;

      // Store in localStorage for Orders dashboard
      const stored = JSON.parse(localStorage.getItem('recentOrderIds') || '[]');
      stored.unshift({ id: order.id, timestamp: new Date().toISOString() });
      localStorage.setItem('recentOrderIds', JSON.stringify(stored.slice(0, 10)));

      Utils.showResponse('create-order-response', 'create-order-json', order);

      // Extract and display the payer-action link
      const payerActionLink = order.links?.find(l => l.rel === 'payer-action');
      if (payerActionLink) {
        const section = document.getElementById('payer-action-section');
        const link = document.getElementById('payer-action-link');
        link.href = payerActionLink.href;
        section.style.display = 'block';
        Utils.showMessage(
          `✅ Order created (${order.id}). Status: ${order.status}. Click "Open Crypto Payment Page" to complete payment.`,
          'success',
        );
      } else {
        Utils.showMessage(
          `Order created (${order.id}). Status: ${order.status}. No payer-action link found — check console.`,
          'info',
        );
      }
    } catch (err) {
      console.error('Crypto order creation failed:', err);
      Utils.showMessage(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  },

  async getOrderStatus() {
    Utils.clearMessages();

    const orderId =
      document.getElementById('order-id-input').value.trim() ||
      this.currentOrderId;

    if (!orderId) {
      Utils.showMessage('Enter an Order ID first (or create an order above).', 'error');
      return;
    }

    Utils.showMessage('Fetching order status...', 'info');
    const btn = document.getElementById('get-order-btn');
    btn.disabled = true;

    try {
      // Use the existing orders fetch endpoint
      const response = await fetch('/api/orders/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [{ id: orderId }] }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const order = data.orders?.[0];

      if (!order) {
        throw new Error('Order not found in response');
      }

      console.log('Order status:', order);
      Utils.showResponse('get-order-response', 'get-order-json', order);

      const status = order.status || order.error;
      const statusType = order.status === 'COMPLETED' ? 'success' : 'info';
      Utils.showMessage(`Order ${orderId} — Status: ${status}`, statusType);
    } catch (err) {
      console.error('Get order status failed:', err);
      Utils.showMessage(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  },
};

// Expose for inline onclick handlers
window.CryptoFlow = CryptoFlow;

document.addEventListener('DOMContentLoaded', () => {
  console.log('₿ Pay with Crypto Sandbox Testing Page Loaded');
});
