// Wallets-only checkout: Apple Pay and Google Pay

window.onGooglePayLoaded = function () {
  if (!window.GooglePayButtons || !window.Utils) {
    window.googlePayPendingInit = true;
    return;
  }

  window.GooglePayButtons.initialize()
    .then(() => {
      window.Utils.showElement('googlepay-option');
      window.Utils.hideElement('googlepay-button-container');
    })
    .catch(error => {
      console.warn('Google Pay initialization failed:', error);
      window.Utils.hideElement('googlepay-option');
    });
};

const CheckoutConfig = {
  totalAmount: '100.00',
};

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
  },

  showElement(id) {
    const element = document.getElementById(id);
    if (element) {
      if (id === 'googlepay-button-container') {
        element.style.setProperty('display', 'block', 'important');
      } else {
        element.style.display = 'block';
      }
    }
  },

  hideElement(id) {
    const element = document.getElementById(id);
    if (element) {
      if (id === 'googlepay-button-container') {
        element.style.setProperty('display', 'none', 'important');
      } else {
        element.style.display = 'none';
      }
    }
  },

  showPaymentMethodButton(paymentMethod) {
    this.hideElement('applepay-button-container');
    this.hideElement('googlepay-button-container');

    if (paymentMethod === 'applepay') {
      this.showElement('applepay-button-container');
    } else if (paymentMethod === 'googlepay') {
      this.showElement('googlepay-button-container');
    }
  },
};

window.Utils = Utils;

