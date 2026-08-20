# PayPal Server SDK Demo - Setup & Integration Reference

Complete reference for the PayPal checkout integration built with Node.js/Express backend, EJS templating, and vanilla JavaScript frontend using PayPal Server SDK v2.1.0.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [PayPal Integration Patterns](#paypal-integration-patterns)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)

---

## Prerequisites

- Node.js 18+ and npm
- PayPal Developer Account ([developer.paypal.com](https://developer.paypal.com))
- PayPal Sandbox credentials (Client ID and Secret)

---

## Project Structure

```
paypal-react-integration/
├── server/                          # Backend (Node.js/Express)
│   ├── src/
│   │   ├── config/
│   │   │   ├── constants.js        # Environment variables
│   │   │   └── errorHandler.js     # Error handling middleware
│   │   ├── services/
│   │   │   ├── paypalClient.js     # PayPal SDK initialization
│   │   │   └── ordersApi.js        # Orders API integration
│   │   ├── controllers/
│   │   │   └── orderController.js  # Request handlers
│   │   └── routes/
│   │       └── api.js              # API routes
│   ├── .env                        # Environment variables
│   ├── package.json
│   └── server.js                   # Express server entry point
│
├── client/                          # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── PayPalButtons.jsx   # PayPal button component
│   │   │   ├── PayLaterButtons.jsx # Pay Later button component
│   │   │   └── Checkout.jsx        # Main checkout page
│   │   ├── hooks/
│   │   │   └── usePayPal.js        # PayPal SDK hook
│   │   ├── services/
│   │   │   └── api.js              # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## Backend Setup

### 1. Initialize Backend

```bash
mkdir paypal-react-integration
cd paypal-react-integration
mkdir server
cd server
npm init -y
```

### 2. Install Backend Dependencies

```bash
npm install express cors dotenv @paypal/paypal-server-sdk
npm install nodemon --save-dev
```

### 3. Configure package.json

Add to `server/package.json`:

```json
{
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### 4. Create Environment File

Create `server/.env`:

```env
CLIENT_ID=your_paypal_client_id
APP_SECRET=your_paypal_app_secret
NODE_ENV=sandbox
PORT=3001
VITE_APP_URL=http://localhost:5173
```

### 5. Create Backend Files

#### `server/src/config/constants.js`

```javascript
import dotenv from 'dotenv';
dotenv.config();

export const CLIENT_ID = process.env.CLIENT_ID;
export const APP_SECRET = process.env.APP_SECRET;
export const NODE_ENV = process.env.NODE_ENV || 'sandbox';
export const PORT = process.env.PORT || 3001;
export const VITE_APP_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
```

#### `server/src/config/errorHandler.js`

```javascript
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    details: NODE_ENV === 'development' ? err.stack : undefined,
  });
};
```

#### `server/src/services/paypalClient.js`

```javascript
import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';
import { CLIENT_ID, APP_SECRET, NODE_ENV } from '../config/constants.js';

// Determine environment
const environment =
  NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox;

// Initialize PayPal client
const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: CLIENT_ID,
    oAuthClientSecret: APP_SECRET,
  },
  timeout: 0,
  environment: environment,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});

// Export controller instances
export const ordersController = client.ordersController;
export const paymentsController = client.paymentsController;
export const vaultController = client.vaultController;

export default client;
```

#### `server/src/services/ordersApi.js`

```javascript
import { ordersController } from './paypalClient.js';

/**
 * Create a PayPal order
 */
export const createOrder = async orderData => {
  try {
    const { amount, currency = 'USD', fundingSource } = orderData;

    const request = {
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
      },
    };

    // Add payment source if specified
    if (fundingSource) {
      request.body.payment_source = {
        [fundingSource]: {},
      };
    }

    const { result } = await ordersController.ordersCreate(request);
    return result;
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
};

/**
 * Capture a PayPal order
 */
export const captureOrder = async orderId => {
  try {
    const { result } = await ordersController.ordersCapture({
      id: orderId,
      prefer: 'return=representation',
    });
    return result;
  } catch (error) {
    console.error('Capture order error:', error);
    throw error;
  }
};
```

#### `server/src/controllers/orderController.js`

```javascript
import {
  createOrder as createOrderApi,
  captureOrder as captureOrderApi,
} from '../services/ordersApi.js';

export const createOrder = async (req, res, next) => {
  try {
    const order = await createOrderApi(req.body);
    res.json(order);
  } catch (error) {
    next(error);
  }
};

export const captureOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const capture = await captureOrderApi(orderId);
    res.json(capture);
  } catch (error) {
    next(error);
  }
};
```

#### `server/src/routes/api.js`

```javascript
import express from 'express';
import { createOrder, captureOrder } from '../controllers/orderController.js';

const router = express.Router();

router.post('/orders', createOrder);
router.post('/orders/:orderId/capture', captureOrder);

export default router;
```

#### `server/server.js`

```javascript
import express from 'express';
import cors from 'cors';
import apiRoutes from './src/routes/api.js';
import { errorHandler } from './src/config/errorHandler.js';
import { PORT, VITE_APP_URL } from './src/config/constants.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: VITE_APP_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📱 Frontend expected at ${VITE_APP_URL}`);
});
```

---

## Frontend Setup

### 1. Initialize Vite + React

```bash
# From project root
npm create vite@latest client -- --template react
cd client
npm install
```

### 2. Install Frontend Dependencies

```bash
npm install axios
```

### 3. Configure Vite

Update `client/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

### 4. Create Environment File

Create `client/.env`:

```env
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
VITE_API_URL=http://localhost:3001
```

### 5. Create Frontend Files

#### `client/src/services/api.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const createOrder = async orderData => {
  const response = await api.post('/api/orders', orderData);
  return response.data;
};

