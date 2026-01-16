// Express Checkout JavaScript - PayPal, Pay Later, Venmo, Google Pay, Apple Pay + Card

// Configuration and State
const CheckoutConfig = {
  currentCustomerId: null,
  hasPaymentMethods: false,
  totalAmount: '100.00',
};

// Utility Functions
const Utils = {
  getCurrentTotal() {
    const totalElement = document.getElementById('amount-total');
    return totalElement
      ? parseFloat(totalElement.textContent).toFixed(2)
      : '100.00';
  },

  updateTotal() {
    const cartTotal = parseFloat(
      document.getElementById('cart-total').textContent
    );
    const shippingAmount = parseFloat(
      document.getElementById('shipping-amount').textContent
    );
    const total = (cartTotal + shippingAmount).toFixed(2);
    document.getElementById('amount-total').textContent = total;
    CheckoutConfig.totalAmount = total;
    return total;
  },

  showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'block';
    }
  },

  hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'none';
    }
  },

  showResult(message, isSuccess = true) {
    const resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = `
      <div class="result ${isSuccess ? 'success' : 'error'}">
        <h3>${isSuccess ? '✓' : '✗'} ${message}</h3>
      </div>
    `;
    resultContainer.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};

// Shipping Information Helpers
const ShippingInfo = {
  getShippingData() {
    return {
      name: {
        full_name: `${document.getElementById('shipping-first-name').value} ${
          document.getElementById('shipping-last-name').value
        }`,
      },
      address: {
        address_line_1: document.getElementById('shipping-address-1').value,
        address_line_2:
          document.getElementById('shipping-address-2').value || undefined,
        admin_area_2: document.getElementById('shipping-city').value,
        admin_area_1: document.getElementById('shipping-state').value,
        postal_code: document.getElementById('shipping-postal-code').value,
        country_code: document.getElementById('shipping-country').value,
      },
      email_address: document.getElementById('shipping-email').value,
      phone_number: document.getElementById('shipping-phone').value,
    };
  },

  getBillingAddress() {
    const sameAsShipping = document.getElementById('same-as-shipping').checked;

    if (sameAsShipping) {
      return {
        address_line_1: document.getElementById('shipping-address-1').value,
        address_line_2:
          document.getElementById('shipping-address-2').value || undefined,
        admin_area_2: document.getElementById('shipping-city').value,
        admin_area_1: document.getElementById('shipping-state').value,
        postal_code: document.getElementById('shipping-postal-code').value,
        country_code: document.getElementById('shipping-country').value,
      };
    } else {
      return {
        address_line_1: document.getElementById('billing-address-1').value,
        address_line_2:
          document.getElementById('billing-address-2').value || undefined,
        admin_area_2: document.getElementById('billing-city').value,
        admin_area_1: document.getElementById('billing-state').value,
        postal_code: document.getElementById('billing-postal-code').value,
        country_code: document.getElementById('billing-country').value,
      };
    }
  },
};

// Order Creation Helper
async function createOrder(paymentSource = null) {
  const orderData = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: Utils.getCurrentTotal(),
        },
        shipping: ShippingInfo.getShippingData(),
      },
    ],
  };

  if (paymentSource) {
    orderData.payment_source = paymentSource;
  }

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });

  const order = await response.json();
  return order.id;
}