const PayPalIntegration = {
  async createOrder(data) {
    const paymentSource = data?.paymentSource ?? 'paypal';

    const requestBody = {
      source: paymentSource,
      paymentSource,
      totalAmount: Utils.getCurrentTotal(),
      shippingInfo: this.getShippingInfo(),
      cart: [{ sku: '123456789', quantity: '1' }],
    };

    const response = await fetch('/api/checkout-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Order creation failed: ${response.status} - ${errorText}`);
    }

    const orderData = await response.json();
    console.log('Order created:', orderData.id);
    return orderData.id;
  },

  async approveOrder(data) {
    const response = await fetch(`/api/orders/${data.orderID}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Order authorization failed');
    const orderData = await response.json();
    this.displayResults(orderData);
    return orderData;
  },

  getShippingInfo() {
    return {
      firstName: document.getElementById('shipping-first-name')?.value,
      lastName: document.getElementById('shipping-last-name')?.value,
      email: document.getElementById('shipping-email')?.value,
      phone: document.getElementById('shipping-phone')?.value,
      address: {
        addressLine1: document.getElementById('shipping-address-line1')?.value,
        adminArea2: document.getElementById('shipping-admin-area2')?.value,
        adminArea1: document.getElementById('shipping-admin-area1')?.value,
        postalCode: document.getElementById('shipping-postal-code')?.value,
        countryCode: document.getElementById('shipping-country-code')?.value,
      },
    };
  },

  displayResults(orderData) {
    if (orderData?.id) {
      sessionStorage.setItem('lastOrderData', JSON.stringify(orderData));
      window.location.href = '/success';
    }
  },
};

const ApplePayButtons = {
  async initialize() {
    if (
      location.protocol !== 'https:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1'
    ) {
      throw new Error('Apple Pay requires HTTPS connection');
    }

    if (!window.paypal?.Applepay) {
      throw new Error('PayPal SDK or Apple Pay component not loaded');
    }

    if (typeof ApplePaySession === 'undefined') {
      throw new Error('ApplePaySession is not available');
    }

    try {
      if (!ApplePaySession.canMakePayments()) {
        throw new Error('Apple Pay is not supported on this device');
      }
    } catch (e) {
      throw new Error('Apple Pay availability check failed');
    }

    const applepay = window.paypal.Applepay();
    const config = await applepay.config();

    if (!config.isEligible) {
      throw new Error('Apple Pay is not eligible');
    }

    const container = document.getElementById('applepay-button-container');
    if (container) {
      container.innerHTML =
        '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en"></apple-pay-button>';

      const applePayButton = document.getElementById('btn-appl');
      if (applePayButton) {
        applePayButton.style.width = '100%';
        applePayButton.style.height = '40px';
        applePayButton.style.borderRadius = '4px';
        applePayButton.style.margin = '0';
        applePayButton.style.display = 'inline-block';
        applePayButton.style.webkitAppearance = '-apple-pay-button';
        applePayButton.style.cursor = 'pointer';

        applePayButton.addEventListener('click', async () => {
          await this.handleApplePayClick(applepay, config);
        });
      }

      container.style.display = 'none';
    }
  },

  async handleApplePayClick(applepay, config) {
    try {
      const { countryCode, merchantCapabilities, supportedNetworks } = config;

      const paymentRequest = {
        countryCode,
        currencyCode: 'USD',
        merchantCapabilities,
        supportedNetworks,
        requiredBillingContactFields: ['name', 'phone', 'email', 'postalAddress'],
        requiredShippingContactFields: [],
        total: {
          label: 'Demo (Card is not charged)',
          amount: Utils.getCurrentTotal(),
          type: 'final',
        },
      };

      const session = new ApplePaySession(4, paymentRequest);

      session.onvalidatemerchant = event => {
        applepay
          .validateMerchant({ validationUrl: event.validationURL })
          .then(payload => {
            session.completeMerchantValidation(payload.merchantSession);
          })
          .catch(err => {
            console.error('Merchant validation failed:', err);
            session.abort();
          });
      };

      session.onpaymentmethodselected = () => {
        session.completePaymentMethodSelection({ newTotal: paymentRequest.total });
      };

      session.onpaymentauthorized = async event => {
        try {
          const orderId = await PayPalIntegration.createOrder({ paymentSource: 'apple_pay' });

          await applepay.confirmOrder({
            orderId,
            token: event.payment.token,
            billingContact: event.payment.billingContact,
            shippingContact: event.payment.shippingContact,
          });

          const result = await PayPalIntegration.approveOrder({ orderID: orderId });

          session.completePayment({ status: window.ApplePaySession.STATUS_SUCCESS });
          console.log('Apple Pay payment authorized:', result);
        } catch (err) {
          console.error('Payment processing failed:', err);
          session.completePayment({ status: window.ApplePaySession.STATUS_FAILURE });
        }
      };

      session.oncancel = () => {
        console.log('Apple Pay Cancelled');
      };

      session.begin();
    } catch (clickError) {
      console.error('Apple Pay session error:', clickError);
      alert('Apple Pay failed to start. This is expected when testing on PC/Windows.');
    }
  },
};

window.GooglePayButtons = {
  paymentsClient: null,
  googlePayConfig: null,

  async initialize() {
    if (typeof google === 'undefined' || !google.payments) {
      throw new Error('Google Pay SDK not loaded');
    }

    if (!window.paypal?.Googlepay) {
      throw new Error('PayPal SDK or Google Pay component not loaded');
    }

    this.googlePayConfig = await window.paypal.Googlepay().config();

    if (!this.googlePayConfig.isEligible) {
      throw new Error('Google Pay is not eligible');
    }

    this.paymentsClient = new google.payments.api.PaymentsClient({
      environment: 'TEST',
      paymentDataCallbacks: {
        onPaymentAuthorized: this.onPaymentAuthorized.bind(this),
      },
    });

    const isReadyToPay = await this.paymentsClient.isReadyToPay({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: this.googlePayConfig.allowedPaymentMethods,
    });

    if (isReadyToPay.result) {
      this.addGooglePayButton();
    } else {
      throw new Error('Google Pay is not available on this device/browser');
    }
  },

  addGooglePayButton() {
    const button = this.paymentsClient.createButton({
      onClick: this.onGooglePaymentButtonClicked.bind(this),
      buttonColor: 'black',
      buttonType: 'buy',
      buttonSizeMode: 'fill',
    });

    const container = document.getElementById('googlepay-button-container');
    if (container) {
      container.innerHTML = '';
      container.appendChild(button);
      container.style.setProperty('display', 'none', 'important');
    }
  },

  async onGooglePaymentButtonClicked() {
    try {
      const paymentDataRequest = await this.getGooglePaymentDataRequest();
      this.paymentsClient.loadPaymentData(paymentDataRequest);
    } catch (error) {
      console.error('Google Pay button click failed:', error);
      alert('Google Pay payment failed: ' + error.message);
    }
  },

  async getGooglePaymentDataRequest() {
    const paymentDataRequest = {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: this.googlePayConfig.allowedPaymentMethods,
      transactionInfo: {
        currencyCode: 'USD',
        totalPriceStatus: 'FINAL',
        totalPrice: Utils.getCurrentTotal(),
      },
      merchantInfo: this.googlePayConfig.merchantInfo,
      callbackIntents: ['PAYMENT_AUTHORIZATION'],
    };
    return paymentDataRequest;
  },

  async onPaymentAuthorized(paymentData) {
    try {
      const orderId = await PayPalIntegration.createOrder({ paymentSource: 'google_pay' });

      const confirmResponse = await window.paypal.Googlepay().confirmOrder({
        orderId,
        paymentMethodData: paymentData.paymentMethodData,
      });

      if (confirmResponse.status === 'APPROVED') {
        await PayPalIntegration.approveOrder({ orderID: orderId });
        return { transactionState: 'SUCCESS' };
      } else {
        throw new Error(`Order confirmation failed: ${confirmResponse.status}`);
      }
    } catch (error) {
      console.error('Google Pay payment failed:', error);
      return {
        transactionState: 'ERROR',
        error: {
          intent: 'PAYMENT_AUTHORIZATION',
          message: error.message,
          reason: 'PAYMENT_DATA_INVALID',
        },
      };
    }
  },

  handleSetupError(error) {
    const container = document.getElementById('googlepay-button-container');
    if (container) {
      if (
        error.message.includes('HTTPS') ||
        error.message.includes('CORS') ||
        error.message.includes('Failed to fetch')
      ) {
        container.innerHTML = `
          <div style="padding:12px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:4px;margin:8px 0;font-size:14px;color:#856404;text-align:center;line-height:1.4;">
            <strong>🔒 Google Pay</strong><br>
            <small>Requires HTTPS for sandbox testing.<br>Deploy to staging/production with SSL to test Google Pay.</small>
          </div>`;
        Utils.showElement('googlepay-option');
        Utils.hideElement('googlepay-button-container');
      } else {
        container.style.display = 'none';
      }
    }
    throw error;
  },
};

class WalletsCheckoutApp {
  async initialize() {
    console.log('Initializing wallets-only checkout...');

    await this.waitForPayPalSDK();

    await Promise.all([
      this.initializeApplePay(),
      this.initializeGooglePay(),
    ]);

    this.setupEventListeners();
    Utils.updateTotal();

    console.log('Wallets checkout initialized');
  }

  async initializeApplePay() {
    if (typeof ApplePaySession !== 'undefined') {
      try {
        await ApplePayButtons.initialize();
        Utils.showElement('applepay-option');
        console.log('Apple Pay initialized');
      } catch (error) {
        console.warn('Apple Pay initialization failed:', error.message);
        Utils.hideElement('applepay-option');
      }
    } else {
      Utils.hideElement('applepay-option');
    }
  }

  async initializeGooglePay() {
    if (typeof google !== 'undefined' && google.payments) {
      try {
        await window.GooglePayButtons.initialize();
        Utils.showElement('googlepay-option');
        Utils.hideElement('googlepay-button-container');
      } catch (error) {
        console.warn('Google Pay initialization failed:', error);
        Utils.hideElement('googlepay-option');
      }
    } else {
      console.log('Waiting for Google Pay SDK to load...');
    }
  }

  setupEventListeners() {
    document.querySelectorAll('input[name="shipping-option"]').forEach(option => {
      option.addEventListener('change', () => {
        document.getElementById('shipping-amount').textContent =
          parseFloat(option.value).toFixed(2);
        Utils.updateTotal();
      });
    });

    document.addEventListener('change', event => {
      if (event.target.name === 'payment-method') {
        Utils.showPaymentMethodButton(event.target.value);
      }
    });
  }

  waitForPayPalSDK() {
    return new Promise(resolve => {
      if (window.paypal) { resolve(); return; }

      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (window.paypal) {
          clearInterval(check);
          resolve();
        } else if (attempts >= 50) {
          clearInterval(check);
          console.error('PayPal SDK failed to load');
          resolve();
        }
      }, 100);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new WalletsCheckoutApp();
  app.initialize();

  // Handle pending Google Pay init if SDK loaded before JS ran
  if (window.googlePayPendingInit) {
    window.googlePayPendingInit = false;
    window.onGooglePayLoaded();
  }
});
