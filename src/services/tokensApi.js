import fetch from 'node-fetch';
import { generateAccessToken } from './authApi.js';
import { vaultController } from './paypalClient.js';
import { handleResponse } from '../utils/responseHandler.js';

// set some important variables
const base = 'https://api-m.sandbox.paypal.com';

const getSdkResult = response => {
  if (response?.result) {
    return response.result;
  }

  if (typeof response?.body === 'string') {
    return JSON.parse(response.body);
  }

  return response?.body;
};

/**
 * 3D SECURE API APPROACH
 *
 * This file demonstrates the API-driven approach for 3D Secure authentication.
 * All 3DS parameters are configured and passed via server-side PayPal API calls.
 *
 * Key API Parameters:
 * - verification_method: "SCA_ALWAYS" | "SCA_WHEN_REQUIRED"
 *   (passed in POST /v3/vault/setup-tokens)
 *
 * - stored_credential: { payment_initiator, payment_type, usage }
 *   (passed in POST /v2/checkout/orders when using vaulted cards)
 *
 * This approach allows customers to control 3DS behavior entirely through
 * backend API configuration, not client-side SDK options.
 */

// create vault setup token
export const createVaultSetupToken = async ({ paymentSource }) => {
  const normalizedPaymentSource = (paymentSource || 'card').toLowerCase();
  console.log(
    '[SERVER SDK] Creating vault setup token for:',
    normalizedPaymentSource,
  );

  const paymentSources = {
    paypal: {
      description: 'Description for PayPal to be shown to PayPal payer',
      usage_pattern: 'IMMEDIATE',
      usage_type: 'MERCHANT',
      customer_type: 'CONSUMER',
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
        brand_name: 'EXAMPLE INC',
        locale: 'en-US',
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl',
      },
    },
    card: {
      verification_method: 'SCA_WHEN_REQUIRED',
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    },
    apple_pay: {
      usage_pattern: 'IMMEDIATE',
      usage_type: 'MERCHANT',
      customer_type: 'CONSUMER',
      verification_method: 'SCA_WHEN_REQUIRED',
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
        brand_name: 'EXAMPLE INC',
        locale: 'en-US',
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl',
      },
    },
  };

  const selectedPaymentSource = paymentSources[normalizedPaymentSource];

  if (!selectedPaymentSource) {
    const error = new Error(
      `Unsupported payment source for vault setup token: ${normalizedPaymentSource}`,
    );
    error.statusCode = 400;
    throw error;
  }

  const setupTokenPayload = {
    payment_source: {
      [normalizedPaymentSource]: selectedPaymentSource,
    },
  };

  try {
    const sdkResponse = await vaultController.createSetupToken({
      body: setupTokenPayload,
    });
    const token = getSdkResult(sdkResponse);

    if (!token?.id) {
      throw new Error('PayPal did not return a vault setup token id');
    }

    console.log('[SERVER SDK] Setup token created successfully:', token.id);
    return token;
  } catch (error) {
    console.error('[SERVER SDK] Error creating setup token:', error);
    throw error;
  }
};

