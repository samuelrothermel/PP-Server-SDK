// BNPL (Buy Now Pay Later) Integration Demo
// Demonstrates PayPal and Pay Later buttons with identical functionality

// Configuration
const BNPLConfig = {
  totalAmount: '260.00',
  currency: 'USD',
};

// Utility Functions
const Utils = {
  getCurrentTotal() {
    const totalElement = document.getElementById('amount-total');
    return totalElement
      ? parseFloat(totalElement.textContent).toFixed(2)
      : BNPLConfig.totalAmount;
  },

  showMessage(message, type = 'success') {
    const resultContainer = document.getElementById('result-message');
    resultContainer.style.display = 'block';
    resultContainer.style.backgroundColor =
      type === 'success' ? '#d4edda' : '#f8d7da';
    resultContainer.style.border =
      type === 'success' ? '1px solid #c3e6cb' : '1px solid #f5c6cb';
    resultContainer.style.color = type === 'success' ? '#155724' : '#721c24';
    resultContainer.innerHTML = message;
  },

  hideMessage() {
    const resultContainer = document.getElementById('result-message');
    resultContainer.style.display = 'none';
  },
};

// PayPal Integration
const PayPalIntegration = {
  /**
   * Create order on the server
   * @param {string} fundingSource - 'paypal' or 'paylater' (both work the same)
   */
  async createOrder(fundingSource) {
    try {
      console.log(`Creating order with funding source: ${fundingSource}`);

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Utils.getCurrentTotal(),
          currency: BNPLConfig.currency,
          fundingSource: fundingSource, // Track which button was clicked
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const orderData = await response.json();
      console.log('Order created:', orderData);
      return orderData.id;
    } catch (error) {
      console.error('Error creating order:', error);
      Utils.showMessage(`Error creating order: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * Capture order on the server
   */
  async captureOrder(orderId) {
    try {
      console.log(`Capturing order: ${orderId}`);

      const response = await fetch(`/api/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to capture order');
      }

      const captureData = await response.json();
      console.log('Order captured:', captureData);
      return captureData;
    } catch (error) {
      console.error('Error capturing order:', error);
      Utils.showMessage(`Error capturing order: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * Initialize PayPal buttons
   */
  initializeButtons() {
    // Check if PayPal SDK is loaded
    if (!window.paypal) {
      console.error('PayPal SDK not loaded');
      Utils.showMessage(
        'PayPal SDK failed to load. Please refresh the page.',
        'error',
      );
      return;
    }

    console.log('Initializing PayPal BNPL buttons...');

    // PayPal Button (funding_source: 'paypal')
    window.paypal
      .Buttons({
        fundingSource: window.paypal.FUNDING.PAYPAL,

        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
        },

        createOrder: async (data, actions) => {
          console.log('PayPal button clicked - createOrder called');
          return await this.createOrder('paypal');
        },

        onApprove: async (data, actions) => {
          console.log('PayPal payment approved:', data);
          Utils.showMessage('Processing payment...', 'success');

          try {
            const captureData = await this.captureOrder(data.orderID);

            // Display success message
            Utils.showMessage(
              `
              <h3 style="margin-top: 0;">✅ Payment Successful!</h3>
              <p><strong>Order ID:</strong> ${data.orderID}</p>
              <p><strong>Payer Email:</strong> ${captureData.payer?.email_address || 'N/A'}</p>
              <p><strong>Amount:</strong> $${Utils.getCurrentTotal()} ${BNPLConfig.currency}</p>
              <p><strong>Status:</strong> ${captureData.status}</p>
              <p style="margin-bottom: 0;"><strong>Funding Source:</strong> PayPal Button</p>
              `,
              'success',
            );
          } catch (error) {
            console.error('Capture failed:', error);
          }
        },

        onError: err => {
          console.error('PayPal button error:', err);
          Utils.showMessage(
            `PayPal error: ${err.message || 'An error occurred during payment'}`,
            'error',
          );
        },

        onCancel: data => {
          console.log('PayPal payment cancelled:', data);
          Utils.showMessage('Payment was cancelled.', 'error');
        },
      })
      .render('#paypal-button-container')
      .catch(err => {
        console.error('Failed to render PayPal button:', err);
        Utils.showMessage('Failed to load PayPal button', 'error');
      });

    // Pay Later Button (funding_source: 'paylater')
    // Note: This button has the same functionality as the PayPal button
    // The separation is for visual/marketing purposes to highlight financing options
    window.paypal
      .Buttons({
        fundingSource: window.paypal.FUNDING.PAYLATER,

        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paylater',
        },

        createOrder: async (data, actions) => {
          console.log('Pay Later button clicked - createOrder called');
          // Same createOrder function - both buttons work identically
          return await this.createOrder('paylater');
        },

        onApprove: async (data, actions) => {
          console.log('Pay Later payment approved:', data);
          Utils.showMessage('Processing payment...', 'success');

          try {
            const captureData = await this.captureOrder(data.orderID);

            // Display success message
            Utils.showMessage(
              `
              <h3 style="margin-top: 0;">✅ Payment Successful!</h3>
              <p><strong>Order ID:</strong> ${data.orderID}</p>
              <p><strong>Payer Email:</strong> ${captureData.payer?.email_address || 'N/A'}</p>
              <p><strong>Amount:</strong> $${Utils.getCurrentTotal()} ${BNPLConfig.currency}</p>
              <p><strong>Status:</strong> ${captureData.status}</p>
              <p style="margin-bottom: 0;"><strong>Funding Source:</strong> Pay Later Button</p>
              <p style="margin-top: 10px; font-size: 0.9em; color: #666;"><em>Note: Both buttons provide access to the same PayPal experience. Pay Later eligibility is determined by PayPal based on buyer qualifications.</em></p>
              `,
              'success',
            );
          } catch (error) {
            console.error('Capture failed:', error);
          }
        },

        onError: err => {
          console.error('Pay Later button error:', err);
          Utils.showMessage(
            `Pay Later error: ${err.message || 'An error occurred during payment'}`,
            'error',
          );
        },

        onCancel: data => {
          console.log('Pay Later payment cancelled:', data);
          Utils.showMessage('Payment was cancelled.', 'error');
        },
      })
      .render('#paylater-button-container')
      .catch(err => {
        console.error('Failed to render Pay Later button:', err);
        Utils.showMessage('Failed to load Pay Later button', 'error');
      });

    console.log('BNPL buttons initialized successfully');
  },
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    PayPalIntegration.initializeButtons();
  });
} else {
  PayPalIntegration.initializeButtons();
}

// Export for potential external use
window.BNPLIntegration = {
  config: BNPLConfig,
  utils: Utils,
  paypal: PayPalIntegration,
};
