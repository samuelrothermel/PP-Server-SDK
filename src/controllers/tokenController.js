import { generateAccessToken } from '../services/authApi.js';
import fetch from 'node-fetch';
import { CLIENT_ID } from '../config/constants.js';

const { APP_SECRET } = process.env;


// Create client token for SDK initialization
export const generateClientToken = async (req, res, next) => {
  try {
    console.log('Generating client token for SDK initialization');

    // Get access token first
    const accessToken = await generateAccessToken();

    // Generate client token
    const response = await fetch(
      'https://api-m.sandbox.paypal.com/v1/identity/generate-token',
      {
        method: 'post',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.status !== 200) {
      console.error('Failed to generate client token:', data);
      return res.status(response.status).json({
        error: 'Failed to generate client token',
        details: data,
      });
    }

    // Return both the token and clientId for convenient frontend usage
    res.json({
      clientId: CLIENT_ID,
      clientToken: data.client_token,
    });
  } catch (err) {
    console.error('Error generating client token:', err);
    next(err);
  }
};

// ACH SDK v6 requires a JWT client token from oauth2/token (response_type=client_token).
// The existing /api/client-token uses v1/identity/generate-token which returns an opaque
// token — not a JWT — and the ACH SDK rejects it.
export const generateAchClientToken = async (req, res, next) => {
  try {
    const auth = Buffer.from(`${CLIENT_ID}:${APP_SECRET}`).toString('base64');
    const response = await fetch(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&response_type=client_token',
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to generate ACH client token',
        details: data,
      });
    }

    res.json({
      clientId: CLIENT_ID,
      clientToken: data.access_token,
    });
  } catch (err) {
    next(err);
  }
};
