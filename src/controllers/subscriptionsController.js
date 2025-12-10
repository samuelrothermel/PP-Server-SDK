import {
  getSubscriptionDetails,
  cancelSubscription,
  suspendSubscription,
  activateSubscription,
  updateSubscription,
} from '../services/subscriptionsApi.js';

// Get subscription details by ID
export const getSubscriptionHandler = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const subscription = await getSubscriptionDetails(subscriptionId);
    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    next(error);
  }
};

// Cancel a subscription
export const cancelSubscriptionHandler = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const result = await cancelSubscription(
      subscriptionId,
      reason || 'Customer requested cancellation'
    );

    res.json(result);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    next(error);
  }
};

// Suspend a subscription
export const suspendSubscriptionHandler = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const result = await suspendSubscription(
      subscriptionId,
      reason || 'Subscription suspended'
    );

    res.json(result);
  } catch (error) {
    console.error('Error suspending subscription:', error);
    next(error);
  }
};

// Activate a suspended subscription
export const activateSubscriptionHandler = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const result = await activateSubscription(
      subscriptionId,
      reason || 'Subscription activated'
    );

    res.json(result);
  } catch (error) {
    console.error('Error activating subscription:', error);
    next(error);
  }
};

// Update subscription details
export const updateSubscriptionHandler = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const updates = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const result = await updateSubscription(subscriptionId, updates);
    res.json(result);
  } catch (error) {
    console.error('Error updating subscription:', error);
    next(error);
  }
};
