import express from 'express';
import {
  renderIndex,
  renderCheckout,
  renderCheckoutAlternate,
  renderSubscriptions,
  renderSaveWoPurchase,
  renderProduct,
  renderCart,
  renderSuccess,
  renderWebhookTesting,
  renderFastlane,
  renderPayeeTest,
  renderOrders,
  renderVault,
  renderVault3DS,
  renderPayouts,
  renderSubscriptionManagement,
  renderProductsManagement,
  renderVenmo,
  renderCrypto,
  renderJsSdkV6Standard,
  renderJsSdkV6Iframe,
  renderJsSdkV6IframeButtons,
  renderJsSdkV6Advanced,
  renderJsSdkV6CardEligibility,
  renderInvoicing,
  renderTransactionReports,
  renderCheckoutWallets,
  renderAch,
  renderAchSdk,
  renderJsSdkV6Product,
  renderJsSdkV6Cart,
  renderApiOnlyCheckout,
  renderMitV5,
  renderMitV6,
  renderMitApi,
} from '../controllers/pageController.js';

const router = express.Router();

// Page routes
router.get('/', renderIndex);
router.get('/product', renderProduct);
router.get('/cart', renderCart);
router.get('/success', renderSuccess);
router.get('/checkout', renderCheckout);
router.get('/checkout-alternate', renderCheckoutAlternate);
router.get('/save-wo-purchase', renderSaveWoPurchase);
router.get('/subscriptions', renderSubscriptions);
router.get('/subscription-management', renderSubscriptionManagement);
router.get('/products-management', renderProductsManagement);
router.get('/fastlane', renderFastlane);
router.get('/webhook-testing', renderWebhookTesting);
router.get('/payee-test', renderPayeeTest);
router.get('/orders', renderOrders);
router.get('/vault', renderVault);
router.get('/vault-3ds', renderVault3DS);
router.get('/payouts', renderPayouts);
router.get('/venmo', renderVenmo);
router.get('/crypto', renderCrypto);
router.get('/js-sdk-v6/standard', renderJsSdkV6Standard);
router.get('/js-sdk-v6/iframe', renderJsSdkV6Iframe);
router.get('/js-sdk-v6/iframe-buttons', renderJsSdkV6IframeButtons);
router.get('/js-sdk-v6/advanced', renderJsSdkV6Advanced);
router.get('/js-sdk-v6/card-eligibility', renderJsSdkV6CardEligibility);
router.get('/invoicing', renderInvoicing);
router.get('/transaction-reports', renderTransactionReports);
router.get('/checkout-wallets', renderCheckoutWallets);
router.get('/ach', renderAch);
router.get('/ach-sdk', renderAchSdk);
router.get('/js-sdk-v6/product', renderJsSdkV6Product);
router.get('/js-sdk-v6/cart', renderJsSdkV6Cart);
router.get('/api-only/checkout', renderApiOnlyCheckout);
router.get('/mit/v5', renderMitV5);
router.get('/mit/v6', renderMitV6);
router.get('/mit/api', renderMitApi);
router.get('/api/payouts/oauth/callback', (req, res) => {
  res.render('paypal-oauth-callback');
});

export default router;