// PayPal Button Stack (with all express methods in one container)
// This creates a horizontal stack with PayPal, Pay Later, Venmo
if (window.paypal) {
  const expressButtons = window.paypal.Buttons({
    style: {
      layout: 'horizontal',
      color: 'gold',
      shape: 'rect',
      height: 45,
    },
    createOrder: async () => {
      return await createOrder();
    },
    onApprove: async data => {
      try {
        const response = await fetch(`/api/orders/${data.orderID}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const orderData = await response.json();
        Utils.showResult('Payment completed successfully!', true);
        console.log('Payment capture result:', orderData);
      } catch (error) {
        Utils.showResult('Payment failed. Please try again.', false);
        console.error('Payment capture error:', error);
      }
    },
    onError: err => {
      console.error('Payment button error:', err);
      Utils.showResult('An error occurred. Please try again.', false);
    },
  });

  if (expressButtons.isEligible()) {
    expressButtons.render('#express-paypal-stack');
  }
}

// Google Pay Setup
async function setupGooglePay() {
  if (!window.paypal || !window.paypal.Googlepay) {
    console.warn('Google Pay not available');
    return;
  }

  try {
    const googlepay = window.paypal.Googlepay();
    const config = {
      countryCode: 'US',
      merchantInfo: {
        merchantName: 'Example Merchant',
      },
      transactionInfo: {
        currencyCode: 'USD',
        totalPriceStatus: 'FINAL',
        totalPrice: Utils.getCurrentTotal(),
      },
      buttonOptions: {
        buttonColor: 'default',
        buttonType: 'checkout',
        buttonSizeMode: 'fill',
      },
    };

    await googlepay.config(config);

    const button = googlepay.render('#googlepay-button-container');

    if (button) {
      Utils.showElement('googlepay-button-container');

      button.addEventListener('click', async () => {
        try {
          const paymentData = await googlepay.confirmOrder();

          const orderData = {
            intent: 'CAPTURE',
            payment_source: {
              google_pay: {
                payment_data: paymentData,
              },
            },
            purchase_units: [
              {
                amount: {
                  currency_code: 'USD',
                  value: Utils.getCurrentTotal(),
                },
                shipping: ShippingInfo.getShippingData(),
              },
            ],
          };

          const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
          });

          const order = await response.json();

          const captureResponse = await fetch(
            `/api/orders/${order.id}/capture`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          const captureData = await captureResponse.json();
          Utils.showResult(
            'Payment completed successfully with Google Pay!',
            true
          );
          console.log('Google Pay capture result:', captureData);
        } catch (error) {
          console.error('Google Pay error:', error);
          Utils.showResult(
            'Google Pay payment failed. Please try again.',
            false
          );
        }
      });
    }
  } catch (error) {
    console.error('Google Pay setup error:', error);
  }
}

// Apple Pay Setup
async function setupApplePay() {
  if (!window.paypal || !window.paypal.Applepay) {
    console.warn('Apple Pay not available');
    return;
  }

  try {
    const applepay = window.paypal.Applepay();
    const config = {
      countryCode: 'US',
      currencyCode: 'USD',
      merchantCapabilities: ['supports3DS'],
      supportedNetworks: ['visa', 'mastercard', 'amex', 'discover'],
      requiredBillingContactFields: ['postalAddress'],
      requiredShippingContactFields: [
        'name',
        'postalAddress',
        'phone',
        'email',
      ],
    };

    await applepay.config(config);

    const button = applepay.render('#applepay-button-container', {
      buttonColor: 'black',
      buttonType: 'checkout',
      buttonRadius: 4,
    });

    if (button) {
      Utils.showElement('applepay-button-container');

      button.addEventListener('click', async () => {
        try {
          const paymentRequest = {
            countryCode: 'US',
            currencyCode: 'USD',
            total: {
              label: 'Total',
              amount: Utils.getCurrentTotal(),
              type: 'final',
            },
            requiredBillingContactFields: ['postalAddress'],
            requiredShippingContactFields: [
              'name',
              'postalAddress',
              'phone',
              'email',
            ],
          };

          const paymentData = await applepay.confirmOrder(paymentRequest);

          const orderData = {
            intent: 'CAPTURE',
            payment_source: {
              apple_pay: {
                payment_data: paymentData,
              },
            },
            purchase_units: [
              {
                amount: {
                  currency_code: 'USD',
                  value: Utils.getCurrentTotal(),
                },
              },
            ],
          };

          const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
          });

          const order = await response.json();

          const captureResponse = await fetch(
            `/api/orders/${order.id}/capture`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          const captureData = await captureResponse.json();
          Utils.showResult(
            'Payment completed successfully with Apple Pay!',
            true
          );
          console.log('Apple Pay capture result:', captureData);
        } catch (error) {
          console.error('Apple Pay error:', error);
          Utils.showResult(
            'Apple Pay payment failed. Please try again.',
            false
          );
        }
      });
    }
  } catch (error) {
    console.error('Apple Pay setup error:', error);
  }
}

// Card Fields Setup
let cardField;

async function setupCardFields() {
  if (!window.paypal || !window.paypal.CardFields) {
    console.error('PayPal CardFields not available');
    return;
  }

  try {
    cardField = window.paypal.CardFields({
      createOrder: async () => {
        return await createOrder();
      },
      onApprove: async data => {
        try {
          const response = await fetch(`/api/orders/${data.orderID}/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const orderData = await response.json();
          Utils.showResult('Payment completed successfully with Card!', true);
          console.log('Card capture result:', orderData);
        } catch (error) {
          Utils.showResult('Card payment failed. Please try again.', false);
          console.error('Card capture error:', error);
        }
      },
      onError: err => {
        console.error('Card field error:', err);
        Utils.showResult(
          'An error occurred with the card payment. Please try again.',
          false
        );
      },
    });

    if (cardField.isEligible()) {
      const numberField = cardField.NumberField();
      await numberField.render('#card-number');

      const expiryField = cardField.ExpiryField();
      await expiryField.render('#expiration-date');

      const cvvField = cardField.CVVField();
      await cvvField.render('#cvv');

      const nameField = cardField.NameField();
      await nameField.render('#card-name');

      // Add submit button handler
      document
        .getElementById('card-payment-button')
        .addEventListener('click', async () => {
          try {
            await cardField.submit({
              billingAddress: ShippingInfo.getBillingAddress(),
            });
          } catch (error) {
            console.error('Card submission error:', error);
            Utils.showResult(
              'Card payment failed. Please check your card details.',
              false
            );
          }
        });
    }
  } catch (error) {
    console.error('Card fields setup error:', error);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Shipping option change
  document.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
    radio.addEventListener('change', e => {
      const shippingCost = parseFloat(e.target.value);
      document.getElementById('shipping-amount').textContent =
        shippingCost.toFixed(2);
      Utils.updateTotal();
    });
  });

  // Same as shipping checkbox
  document.getElementById('same-as-shipping').addEventListener('change', e => {
    const billingFields = document.getElementById('billing-address-fields');
    billingFields.style.display = e.target.checked ? 'none' : 'block';
  });

  // Returning user toggle
  document
    .getElementById('toggle-customer-id')
    .addEventListener('change', e => {
      const form = document.getElementById('customer-id-form');
      form.style.display = e.target.checked ? 'block' : 'none';
    });

  // Customer ID form submit
  document
    .getElementById('customer-id-form')
    .addEventListener('submit', async e => {
      e.preventDefault();
      const customerId = document.getElementById('customer-id').value;
      CheckoutConfig.currentCustomerId = customerId;

      try {
        const response = await fetch(
          `/api/vault/payment-tokens?customer_id=${customerId}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        const data = await response.json();

        if (data.payment_tokens && data.payment_tokens.length > 0) {
          CheckoutConfig.hasPaymentMethods = true;
          Utils.showElement('saved-payment-methods-container');
          // Display saved payment methods (implementation can be added here)
          console.log('Saved payment methods:', data.payment_tokens);
        }
      } catch (error) {
        console.error('Error loading payment methods:', error);
      }
    });

  // Initialize payment methods
  setupGooglePay();
  setupApplePay();
  setupCardFields();
});
