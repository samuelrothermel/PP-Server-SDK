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
      tagline: false,
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

// Google Pay Setup (using Google Pay JavaScript SDK)
let googlePayConfig = null;

async function setupGooglePay() {
  try {
    // Check SDK availability
    if (typeof google === 'undefined' || !google.payments) {
      console.warn('Google Pay SDK not loaded');
      return;
    }

    if (!window.paypal || !window.paypal.Googlepay) {
      console.warn('PayPal Googlepay component not available');
      return;
    }

    // Get Google Pay configuration from PayPal
    const googlepayComponent = paypal.Googlepay();
    googlePayConfig = await googlepayComponent.config();

    if (!googlePayConfig.isEligible) {
      console.warn('Google Pay is not eligible');
      return;
    }

    // Create payments client
    const paymentsClient = new google.payments.api.PaymentsClient({
      environment: googlePayConfig.environment || 'TEST',
      paymentDataCallbacks: {
        onPaymentDataChanged: onGooglePaymentDataChanged,
        onPaymentAuthorized: onGooglePaymentAuthorized,
      },
    });

    // Check readiness
    const isReadyToPayRequest = {
      apiVersion: googlePayConfig.apiVersion || 2,
      apiVersionMinor: googlePayConfig.apiVersionMinor || 0,
      allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
      existingPaymentMethodRequired: false,
    };

    const isReadyToPay = await paymentsClient.isReadyToPay(isReadyToPayRequest);

    if (isReadyToPay.result) {
      console.log('Google Pay is ready, creating button...');

      // Create button
      const button = paymentsClient.createButton({
        onClick: onGooglePayButtonClicked,
        allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
        buttonColor: 'default',
        buttonType: 'buy',
        buttonSizeMode: 'fill',
      });

      const container = document.getElementById('googlepay-button-container');
      if (container) {
        container.innerHTML = '';
        container.appendChild(button);

        // Apply styling
        const googlePayButton = container.querySelector('button');
        if (googlePayButton) {
          googlePayButton.style.width = '100%';
          googlePayButton.style.height = '45px';
          googlePayButton.style.borderRadius = '4px';
        }

        container.style.display = 'block';
        Utils.showElement('wallet-buttons-row');
      }
    }
  } catch (error) {
    console.error('Google Pay setup failed:', error);
  }
}

function onGooglePaymentDataChanged(intermediatePaymentData) {
  return new Promise(resolve => {
    let paymentDataRequestUpdate = {};
    paymentDataRequestUpdate.newTransactionInfo = {
      displayItems: [
        {
          label: 'Subtotal',
          type: 'SUBTOTAL',
          price: Utils.getCurrentTotal(),
        },
      ],
      countryCode: 'US',
      currencyCode: 'USD',
      totalPriceStatus: 'FINAL',
      totalPrice: Utils.getCurrentTotal(),
    };
    resolve(paymentDataRequestUpdate);
  });
}

function onGooglePaymentAuthorized(paymentData) {
  return new Promise(async resolve => {
    try {
      console.log('Google Pay payment authorized, processing...', paymentData);
      await processGooglePayPayment(paymentData);
      resolve({ transactionState: 'SUCCESS' });
    } catch (error) {
      console.error('Google Pay payment authorization failed:', error);
      resolve({
        transactionState: 'ERROR',
        error: {
          reason: 'PAYMENT_DATA_INVALID',
          message: 'Payment processing failed',
          intent: 'PAYMENT_AUTHORIZATION',
        },
      });
    }
  });
}

function onGooglePayButtonClicked() {
  if (!googlePayConfig) {
    console.error('Google Pay config not loaded');
    return;
  }

  const paymentsClient = new google.payments.api.PaymentsClient({
    environment: googlePayConfig.environment || 'TEST',
    paymentDataCallbacks: {
      onPaymentDataChanged: onGooglePaymentDataChanged,
      onPaymentAuthorized: onGooglePaymentAuthorized,
    },
  });

  const paymentDataRequest = {
    ...googlePayConfig,
    transactionInfo: {
      countryCode: 'US',
      currencyCode: 'USD',
      totalPriceStatus: 'FINAL',
      totalPrice: Utils.getCurrentTotal(),
    },
    callbackIntents: ['PAYMENT_AUTHORIZATION'],
  };

  paymentsClient.loadPaymentData(paymentDataRequest);
}