export const captureOrder = async orderId => {
  const response = await api.post(`/api/orders/${orderId}/capture`);
  return response.data;
};

export default api;
```

#### `client/src/hooks/usePayPal.js`

```javascript
import { useEffect, useState } from 'react';

/**
 * Custom hook to load PayPal SDK
 * @param {Object} options - SDK options (clientId, currency, components, etc.)
 */
export const usePayPal = (options = {}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if already loaded
    if (window.paypal) {
      setIsLoaded(true);
      return;
    }

    const {
      clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID,
      currency = 'USD',
      components = 'buttons,messages',
      enableFunding = '',
      disableFunding = '',
    } = options;

    // Build SDK URL
    const params = new URLSearchParams({
      'client-id': clientId,
      currency,
      components,
    });

    if (enableFunding) params.append('enable-funding', enableFunding);
    if (disableFunding) params.append('disable-funding', disableFunding);

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.setAttribute('data-sdk-integration-source', 'developer-studio');

    script.onload = () => {
      console.log('✅ PayPal SDK loaded');
      setIsLoaded(true);
    };

    script.onerror = () => {
      console.error('❌ Failed to load PayPal SDK');
      setError(new Error('Failed to load PayPal SDK'));
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector(
        `script[src^="https://www.paypal.com/sdk/js"]`,
      );
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, [options]);

  return { isLoaded, error, paypal: window.paypal };
};
```

#### `client/src/components/PayPalButtons.jsx`

```jsx
import { useEffect, useRef, useState } from 'react';
import { usePayPal } from '../hooks/usePayPal';
import {
  createOrder as createOrderApi,
  captureOrder as captureOrderApi,
} from '../services/api';

const PayPalButtons = ({
  amount = '100.00',
  currency = 'USD',
  onSuccess,
  onError,
  onCancel,
}) => {
  const containerRef = useRef(null);
  const [buttonRendered, setButtonRendered] = useState(false);
  const {
    isLoaded,
    error: sdkError,
    paypal,
  } = usePayPal({
    components: 'buttons,messages',
    enableFunding: 'paylater',
  });

  useEffect(() => {
    if (!isLoaded || !paypal || buttonRendered) return;

    // Render PayPal button
    paypal
      .Buttons({
        fundingSource: paypal.FUNDING.PAYPAL,

        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
        },

        createOrder: async (data, actions) => {
          try {
            console.log('Creating PayPal order...');
            const order = await createOrderApi({
              amount,
              currency,
              fundingSource: 'paypal',
            });
            return order.id;
          } catch (error) {
            console.error('Create order error:', error);
            onError?.(error);
            throw error;
          }
        },

        onApprove: async (data, actions) => {
          try {
            console.log('Order approved, capturing...');
            const capture = await captureOrderApi(data.orderID);
            console.log('Capture successful:', capture);
            onSuccess?.(capture);
          } catch (error) {
            console.error('Capture error:', error);
            onError?.(error);
          }
        },

        onError: err => {
          console.error('PayPal button error:', err);
          onError?.(err);
        },

        onCancel: data => {
          console.log('Payment cancelled:', data);
          onCancel?.(data);
        },
      })
      .render(containerRef.current)
      .then(() => {
        console.log('✅ PayPal button rendered');
        setButtonRendered(true);
      })
      .catch(err => {
        console.error('Failed to render PayPal button:', err);
        onError?.(err);
      });
  }, [
    isLoaded,
    paypal,
    amount,
    currency,
    buttonRendered,
    onSuccess,
    onError,
    onCancel,
  ]);

  if (sdkError) {
    return (
      <div style={{ color: 'red' }}>
        Error loading PayPal SDK: {sdkError.message}
      </div>
    );
  }

  if (!isLoaded) {
    return <div>Loading PayPal...</div>;
  }

  return <div ref={containerRef} id="paypal-button-container"></div>;
};

