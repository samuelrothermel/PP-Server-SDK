import fetch from 'node-fetch';
import { generateAccessToken } from './authApi.js';
import { handleResponse } from '../utils/responseHandler.js';

const base = 'https://api-m.sandbox.paypal.com';
const { CLIENT_ID, APP_SECRET, BASE_URL } = process.env;

// Create a payout batch
export const createPayout = async payoutData => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/payments/payouts`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payoutData),
  });

  return handleResponse(response);
};

// Get payout batch details
export const getPayoutDetails = async payoutBatchId => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/payments/payouts/${payoutBatchId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

// Get payout item details
export const getPayoutItemDetails = async payoutItemId => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/payments/payouts-item/${payoutItemId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

// Exchange authorization code for access token
export const exchangeCodeForToken = async code => {
  const auth = Buffer.from(CLIENT_ID + ':' + APP_SECRET).toString('base64');
  const url = `${base}/v1/oauth2/token`;
  const redirectUri = `${BASE_URL}/api/payouts/oauth/callback`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  return handleResponse(response);
};

// Get user info using access token
export const getUserInfo = async code => {
  // First exchange the code for an access token
  const tokenData = await exchangeCodeForToken(code);
  const { access_token } = tokenData;

  // Then get user info
  const url = `${base}/v1/identity/oauth2/userinfo?schema=paypalv1.1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
  });

  return handleResponse(response);
};