// create vault setup token with 3D Secure (SCA_ALWAYS)
// This demonstrates the API-driven approach where 3DS parameters are passed server-side
export const create3DSVaultSetupToken = async ({
  paymentSource,
  verificationMethod = 'SCA_ALWAYS',
}) => {
  const normalizedPaymentSource = (paymentSource || 'card').toLowerCase();
  console.log('='.repeat(80));
  console.log(
    '[3DS API APPROACH] Creating vault setup token with 3DS enforcement',
  );
  console.log('[3DS API APPROACH] Payment Source:', normalizedPaymentSource);
  console.log(
    '[3DS API APPROACH] Verification Method (passed via API):',
    verificationMethod,
  );
  console.log('='.repeat(80));

  const paymentSources = {
    card: {
      // 3DS Configuration passed via API (not client-side)
      verification_method: verificationMethod, // SCA_ALWAYS = Force 3DS challenge
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl',
      },
    },
  };

  // Only support card for 3DS testing
  if (normalizedPaymentSource !== 'card') {
    throw new Error(
      '3D Secure vault setup tokens only support card payment source',
    );
  }

  const setupTokenPayload = {
    payment_source: {
      [normalizedPaymentSource]: paymentSources[normalizedPaymentSource],
    },
  };

  console.log('[3DS API APPROACH] Setup Token API Payload:');
  console.log(JSON.stringify(setupTokenPayload, null, 2));

  try {
    console.log(
      '[3DS API APPROACH] Calling PayPal Vault API: POST /v3/vault/setup-tokens',
    );
    const sdkResponse = await vaultController.createSetupToken({
      body: setupTokenPayload,
    });
    const token = getSdkResult(sdkResponse);

    if (!token?.id) {
      throw new Error('PayPal did not return a 3DS setup token id');
    }

    console.log('[3DS API APPROACH] Setup token created successfully');
    console.log('[3DS API APPROACH] Token ID:', token.id);
    console.log('[3DS API APPROACH] Status:', token.status);

    // Log 3DS verification details if present
    if (token.payment_source?.card) {
      console.log(
        '[3DS API APPROACH] Card verification method:',
        token.payment_source.card.verification_method,
      );
    }
    console.log('='.repeat(80));

    return token;
  } catch (error) {
    console.error('[3DS API APPROACH] Error creating 3DS setup token:', error);
    throw error;
  }
};

// create vault payment token
export const createVaultPaymentToken = async vaultSetupToken => {
  console.log(
    '[SERVER SDK] Creating payment token from setup token:',
    vaultSetupToken,
  );

  const paymentTokenPayload = {
    payment_source: {
      token: {
        id: vaultSetupToken,
        type: 'SETUP_TOKEN',
      },
    },
  };

  try {
    const sdkResponse = await vaultController.createPaymentToken({
      body: paymentTokenPayload,
    });
    const token = getSdkResult(sdkResponse);

    if (!token?.id) {
      throw new Error('PayPal did not return a vault payment token id');
    }

    console.log('[SERVER SDK] Payment token created successfully:', token.id);
    return token;
  } catch (error) {
    console.error('[SERVER SDK] Error creating payment token:', error);
    throw error;
  }
};

// create payment token from customer ID
export const createPaymentTokenFromCustomerId = async customerId => {
  const accessToken = await generateAccessToken();
  const response = await fetch(`${base}/v3/vault/payment-tokens`, {
    method: 'post',
    headers: {
      'PayPal-Request-Id': Date.now().toString(),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      payment_source: {
        customer: {
          id: customerId,
          type: 'CUSTOMER_ID',
        },
      },
    }),
  });

  return handleResponse(response);
};

// get payment tokens from customer ID
export const fetchPaymentTokens = async customerId => {
  console.log('[SERVER SDK] Fetching payment tokens for customer:', customerId);

  try {
    const sdkResponse = await vaultController.listCustomerPaymentTokens({
      customerId: customerId,
    });
    const response = getSdkResult(sdkResponse);

    console.log('[SERVER SDK] Payment tokens fetched successfully');

    // Log detailed customer and payment source information
    if (response.customer) {
      // Customer info available
    }

    if (response.payment_tokens && response.payment_tokens.length > 0) {
      // Payment tokens fetched successfully
    }

    return response.payment_tokens || [];
  } catch (error) {
    console.error('[SERVER SDK] Error fetching payment tokens:', error);
    throw error;
  }
};

// get payment token details by vault_id
export const getPaymentTokenDetails = async vaultId => {
  console.log('[SERVER SDK] Getting payment token details for:', vaultId);

  try {
    const sdkResponse = await vaultController.getPaymentToken(vaultId);
    const tokenDetails = getSdkResult(sdkResponse);
    console.log('[SERVER SDK] Payment token details retrieved successfully');
    return tokenDetails;
  } catch (error) {
    console.error('[SERVER SDK] Error getting payment token:', error);
    throw error;
  }
};

