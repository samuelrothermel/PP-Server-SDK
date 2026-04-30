import crypto from 'crypto';
import { generateAccessToken } from './authApi.js';
import { WEBHOOK_ID } from '../config/constants.js';
import { recordInvoiceWebhook } from '../controllers/invoicingController.js';

// PayPal webhook configuration
const base = 'https://api-m.sandbox.paypal.com';

/**
 * Verify PayPal webhook signature
 * @param {string} body - Raw webhook body
 * @param {object} headers - Request headers
 * @returns {boolean} - True if signature is valid
 */
export const verifyWebhookSignature = async (body, headers) => {
  try {
    const authAlgo = headers['paypal-auth-algo'];
    const transmission_id = headers['paypal-transmission-id'];
    const cert_id = headers['paypal-cert-id'];
    const transmission_sig = headers['paypal-transmission-sig'];
    const transmission_time = headers['paypal-transmission-time'];
    const webhook_id = WEBHOOK_ID;
    const webhook_event = body;

    console.log('Verifying webhook signature...');

    const accessToken = await generateAccessToken();

    const verificationPayload = {
      auth_algo: authAlgo,
      cert_id: cert_id,
      transmission_id: transmission_id,
      transmission_sig: transmission_sig,
      transmission_time: transmission_time,
      webhook_id: webhook_id,
      webhook_event: JSON.parse(webhook_event),
    };

    const response = await fetch(
      `${base}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(verificationPayload),
      }
    );

    const result = await response.json();
    console.log('Webhook verification result:', result);

    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

/**
 * Handle vault.payment-token.created webhook event
 * @param {object} eventData - Webhook event data
 */
export const handlePaymentTokenCreated = async eventData => {
  console.log(
    'Processing vault.payment-token.created webhook:',
    JSON.stringify(eventData, null, 2)
  );

  try {
    const resource = eventData.resource;
    const paymentTokenId = resource.id;
    const customerId = resource.customer?.id;
    const paymentSource = resource.payment_source;

    console.log(`New payment token created: ${paymentTokenId}`);

    if (customerId) {
      console.log(`Associated with customer: ${customerId}`);
    }

    if (paymentSource.card) {
      const card = paymentSource.card;
      console.log(
        `Card details: ${card.brand} ending in ${card.last_digits}, expires ${card.expiry}`
      );
    } else if (paymentSource.paypal) {
      console.log('PayPal payment source created');
    }

    // TODO: Store payment token information in your database if needed
    // TODO: Send notifications to your application/users if needed

    return {
      success: true,
      message: 'Payment token created event processed successfully',
    };
  } catch (error) {
    console.error('Error processing payment token created event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle vault.credit-card.created webhook event
 * @param {object} eventData - Webhook event data
 */
export const handleCreditCardCreated = async eventData => {
  console.log(
    'Processing vault.credit-card.created webhook:',
    JSON.stringify(eventData, null, 2)
  );

  try {
    const resource = eventData.resource;
    const creditCardId = resource.id;
    const customerId = resource.customer_id;

    console.log(`New credit card created: ${creditCardId}`);

    if (customerId) {
      console.log(`Associated with customer: ${customerId}`);
    }

    // Extract card details
    if (resource.number) {
      console.log(`Card number (last 4): ${resource.number.slice(-4)}`);
    }
    if (resource.type) {
      console.log(`Card type: ${resource.type}`);
    }
    if (resource.expire_month && resource.expire_year) {
      console.log(`Expires: ${resource.expire_month}/${resource.expire_year}`);
    }

    // TODO: Store credit card information in your database if needed
    // TODO: Send notifications to your application/users if needed

    return {
      success: true,
      message: 'Credit card created event processed successfully',
    };
  } catch (error) {
    console.error('Error processing credit card created event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle checkout.order.approved webhook event
 * @param {object} eventData - Webhook event data
 */
export const handleOrderApproved = async eventData => {
  console.log(
    'Processing checkout.order.approved webhook:',
    JSON.stringify(eventData, null, 2)
  );

  try {
    const resource = eventData.resource;
    const orderId = resource.id;
    const status = resource.status;
    const payer = resource.payer;

    console.log(`Order approved: ${orderId}, status: ${status}`);

    if (payer) {
      console.log(`Payer: ${payer.email_address} (${payer.payer_id})`);
    }

    // TODO: Trigger capture or any post-approval logic here

    return {
      success: true,
      message: `Order ${orderId} approved event processed successfully`,
    };
  } catch (error) {
    console.error('Error processing order approved event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle checkout.order.completed webhook event
 * @param {object} eventData - Webhook event data
 */
export const handleOrderCompleted = async eventData => {
  console.log(
    'Processing checkout.order.completed webhook:',
    JSON.stringify(eventData, null, 2)
  );

  try {
    const resource = eventData.resource;
    const orderId = resource.id;
    const status = resource.status;
    const purchaseUnits = resource.purchase_units;

    console.log(`Order completed: ${orderId}, status: ${status}`);

    if (purchaseUnits?.length > 0) {
      const capture = purchaseUnits[0].payments?.captures?.[0];
      if (capture) {
        console.log(
          `Capture ID: ${capture.id}, amount: ${capture.amount.value} ${capture.amount.currency_code}`
        );
      }
    }

    // TODO: Fulfill the order, update your database, send confirmation email, etc.

    return {
      success: true,
      message: `Order ${orderId} completed event processed successfully`,
    };
  } catch (error) {
    console.error('Error processing order completed event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Process incoming webhook events
 * @param {object} eventData - Webhook event data
 * @returns {object} - Processing result
 */
export const processWebhookEvent = async eventData => {
  const eventType = eventData.event_type;

  console.log(`Processing webhook event: ${eventType}`);

  switch (eventType) {
    case 'VAULT.PAYMENT-TOKEN.CREATED':
      return await handlePaymentTokenCreated(eventData);

    case 'VAULT.CREDIT-CARD.CREATED':
      return await handleCreditCardCreated(eventData);

    case 'CHECKOUT.ORDER.APPROVED':
      return await handleOrderApproved(eventData);

    case 'CHECKOUT.ORDER.COMPLETED':
      return await handleOrderCompleted(eventData);

    case 'INVOICING.INVOICE.PAID':
    case 'INVOICING.INVOICE.MARKED_AS_PAID': {
      const invoiceId = eventData.resource?.invoice?.id || eventData.resource?.id;
      if (invoiceId) {
        recordInvoiceWebhook(invoiceId, eventData);
      }
      console.log(`[Invoicing Webhook] recorded for invoiceId: ${invoiceId}`);
      return { success: true, message: `Invoice ${invoiceId} paid event recorded` };
    }

    default:
      console.log(`Unhandled webhook event type: ${eventType}`);
      return {
        success: true,
        message: `Event type ${eventType} received but not processed`,
      };
  }
};

/**
 * Get webhook details
 * @returns {object} - Webhook configuration details
 */
export const getWebhookDetails = async () => {
  try {
    const accessToken = await generateAccessToken();

    const response = await fetch(
      `${base}/v1/notifications/webhooks/${WEBHOOK_ID}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      const webhookDetails = await response.json();
      console.log('Webhook details:', JSON.stringify(webhookDetails, null, 2));
      return webhookDetails;
    } else {
      console.error(
        'Error fetching webhook details:',
        response.status,
        response.statusText
      );
      return null;
    }
  } catch (error) {
    console.error('Error fetching webhook details:', error);
    return null;
  }
};

/**
 * List all webhook events for testing
 * @returns {object} - List of webhook events
 */
export const listWebhookEvents = async () => {
  try {
    const accessToken = await generateAccessToken();

    const response = await fetch(`${base}/v1/notifications/webhooks-events`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const events = await response.json();
      console.log('Available webhook events:', JSON.stringify(events, null, 2));
      return events;
    } else {
      console.error(
        'Error fetching webhook events:',
        response.status,
        response.statusText
      );
      return null;
    }
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    return null;
  }
};
