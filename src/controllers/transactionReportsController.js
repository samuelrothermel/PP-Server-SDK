const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.CLIENT_ID}:${process.env.APP_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Token request failed');
  return data.access_token;
}

async function paypalGet(path, accessToken) {
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'PayPal API error'), { status: res.status, body: data });
  return data;
}

export const getTransactions = async (req, res, next) => {
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams(req.query).toString();
    const data = await paypalGet(`/v1/reporting/transactions?${params}`, token);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getBalance = async (req, res, next) => {
  try {
    const token = await getAccessToken();
    const data = await paypalGet('/v1/reporting/balances', token);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getTransactionSummary = async (req, res, next) => {
  try {
    const token = await getAccessToken();
    const { start_date, end_date } = req.query;
    const qs = new URLSearchParams();
    if (start_date) qs.set('start_date', start_date);
    if (end_date)   qs.set('end_date', end_date);
    const data = await paypalGet(`/v1/reporting/transactions/summary?${qs}`, token);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