export default PayPalButtons;
```

#### `client/src/components/PayLaterButtons.jsx`

```jsx
import { useEffect, useRef, useState } from 'react';
import { usePayPal } from '../hooks/usePayPal';
import {
  createOrder as createOrderApi,
  captureOrder as captureOrderApi,
} from '../services/api';

const PayLaterButtons = ({
  amount = '100.00',
  currency = 'USD',
  onSuccess,
  onError,
  onCancel,
}) => {
  const containerRef = useRef(null);
  const [buttonRendered, setButtonRendered] = useState(false);
  const {
    isLoaded,
    error: sdkError,
    paypal,
  } = usePayPal({
    components: 'buttons,messages',
    enableFunding: 'paylater',
  });

  useEffect(() => {
    if (!isLoaded || !paypal || buttonRendered) return;

    // Render Pay Later button
    paypal
      .Buttons({
        fundingSource: paypal.FUNDING.PAYLATER,

        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paylater',
        },

        createOrder: async (data, actions) => {
          try {
            console.log('Creating Pay Later order...');
            const order = await createOrderApi({
              amount,
              currency,
              fundingSource: 'paylater',
            });
            return order.id;
          } catch (error) {
            console.error('Create order error:', error);
            onError?.(error);
            throw error;
          }
        },

        onApprove: async (data, actions) => {
          try {
            console.log('Order approved, capturing...');
            const capture = await captureOrderApi(data.orderID);
            console.log('Capture successful:', capture);
            onSuccess?.(capture);
          } catch (error) {
            console.error('Capture error:', error);
            onError?.(error);
          }
        },

        onError: err => {
          console.error('Pay Later button error:', err);
          onError?.(err);
        },

        onCancel: data => {
          console.log('Payment cancelled:', data);
          onCancel?.(data);
        },
      })
      .render(containerRef.current)
      .then(() => {
        console.log('✅ Pay Later button rendered');
        setButtonRendered(true);
      })
      .catch(err => {
        console.error('Failed to render Pay Later button:', err);
        onError?.(err);
      });
  }, [
    isLoaded,
    paypal,
    amount,
    currency,
    buttonRendered,
    onSuccess,
    onError,
    onCancel,
  ]);

  if (sdkError) {
    return (
      <div style={{ color: 'red' }}>
        Error loading PayPal SDK: {sdkError.message}
      </div>
    );
  }

  if (!isLoaded) {
    return <div>Loading PayPal...</div>;
  }

  return <div ref={containerRef} id="paylater-button-container"></div>;
};

export default PayLaterButtons;
```

#### `client/src/components/Checkout.jsx`

```jsx
import { useState } from 'react';
import PayPalButtons from './PayPalButtons';
import PayLaterButtons from './PayLaterButtons';
import './Checkout.css';

