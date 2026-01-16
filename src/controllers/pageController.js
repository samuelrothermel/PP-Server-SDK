import { CLIENT_ID } from '../config/constants.js';

// Helper function to handle page rendering with clientId
const renderPage = view => async (req, res, next) => {
  try {
    const clientId = process.env.CLIENT_ID;
    res.render(view, { clientId: clientId });
  } catch (err) {
    next(err);
  }
};

// Page Controllers
export const renderIndex = renderPage('index');
export const renderCheckout = renderPage('checkout');
export const renderProduct = renderPage('product');
export const renderCart = renderPage('cart');
export const renderSuccess = renderPage('success');
export const renderSaveWoPurchase = renderPage('save-wo-purchase');
export const renderSubscriptions = renderPage('subscriptions');
export const renderSubscriptionManagement = renderPage(
  'subscription-management'
);
export const renderProductsManagement = renderPage('products-management');
export const renderFastlane = renderPage('fastlane');

export const renderWebhookTesting = renderPage('webhook-testing');
export const renderPayeeTest = renderPage('payee-test');
export const renderOrders = renderPage('orders');
export const renderVault = renderPage('vault');
export const renderPayouts = renderPage('payouts');
export const renderCheckoutExpress = renderPage('checkout-express');
