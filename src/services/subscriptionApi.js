import { generateAccessToken } from './authApi.js';
import { subscriptionsController } from './paypalClient.js';
import fetch from 'node-fetch';

const base = 'https://api-m.sandbox.paypal.com';

// USE_SERVER_SDK flag - set to true to use Server SDK, false for direct REST API
// Note: Subscriptions may not be available in all SDK versions
const USE_SERVER_SDK = subscriptionsController ? true : false;

// Create a subscription plan
export const createSubscriptionPlan = async () => {
  console.log(
    '[SDK MODE: ' +
      (USE_SERVER_SDK ? 'SERVER SDK' : 'DIRECT REST') +
      '] Creating subscription plan'
  );

  try {
    const planData = {
      product_id: null, // Will be created first
      name: 'Monthly Subscription Plan',
      description: 'Monthly subscription for $3.99',
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // 0 means infinite
          pricing_scheme: {
            fixed_price: {
              value: '3.99',
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0',
          currency_code: 'USD',
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
      taxes: {
        percentage: '0',
        inclusive: false,
      },
    };

    const productPayload = {
      name: 'Monthly Subscription Service',
      description: 'Monthly subscription service for $3.99',
      type: 'SERVICE',
      category: 'SOFTWARE',
    };

    let productData;

    // Note: Products API is not in the Server SDK, so we always use REST API for products
    const accessToken = await generateAccessToken();
    const productResponse = await fetch(`${base}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'PayPal-Request-Id': `product-${Date.now()}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(productPayload),
    });

    if (!productResponse.ok) {
      throw new Error(
        `Failed to create product: ${await productResponse.text()}`
      );
    }

    productData = await productResponse.json();
    console.log('Product created:', productData.id);

    // Now create the plan with the product ID
    planData.product_id = productData.id;

    if (USE_SERVER_SDK) {
      // Use PayPal Server SDK to create billing plan
      try {
        const { body: planResponse } =
          await subscriptionsController.createBillingPlan({
            body: planData,
            prefer: 'return=representation',
          });
        const plan =
          typeof planResponse === 'string'
            ? JSON.parse(planResponse)
            : planResponse;
        console.log('[SERVER SDK] Subscription plan created:', plan.id);
        return plan;
      } catch (error) {
        console.error('[SERVER SDK] Error creating plan:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    throw error;
  }
};

// Get an existing plan by ID
export const getSubscriptionPlan = async planId => {
  console.log(
    '[SDK MODE: ' +
      (USE_SERVER_SDK ? 'SERVER SDK' : 'DIRECT REST') +
      '] Getting subscription plan:',
    planId
  );

  try {
    if (USE_SERVER_SDK) {
      // Use PayPal Server SDK
      const { body: planResponse } =
        await subscriptionsController.getBillingPlan(planId);
      const plan =
        typeof planResponse === 'string'
          ? JSON.parse(planResponse)
          : planResponse;
      console.log('[SERVER SDK] Plan retrieved successfully');
      return plan;
    }
  } catch (error) {
    console.error('Error getting subscription plan:', error);
    throw error;
  }
};