const Checkout = () => {
  const [amount] = useState('260.00');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSuccess = captureData => {
    setError(null);
    setResult({
      type: 'success',
      orderId: captureData.id,
      status: captureData.status,
      payerEmail: captureData.payer?.email_address,
    });
  };

  const handleError = err => {
    setResult(null);
    setError(err.message || 'An error occurred');
  };

  const handleCancel = () => {
    setResult(null);
    setError('Payment was cancelled');
  };

  return (
    <div className="checkout-container">
      <header>
        <h1>Buy Now Pay Later (BNPL) Demo</h1>
        <p>PayPal + Pay Later Integration with React + Vite</p>
      </header>

      <div className="checkout-layout">
        {/* Left Side: Order Summary */}
        <div className="checkout-left">
          <div className="order-summary">
            <h3>Order Summary</h3>
            <div className="order-row">
              <span>Item:</span>
              <span>${amount}</span>
            </div>
            <div className="order-row total">
              <span>Total:</span>
              <span>${amount}</span>
            </div>
          </div>

          {/* Integration Info */}
          <div className="info-box">
            <h4>Integration Details</h4>
            <ul>
              <li>
                <strong>Frontend:</strong> React 18 + Vite
              </li>
              <li>
                <strong>Backend:</strong> Node.js/Express
              </li>
              <li>
                <strong>SDK:</strong> PayPal Server SDK v2
              </li>
              <li>
                <strong>Feature:</strong> BNPL with enable-funding=paylater
              </li>
            </ul>
          </div>
        </div>

        {/* Right Side: Payment Buttons */}
        <div className="checkout-right">
          <h3>Choose Payment Method</h3>

          <div className="button-section">
            <h4>PayPal</h4>
            <PayPalButtons
              amount={amount}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={handleCancel}
            />
          </div>

          <div className="button-section">
            <h4>Pay Later</h4>
            <PayLaterButtons
              amount={amount}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={handleCancel}
            />
          </div>

          {/* Note about functionality */}
          <div className="note-box">
            <strong>ℹ️ Note:</strong> Both buttons provide the same
            functionality. Pay Later eligibility is determined by PayPal based
            on buyer qualifications.
          </div>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="result success">
          <h3>✅ Payment Successful!</h3>
          <p>
            <strong>Order ID:</strong> {result.orderId}
          </p>
          <p>
            <strong>Status:</strong> {result.status}
          </p>
          {result.payerEmail && (
            <p>
              <strong>Email:</strong> {result.payerEmail}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="result error">
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default Checkout;
```

#### `client/src/components/Checkout.css`

```css
.checkout-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
}

header {
  text-align: center;
  margin-bottom: 40px;
}

header h1 {
  color: #0070ba;
  margin-bottom: 10px;
}

header p {
  color: #666;
}

.checkout-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

@media (max-width: 768px) {
  .checkout-layout {
    grid-template-columns: 1fr;
  }
}

.order-summary {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.order-summary h3 {
  margin-top: 0;
  color: #333;
}

.order-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.order-row.total {
  border-bottom: none;
  font-weight: bold;
  font-size: 1.2em;
  color: #0070ba;
}

.info-box {
  background: #e7f3ff;
  border-left: 4px solid #0070ba;
  padding: 15px;
  border-radius: 4px;
}

.info-box h4 {
  margin-top: 0;
  color: #0070ba;
}

.info-box ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}

.checkout-right h3 {
  color: #333;
  margin-bottom: 20px;
}

.button-section {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.button-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.note-box {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 12px;
  margin-top: 20px;
  color: #856404;
  font-size: 0.9em;
}

.result {
  padding: 20px;
  border-radius: 8px;
  margin-top: 30px;
}

.result.success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.result.error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.result h3 {
  margin-top: 0;
}

.result p {
  margin: 5px 0;
}
```

#### `client/src/App.jsx`

```jsx
import Checkout from './components/Checkout';
import './App.css';

function App() {
  return (
    <div className="App">
      <Checkout />
    </div>
  );
}

export default App;
```

#### `client/src/App.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
  background: #f5f5f5;
}

.App {
  min-height: 100vh;
  padding: 20px;
}
```

---

## PayPal Integration Patterns

### 1. **Standard Checkout** (Recommended)

```jsx
import PayPalButtons from './components/PayPalButtons';

<PayPalButtons
  amount="100.00"
  currency="USD"
  onSuccess={data => console.log('Success:', data)}
  onError={err => console.error('Error:', err)}
  onCancel={data => console.log('Cancelled:', data)}
/>;
```

### 2. **BNPL (Pay Later)**

```jsx
import PayLaterButtons from './components/PayLaterButtons';

<PayLaterButtons
  amount="250.00"
  currency="USD"
  onSuccess={handleSuccess}
  onError={handleError}
/>;
```

### 3. **Custom Hook Usage**

```jsx
import { usePayPal } from './hooks/usePayPal';

function CustomCheckout() {
  const { isLoaded, error, paypal } = usePayPal({
    enableFunding: 'venmo,paylater',
    disableFunding: 'card',
  });

  // Use paypal object to render custom buttons
}
```

### 4. **Vaulting (Save Payment Method)**

Backend addition to `ordersApi.js`:

```javascript
export const createOrderWithVault = async orderData => {
  const { amount, currency = 'USD', customerId } = orderData;

  const request = {
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            payment_method_selected: 'PAYPAL',
            user_action: 'PAY_NOW',
          },
          attributes: {
            vault: {
              store_in_vault: 'ON_SUCCESS',
              usage_type: 'MERCHANT',
              customer_type: 'CONSUMER',
            },
          },
        },
      },
    },
  };

  if (customerId) {
    request.body.payment_source.paypal.attributes.vault.customer_id =
      customerId;
  }

  const { result } = await ordersController.ordersCreate(request);
  return result;
};
```

---

## Environment Configuration

### Production Checklist

1. **Update `.env` files**:

   ```env
   NODE_ENV=production
   CLIENT_ID=production_client_id
   APP_SECRET=production_secret
   ```

2. **Build frontend**:

   ```bash
   cd client
   npm run build
   ```

3. **Serve frontend from Express** (Optional):

   Update `server/server.js`:

   ```javascript
   import path from 'path';
   import { fileURLToPath } from 'url';

   const __dirname = path.dirname(fileURLToPath(import.meta.url));

   // Serve React build
   app.use(express.static(path.join(__dirname, '../client/dist')));

   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, '../client/dist/index.html'));
   });
   ```

4. **Security considerations**:
   - Never expose `APP_SECRET` to frontend
   - Use HTTPS in production
   - Implement rate limiting
   - Validate all inputs server-side
   - Use CSP headers

---

## Running the Application

### Development Mode

**Terminal 1 - Backend:**

```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**

