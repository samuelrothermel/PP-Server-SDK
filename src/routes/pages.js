import express from 'express';
import {
  renderIndex,
  renderCheckout,
  renderCheckoutExpress,
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
  renderPayouts,
  renderSubscriptionManagement,
  renderProductsManagement,
} from '../controllers/pageController.js';

const router = express.Router();

// Page routes
router.get('/', renderIndex);
router.get('/product', renderProduct);
router.get('/cart', renderCart);
router.get('/success', renderSuccess);
router.get('/checkout', renderCheckout);
router.get('/checkout-express', renderCheckoutExpress);
router.get('/save-wo-purchase', renderSaveWoPurchase);
router.get('/subscriptions', renderSubscriptions);
router.get('/subscription-management', renderSubscriptionManagement);
router.get('/products-management', renderProductsManagement);
router.get('/fastlane', renderFastlane);
router.get('/webhook-testing', renderWebhookTesting);
router.get('/payee-test', renderPayeeTest);
router.get('/orders', renderOrders);
router.get('/vault', renderVault);
router.get('/payouts', renderPayouts);
router.get('/api/payouts/oauth/callback', (req, res) => {
  res.render('paypal-oauth-callback');
});

export default router;
