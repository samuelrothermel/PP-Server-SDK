import { subscriptionsController } from './paypalClient.js';

/**
 * Subscriptions API Service
 * 
 * Uses PayPal Server SDK v2.1.0 - SubscriptionsController
 * All subscription operations use the Server SDK
 */

// Get subscription details by ID
export const getSubscriptionDetails = async subscriptionId => {
  try {
    const { body: subscriptionResponse } =
      await subscriptionsController.getSubscription(subscriptionId);

    const subscription =
      typeof subscriptionResponse === 'string'
        ? JSON.parse(subscriptionResponse)
        : subscriptionResponse;

    return subscription;
  } catch (error) {
    console.error('[SERVER SDK] Error fetching subscription:', error);
    throw error;
  }
};

// Cancel a subscription
export const cancelSubscription = async (subscriptionId, reason) => {
  try {
    const { body: cancelResponse } =
      await subscriptionsController.cancelSubscription(subscriptionId, {
        body: {
          reason: reason || 'Customer requested cancellation',
        },
      });

    // Cancel returns 204 No Content on success
    return {
      success: true,
      message: 'Subscription cancelled successfully',
      subscriptionId,
    };
  } catch (error) {
    console.error('[SERVER SDK] Error cancelling subscription:', error);
    throw error;
  }
};

// Suspend a subscription
export const suspendSubscription = async (subscriptionId, reason) => {
  try {
    const { body: suspendResponse } =
      await subscriptionsController.suspendSubscription(subscriptionId, {
        body: {
          reason: reason || 'Subscription suspended',
        },
      });

    return {
      success: true,
      message: 'Subscription suspended successfully',
      subscriptionId,
    };
  } catch (error) {
    console.error('[SERVER SDK] Error suspending subscription:', error);
    throw error;
  }
};

// Activate a suspended subscription
export const activateSubscription = async (subscriptionId, reason) => {
  try {
    const { body: activateResponse } =
      await subscriptionsController.activateSubscription(subscriptionId, {
        body: {
          reason: reason || 'Subscription activated',
        },
      });

    return {
      success: true,
      message: 'Subscription activated successfully',
      subscriptionId,
    };
  } catch (error) {
    console.error('[SERVER SDK] Error activating subscription:', error);
    throw error;
  }
};

// Update subscription details (shipping address, etc.)
export const updateSubscription = async (subscriptionId, updates) => {
  try {
    // Build PATCH operations for subscription updates
    const operations = [];

    if (updates.shipping_address) {
      operations.push({
        op: 'replace',
        path: '/subscriber/shipping_address',
        value: updates.shipping_address,
      });
    }

    if (updates.billing_info) {
      operations.push({
        op: 'replace',
        path: '/billing_info',
        value: updates.billing_info,
      });
    }

    const { body: updateResponse } =
      await subscriptionsController.updateSubscription(subscriptionId, {
        body: operations,
      });

    return {
      success: true,
      message: 'Subscription updated successfully',
      subscriptionId,
    };
  } catch (error) {
    console.error('[SERVER SDK] Error updating subscription:', error);
    throw error;
  }
};

// List transactions for a subscription
export const listSubscriptionTransactions = async (
  subscriptionId,
  startTime,
  endTime
) => {
  try {
    const { body: transactionsResponse } =
      await subscriptionsController.listTransactionsForSubscription(
        subscriptionId,
        {
          queryParameters: {
            startTime,
            endTime,
          },
        }
      );

    const transactions =
      typeof transactionsResponse === 'string'
        ? JSON.parse(transactionsResponse)
        : transactionsResponse;

    return transactions;
  } catch (error) {
    console.error('[SERVER SDK] Error listing transactions:', error);
    throw error;
  }
};

// Capture outstanding balance for a subscription
export const captureSubscriptionPayment = async (
  subscriptionId,
  note,
  captureType,
  amount
) => {
  try {
    const { body: captureResponse } =
      await subscriptionsController.captureSubscriptionPayment(subscriptionId, {
        body: {
          note,
          capture_type: captureType || 'OUTSTANDING_BALANCE',
          amount,
        },
      });

    const capture =
      typeof captureResponse === 'string'
        ? JSON.parse(captureResponse)
        : captureResponse;

    return capture;
  } catch (error) {
    console.error('[SERVER SDK] Error capturing subscription payment:', error);
    throw error;
  }
};

// Revise subscription plan or quantity
export const reviseSubscription = async (subscriptionId, planId, quantity) => {
  try {
    const { body: reviseResponse } =
      await subscriptionsController.reviseSubscription(subscriptionId, {
        body: {
          plan_id: planId,
          ...(quantity && { quantity }),
        },
      });

    const revision =
      typeof reviseResponse === 'string'
        ? JSON.parse(reviseResponse)
        : reviseResponse;

    return revision;
  } catch (error) {
    console.error('[SERVER SDK] Error revising subscription:', error);
    throw error;
  }
};
