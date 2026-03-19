/**
 * Venmo Sandbox Testing Page
 * Simplified single-button implementation for Venmo testing
 */

// Utility Functions
const Utils = {
  showMessage(message, type = 'info') {
    const container = document.getElementById('message-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    container.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  },

  clearMessages() {
    const container = document.getElementById('message-container');
    container.innerHTML = '';
  },

  displayOrderDetails(orderData) {
    const detailsContainer = document.getElementById('order-details');
    const jsonPre = document.getElementById('order-json');
    jsonPre.textContent = JSON.stringify(orderData, null, 2);
    detailsContainer.style.display = 'block';
  },
};

// Venmo Payment Button
const VenmoButton = {
  async initialize() {
    if (!window.paypal) {
      console.error('PayPal SDK not loaded');
      Utils.showMessage('PayPal SDK failed to load.', 'error');
      return;
    }

    try {
      const venmoButton = window.paypal.Buttons({
        intent: 'CAPTURE',
        fundingSource: window.paypal.FUNDING.VENMO,
        enableVenmoSandbox: true,

        style: {
          label: 'pay',
          color: 'blue',
          shape: 'rect',
          height: 50,
        },

        onShippingChange: (data, actions) => {
          console.log('Shipping changed:', data);
          Utils.showMessage('Shipping options updated', 'info');
          return true;
        },

        createOrder: (data, actions) => {
          const amount = document.getElementById('payment-amount').value;
          const customerId = `test-${Date.now()}`;

          console.log('Creating Venmo order with client-side SDK');
          Utils.clearMessages();
          Utils.showMessage('Creating order...', 'info');

          return actions.order.create({
            purchase_units: [
              {
                reference_id: 'VENMO_PU',
                amount: {
                  currency_code: 'USD',
                  value: amount,
                },
                shipping: {
                  options: [
                    {
                      id: 'SHIP_1DAY',
                      label: 'One day Shipping',
                      type: 'SHIPPING',
                      selected: true,
                      amount: {
                        value: '0.00',
                        currency_code: 'USD',
                      },
                    },
                    {
                      id: 'SHIP_EXPRESS',
                      label: 'Express Shipping',
                      type: 'SHIPPING',
                      selected: false,
                      amount: {
                        value: '5.00',
                        currency_code: 'USD',
                      },
                    },
                    {
                      id: 'SHIP_PICKUP_1',
                      label: 'Pick up in Store',
                      type: 'PICKUP',
                      selected: false,
                      amount: {
                        value: '0.00',
                        currency_code: 'USD',
                      },
                    },
                    {
                      id: 'SHIP_PICKUP_2',
                      label: 'Pick up in Store 2',
                      type: 'PICKUP',
                      selected: false,
                      amount: {
                        value: '0.00',
                        currency_code: 'USD',
                      },
                    },
                  ],
                },
              },
            ],
            payment_source: {
              venmo: {
                attributes: {
                  customer: {
                    id: customerId,
                  },
                },
                experience_context: {
                  return_url: window.location.origin + '/venmo',
                  cancel_url: window.location.origin + '/venmo',
                  order_update_callback_config: {
                    callback_events: ['SHIPPING_ADDRESS', 'SHIPPING_OPTIONS'],
                    callback_url:
                      'https://p4vvvahfm0.execute-api.us-east-2.amazonaws.com/default/ssc',
                  },
                },
              },
            },
          });
        },

        onApprove: (data, actions) => {
          console.log('Venmo payment approved:', data);
          Utils.clearMessages();
          Utils.showMessage(
            '✅ Venmo payment approved successfully!',
            'success',
          );
          Utils.displayOrderDetails(data);

          // Store order ID in localStorage
          const orderIds = JSON.parse(
            localStorage.getItem('recentOrderIds') || '[]',
          );
          orderIds.unshift(data.orderID);
          localStorage.setItem(
            'recentOrderIds',
            JSON.stringify(orderIds.slice(0, 10)),
          );

          return true;
        },

        onCancel(data) {
          console.log('Venmo payment cancelled:', data);
          Utils.showMessage('Payment was cancelled', 'info');
        },

        onError(err) {
          console.error('Venmo button error:', err);
          Utils.showMessage(
            `Venmo error: ${err.message || 'Unknown error'}`,
            'error',
          );
        },
      });

      if (venmoButton.isEligible()) {
        await venmoButton.render('#venmo-button-container');
        console.log('✅ Venmo button rendered');
      } else {
        venmoButton.updateProps({
          onShippingAddress: () => true,
        });

        if (venmoButton.isEligible()) {
          await venmoButton.render('#venmo-button-container');
          console.log('✅ Venmo button rendered (after updateProps)');
        } else {
          Utils.showMessage(
            'Venmo is not available in this environment. Please test on mobile or check sandbox settings.',
            'info',
          );
          console.warn('Venmo button not eligible');
        }
      }
    } catch (error) {
      console.error('Error initializing Venmo button:', error);
      Utils.showMessage(`Initialization error: ${error.message}`, 'error');
    }
  },
};

// Initialize button when DOM is ready
document.addEventListener('DOMContentLoaded', async function () {
  console.log('🔵 Venmo Sandbox Testing Page Loaded');

  if (window.paypal) {
    await VenmoButton.initialize();
  } else {
    Utils.showMessage(
      'PayPal SDK failed to load. Please refresh the page.',
      'error',
    );
  }
});