// create order with payment token for recurring payment
export const createRecurringOrder = async paymentTokenId => {
  console.log(
    'Creating order with payment token for recurring payment:',
    paymentTokenId,
  );

  const accessToken = await generateAccessToken();
  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: '100.00', // Monthly fee
          },
        },
      ],
      payment_source: {
        token: {
          id: paymentTokenId,
          type: 'PAYMENT_METHOD_TOKEN',
        },
        stored_credential: {
          payment_initiator: 'MERCHANT',
          payment_type: 'RECURRING',
          usage: 'SUBSEQUENT',
        },
      },
    }),
  });

  console.log(
    'Create Recurring Order Response: ',
    await response.clone().text(),
  );
  return handleResponse(response);
};

// create recurring payment setup token
export const createRecurringSetupToken = async ({ paymentSource }) => {
  console.log(
    'Creating recurring payment setup token for payment source:',
    paymentSource,
  );

  // Current date
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];

  const paymentSources = {
    paypal: {
      usage_type: 'MERCHANT',
      usage_pattern: 'UNSCHEDULED_POSTPAID',
      billing_plan: {
        billing_cycles: [
          {
            tenure_type: 'REGULAR',
            pricing_scheme: {
              pricing_model: 'AUTO_RELOAD',
              price: {
                value: '10',
                currency_code: 'USD',
              },
            },
            frequency: {
              interval_unit: 'MONTH',
              interval_count: '1',
            },
            total_cycles: '1',
            start_date: formattedDate,
          },
        ],
        one_time_charges: {
          product_price: {
            value: '10',
            currency_code: 'USD',
          },
          total_amount: {
            value: '10',
            currency_code: 'USD',
          },
        },
        product: {
          description: 'Monthly Membership',
          quantity: '1',
        },
        name: "Sam's Recurring Monthly Membership Plan",
      },
      experience_context: {
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl',
        shipping_preference: 'NO_SHIPPING',
        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
        brand_name: 'EXAMPLE INC',
        locale: 'en-US',
      },
    },
    card: {
      verification_method: 'SCA_WHEN_REQUIRED',
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    },
  };

  const response = await fetch(`${base}/v3/vault/setup-tokens`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await generateAccessToken()}`,
    },
    body: JSON.stringify({
      payment_source: {
        [paymentSource]: paymentSources[paymentSource],
      },
    }),
  });

  console.log(
    'Create Recurring Setup Token Response: ',
    JSON.stringify(await response.clone().json(), null, 2),
  );
  return handleResponse(response);
};

// Fetch payment tokens for multiple customer IDs (for localStorage integration)
export const getPaymentTokensByCustomerIds = async customerIds => {
  console.log('Fetching payment tokens for customer IDs:', customerIds);
  const customers = [];

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return {
      customers: [],
      message:
        'No customer IDs provided. Please provide an array of customer IDs to fetch.',
    };
  }

  // Fetch payment tokens for each customer ID
  for (const customerIdObj of customerIds) {
    const customerId = customerIdObj.id || customerIdObj;
    try {
      console.log(`Fetching payment tokens for customer: ${customerId}`);

      // Get the full response to extract customer details
      const accessToken = await generateAccessToken();
      const response = await fetch(
        `https://api-m.sandbox.paypal.com/v3/vault/payment-tokens?customer_id=${customerId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      const data = await response.json();

      const paymentTokens = data.payment_tokens || [];
      const customerDetails = data.customer || {};

      customers.push({
        customerId,
        customerDetails, // Include customer details from API response
        paymentTokens,
        client_customer_timestamp: customerIdObj.timestamp || null,
      });
    } catch (error) {
      console.error(`Error fetching tokens for customer ${customerId}:`, error);
      // Continue with other customers even if one fails
      customers.push({
        customerId,
        error: `Failed to fetch payment tokens: ${error.message}`,
        paymentTokens: [],
        client_customer_timestamp: customerIdObj.timestamp || null,
      });
    }
  }

  return {
    customers: customers.reverse(), // Show most recent first
    totalCount: customers.length,
    message: customers.length > 0 ? null : 'No valid customers found.',
  };
};
