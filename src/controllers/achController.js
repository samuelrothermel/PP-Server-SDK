import fetch from 'node-fetch';
import { generateAccessToken } from '../services/authApi.js';

const BASE = 'https://api-m.sandbox.paypal.com';

export const createAchOrder = async (req, res, next) => {
  try {
    const { amount = '50.00' } = req.body;
    const accessToken = await generateAccessToken();

    const response = await fetch(`${BASE}/v2/checkout/orders`, {
      method: 'POST',
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
              value: String(amount),
            },
          },
        ],
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    next(err);
  }
};

export const getAchOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const accessToken = await generateAccessToken();

    const response = await fetch(`${BASE}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    next(err);
  }
};

export const captureAchOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const {
      account_number,
      routing_number,
      account_type,
      account_holder_name,
      ownership_type,
      sec_code,
      billing_address,
    } = req.body;

    const accessToken = await generateAccessToken();

    const achDebit = {
      account_number,
      routing_number,
      account_type,
      account_holder_name,
      ownership_type,
      attributes: {
        verification: {
          external: { status: 'VERIFIED' },
        },
      },
      payment_context: {
        standard_entry_class_code: sec_code || 'WEB',
      },
    };

    if (billing_address && billing_address.address_line_1) {
      achDebit.billing_address = billing_address;
    }

    const response = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': `ach-capture-${orderId}-${Date.now()}`,
      },
      body: JSON.stringify({
        payment_source: {
          bank: { ach_debit: achDebit },
        },
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    next(err);
  }
};