async function processGooglePayPayment(paymentData) {
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

  const captureResponse = await fetch(`/api/orders/${order.id}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const captureData = await captureResponse.json();
  Utils.showResult('Payment completed successfully with Google Pay!', true);
  console.log('Google Pay capture result:', captureData);
}

// Apple Pay Setup (using ApplePaySession)
async function setupApplePay() {
  try {
    if (!window.paypal || !window.paypal.Applepay) {
      console.warn('PayPal Applepay component not available');
      return;
    }

    const applepay = paypal.Applepay();
    const config = await applepay.config();

    if (!config) {
      console.warn('Apple Pay config failed');
      return;
    }

    const {
      countryCode,
      currencyCode,
      merchantCapabilities,
      supportedNetworks,
    } = config;

    // Create Apple Pay button element
    const container = document.getElementById('applepay-button-container');
    if (container) {
      container.innerHTML =
        '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en"></apple-pay-button>';

      const applePayButton = document.getElementById('btn-appl');
      if (applePayButton) {
        applePayButton.style.width = '100%';
        applePayButton.style.height = '45px';
        applePayButton.style.borderRadius = '4px';
      }

      container.style.display = 'block';
      Utils.showElement('wallet-buttons-row');

      applePayButton.addEventListener('click', async function () {
        try {
          const paymentRequest = {
            countryCode,
            currencyCode: 'USD',
            merchantCapabilities,
            supportedNetworks,
            requiredBillingContactFields: [
              'name',
              'phone',
              'email',
              'postalAddress',
            ],
            requiredShippingContactFields: [],
            total: {
              label: 'Total',
              amount: Utils.getCurrentTotal(),
              type: 'final',
            },
          };

          const session = new ApplePaySession(4, paymentRequest);

          session.onvalidatemerchant = event => {
            applepay
              .validateMerchant({
                validationUrl: event.validationURL,
              })
              .then(payload => {
                session.completeMerchantValidation(payload.merchantSession);
              })
              .catch(err => {
                console.error('Merchant validation failed:', err);
                session.abort();
              });
          };

          session.onpaymentmethodselected = () => {
            session.completePaymentMethodSelection({
              newTotal: paymentRequest.total,
            });
          };

          session.onpaymentauthorized = async event => {
            try {
              const orderData = {
                intent: 'CAPTURE',
                payment_source: {
                  apple_pay: {
                    payment_data: event.payment.token,
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

              session.completePayment({
                status: window.ApplePaySession.STATUS_SUCCESS,
              });

              Utils.showResult(
                'Payment completed successfully with Apple Pay!',
                true
              );
              console.log('Apple Pay capture result:', captureData);
            } catch (err) {
              console.error('Payment processing failed:', err);
              session.completePayment({
                status: window.ApplePaySession.STATUS_FAILURE,
              });
            }
          };

          session.oncancel = () => {
            console.log('Apple Pay cancelled');
          };

          session.begin();
        } catch (clickError) {
          console.error('Apple Pay session error:', clickError);
          if (clickError.message.includes('insecure document')) {
            alert('Apple Pay requires HTTPS.');
          }
        }
      });
    }
  } catch (error) {
    console.error('Apple Pay setup failed:', error);
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

  // Initialize card fields
  setupCardFields();

  // Initialize Apple Pay if on Apple device
  const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafari =
    /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  if (isAppleDevice && isSafari) {
    if (
      typeof ApplePaySession !== 'undefined' &&
      ApplePaySession?.supportsVersion(4) &&
      ApplePaySession?.canMakePayments()
    ) {
      // Wait for PayPal SDK to load
      const checkPayPal = setInterval(() => {
        if (window.paypal && window.paypal.Applepay) {
          clearInterval(checkPayPal);
          setupApplePay();
        }
      }, 100);
      setTimeout(() => clearInterval(checkPayPal), 10000);
    }
  }

  // Setup Google Pay when SDK is ready
  if (
    window.paypal &&
    window.paypal.Googlepay &&
    typeof google !== 'undefined'
  ) {
    setupGooglePay();
  }
});
