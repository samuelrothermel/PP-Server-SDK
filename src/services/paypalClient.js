/**
 * PayPal Server SDK Client Initialization
 *
 * This module initializes and exports the PayPal Server SDK client
 * configured for your environment.
 *
 * Based on official PayPal example:
 * https://github.com/paypal-examples/docs-examples/blob/main/advanced-integration/v2/server/node/server.js
 *
 * Supported APIs (v2.1.0):
 * - Orders API v2
 * - Payments API v2
 * - Vault/Payment Tokens API v3 (US only)
 * - Transaction Search API v1
 * - Subscriptions API v1
 */

import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
  PaymentsController,
  VaultController,
  TransactionSearchController,
  SubscriptionsController,
} from '@paypal/paypal-server-sdk/dist/esm/index.js';

const { CLIENT_ID, APP_SECRET, NODE_ENV } = process.env;

console.log('[PayPal SDK] Initializing PayPal Server SDK v2.1.0...');

// Initialize the PayPal Server SDK client
const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: CLIENT_ID,
    oAuthClientSecret: APP_SECRET,
  },
  timeout: 0,
  environment:
    NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: {
      logBody: true,
    },
    logResponse: {
      logHeaders: true,
    },
  },
});

// Instantiate controllers by passing the client
// This is the correct pattern per PayPal's official examples
export const ordersController = new OrdersController(client);
export const paymentsController = new PaymentsController(client);
export const vaultController = new VaultController(client);
export const transactionSearchController = new TransactionSearchController(
  client
);
export const subscriptionsController = new SubscriptionsController(client);

console.log('[PayPal SDK] Controllers initialized successfully');
console.log('[PayPal SDK] Available controllers:', {
  orders: !!ordersController,
  payments: !!paymentsController,
  vault: !!vaultController,
  transactionSearch: !!transactionSearchController,
  subscriptions: !!subscriptionsController,
});

// Export the full client as well
export default client;
