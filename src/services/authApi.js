import fetch from 'node-fetch';
import { handleResponse } from '../utils/responseHandler.js';

// set some important variables
const { CLIENT_ID, APP_SECRET, CLIENT_ID_2, APP_SECRET_2 } = process.env;
const base = 'https://api-m.sandbox.paypal.com';

// generate access token for first-time payer
export const generateAccessToken = async () => {
  const auth = Buffer.from(CLIENT_ID + ':' + APP_SECRET).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  const jsonData = await handleResponse(response);
  return jsonData.access_token;
};

// generate access token for specific merchant (1 or 2)
export const generateAccessTokenForMerchant = async (merchantNumber = 1) => {
  let clientId, appSecret;

  if (merchantNumber === 2) {
    clientId = CLIENT_ID_2;
    appSecret = APP_SECRET_2;

    if (!clientId || !appSecret) {
      throw new Error(
        'Second merchant credentials (CLIENT_ID_2, APP_SECRET_2) not configured in .env'
      );
    }
  } else {
    clientId = CLIENT_ID;
    appSecret = APP_SECRET;
  }

  const auth = Buffer.from(clientId + ':' + appSecret).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  const jsonData = await handleResponse(response);
  return jsonData.access_token;
};

// generate access token for returning payer
export const returningAccessToken = async customerId => {
  const auth = Buffer.from(CLIENT_ID + ':' + APP_SECRET).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: `grant_type=client_credentials&response_type=id_token&target_customer_id=${customerId}`,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const jsonData = await handleResponse(response);
  return jsonData.id_token;
};

// generate user ID token for first-time payer (required for Venmo vaulting)
export const generateUserIdToken = async () => {
  const auth = Buffer.from(CLIENT_ID + ':' + APP_SECRET).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: 'grant_type=client_credentials&response_type=id_token',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const jsonData = await handleResponse(response);
  return jsonData.id_token;
};