```bash
cd client
npm run dev
```

Access application at: `http://localhost:5173`

### Production Mode

```bash
# Build frontend
cd client
npm run build

# Start backend (serving static frontend)
cd ../server
npm start
```

---

## Advanced Features

### 1. **Apple Pay Integration**

Add to `usePayPal` hook:

```javascript
export const usePayPal = (options = {}) => {
  // ... existing code ...

  const params = new URLSearchParams({
    'client-id': clientId,
    currency,
    components: 'buttons,applepay', // Add applepay
    // ... other params
  });

  // ... rest of hook
};
```

Create `ApplePayButton.jsx`:

```jsx
// Similar structure to PayPalButtons but using:
// paypal.Buttons({ fundingSource: paypal.FUNDING.APPLEPAY })
```

### 2. **Google Pay Integration**

Requires HTTPS for sandbox testing. Similar pattern to Apple Pay but with:

```javascript
fundingSource: paypal.FUNDING.GOOGLEPAY;
```

### 3. **State Management with Context**

Create `PayPalContext.jsx`:

```jsx
import { createContext, useContext, useState } from 'react';

const PayPalContext = createContext();

export const PayPalProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [customer, setCustomer] = useState(null);

  return (
    <PayPalContext.Provider
      value={{ orders, setOrders, customer, setCustomer }}
    >
      {children}
    </PayPalContext.Provider>
  );
};

export const usePayPalContext = () => useContext(PayPalContext);
```

### 4. **Error Boundary**

Create `ErrorBoundary.jsx`:

```jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PayPal Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong with PayPal integration.</div>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## Testing

### Backend Tests (Optional)

```bash
npm install jest supertest --save-dev
```

Create `server/__tests__/orders.test.js`:

```javascript
import request from 'supertest';
import app from '../server.js';

describe('Orders API', () => {
  it('should create an order', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({ amount: '100.00', currency: 'USD' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
  });
});
```

### Frontend Tests

```bash
npm install @testing-library/react @testing-library/jest-dom vitest --save-dev
```

---

## Troubleshooting

### Common Issues

1. **CORS errors**: Ensure backend allows frontend origin in CORS config
2. **SDK not loading**: Check Client ID is correct and network tab for errors
3. **Button not rendering**: Verify container ref is mounted before SDK loaded
4. **Capture fails**: Check order is in APPROVED state before capturing
5. **Vite proxy not working**: Verify backend is running and proxy config is correct

### Debug Mode

Add to frontend:

```javascript
window.paypalDebug = true;
```

Add to backend error handler:

```javascript
console.log('Full error details:', JSON.stringify(err, null, 2));
```

---

## Resources

- [PayPal Server SDK Documentation](https://github.com/paypal/paypal-server-sdk)
- [PayPal JavaScript SDK Reference](https://developer.paypal.com/sdk/js/reference/)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

---

## Next Steps

1. Implement subscription billing
2. Add webhook handling
3. Implement order history dashboard
4. Add payment method vaulting UI
5. Integrate with your database
6. Add analytics tracking
7. Implement 3D Secure for cards
8. Add multi-currency support

---

**Ready to start building!** Follow the setup instructions above and customize for your specific use case.
