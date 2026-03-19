/**
 * 3D Secure Vault Testing - API-Driven Approach
 *
 * This demonstrates the API approach where 3D Secure parameters are configured
 * and passed via server-side PayPal API calls, not client-side SDK configuration.
 *
 * Flow:
 * 1. Create setup token with verification_method via API (server-side)
 * 2. Use PayPal Card Fields SDK for card input convenience (client-side UI)
 * 3. Create payment token via API (server-side)
 * 4. Use vaulted payment token with stored_credential via API (server-side)
 *
 * Key Point: All 3DS configuration happens via API calls, not SDK options.
 */

// State management
const state = {
  setupToken: null,
  setupTokenId: null,
  paymentToken: null,
  paymentTokenId: null,
  orderId: null,
  cardFields: null,
  cardFieldsReady: false,
};

// DOM Elements
let btnCreateSetupToken;
let btnSubmitCard;
let btnCreatePaymentToken;
let btnCreateOrder;
let btnCaptureOrder;
let btnReset;
let statusMessage;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  console.log('[3DS Vault] Page loaded, initializing...');
  initializeButtons();
  setActiveStep(1);
});

// Initialize button references and event listeners
function initializeButtons() {
  btnCreateSetupToken = document.getElementById('btn-create-setup-token');
  btnSubmitCard = document.getElementById('btn-submit-card');
  btnCreatePaymentToken = document.getElementById('btn-create-payment-token');
  btnCreateOrder = document.getElementById('btn-create-order');
  btnCaptureOrder = document.getElementById('btn-capture-order');
  btnReset = document.getElementById('btn-reset');
  statusMessage = document.getElementById('status-message');

  btnCreateSetupToken.addEventListener('click', handleCreateSetupToken);
  btnSubmitCard.addEventListener('click', handleSubmitCard);
  btnCreatePaymentToken.addEventListener('click', handleCreatePaymentToken);
  btnCreateOrder.addEventListener('click', handleCreateOrder);
  btnCaptureOrder.addEventListener('click', handleCaptureOrder);
  btnReset.addEventListener('click', handleReset);
}

// Step 1: Create Setup Token with SCA_ALWAYS
async function handleCreateSetupToken() {
  console.log('[3DS API] ========================================');
  console.log('[3DS API] Step 1: Creating setup token via API');
  console.log('[3DS API] API Call: POST /api/vault/3ds/setup-token');
  console.log('[3DS API] 3DS Parameter: verification_method = SCA_ALWAYS');
  console.log('[3DS API] ========================================');

  btnCreateSetupToken.disabled = true;
  btnCreateSetupToken.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    // API call to create setup token with 3DS parameters (server-side)
    const response = await fetch('/api/vault/3ds/setup-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentSource: 'card',
        verificationMethod: 'SCA_ALWAYS', // 3DS parameter passed to API
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create setup token');
    }

    const data = await response.json();
    console.log('[3DS API] Setup token created successfully via API');
    console.log('[3DS API] Token ID:', data.id);
    console.log(
      '[3DS API] Check server logs for full API request/response details',
    );

    state.setupToken = data;
    state.setupTokenId = data.id;

    // Display results
    displayResult('setup-token-result', 'setup-token-json', data);
    showMessage(
      'Setup token created successfully! Now enter card details.',
      'success',
    );

    // Move to step 2
    setActiveStep(2);
    document.getElementById('section-card-auth').style.display = 'block';

    // Initialize PayPal Card Fields with the setup token
    await initializeCardFields(data.id);

    btnCreateSetupToken.innerHTML = '✓ Setup Token Created';
  } catch (error) {
    console.error('[3DS Vault] Error creating setup token:', error);
    showMessage(`Error: ${error.message}`, 'error');
    btnCreateSetupToken.disabled = false;
    btnCreateSetupToken.innerHTML = 'Create Setup Token with SCA_ALWAYS';
  }
}

// Initialize PayPal Card Fields for 3DS authentication
async function initializeCardFields(setupTokenId) {
  console.log(
    '[3DS Vault] Initializing Card Fields with setup token:',
    setupTokenId,
  );

  try {
    if (!window.paypal || !window.paypal.CardFields) {
      throw new Error(
        'PayPal SDK not loaded or CardFields component not available',
      );
    }

    // Check if CardFields is eligible
    const cardFieldsEligible = window.paypal.CardFields.isEligible();
    console.log('[3DS Vault] CardFields eligible:', cardFieldsEligible);

    if (!cardFieldsEligible) {
      throw new Error('CardFields not eligible. Check SDK configuration.');
    }

    // Create CardFields instance
    state.cardFields = window.paypal.CardFields({
      style: {
        input: {
          'font-size': '16px',
          'font-family':
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#333',
        },
        '.invalid': {
          color: '#dc3545',
        },
      },
      createVaultSetupToken: async () => {
        // Return the setup token ID that we already created
        console.log(
          '[3DS Vault] Providing setup token to CardFields:',
          setupTokenId,
        );
        return setupTokenId;
      },
    });

    // Render individual fields
    if (state.cardFields.NumberField) {
      await state.cardFields.NumberField().render('#card-number-field');
      console.log('[3DS Vault] Card number field rendered');
    }

    if (state.cardFields.ExpiryField) {
      await state.cardFields.ExpiryField().render('#card-expiry-field');
      console.log('[3DS Vault] Expiry field rendered');
    }

    if (state.cardFields.CVVField) {
      await state.cardFields.CVVField().render('#card-cvv-field');
      console.log('[3DS Vault] CVV field rendered');
    }

    // Enable submit button once fields are ready
    state.cardFieldsReady = true;
    btnSubmitCard.disabled = false;
    console.log('[3DS Vault] Card Fields initialized successfully');
  } catch (error) {
    console.error('[3DS Vault] Error initializing Card Fields:', error);
    showMessage(`Error initializing card fields: ${error.message}`, 'error');
    throw error;
  }
}

// Step 2: Submit card and handle 3DS authentication
async function handleSubmitCard() {
  console.log('[3DS Vault] Submitting card for 3DS authentication...');

  if (!state.cardFields) {
    showMessage('Card fields not initialized', 'error');
    return;
  }

  btnSubmitCard.disabled = true;
  btnSubmitCard.innerHTML = '<span class="spinner"></span> Authenticating...';

  try {
    // Submit the card fields - this will trigger 3DS authentication
    const { orderID } = await state.cardFields.submit({
      // Optional: You can pass additional data here
      contingencies: ['3D_SECURE'],
    });

    console.log('[3DS Vault] 3DS authentication successful!', orderID);

    const result = {
      status: 'SUCCESS',
      message: '3D Secure authentication completed successfully',
      setupTokenId: state.setupTokenId,
    };

    displayResult('card-auth-result', 'card-auth-json', result);
    showMessage(
      '3D Secure authentication successful! You can now create a payment token.',
      'success',
    );

    // Move to step 3
    setActiveStep(3);
    document.getElementById('section-payment-token').style.display = 'block';
    document.getElementById('display-setup-token-id').textContent =
      state.setupTokenId;

    btnSubmitCard.innerHTML = '✓ 3DS Authenticated';
  } catch (error) {
    console.error('[3DS Vault] 3DS authentication error:', error);
    showMessage(
      `3DS Authentication failed: ${error.message || 'Unknown error'}`,
      'error',
    );
    btnSubmitCard.disabled = false;
    btnSubmitCard.innerHTML = 'Submit Card & Authenticate';
  }
}

// Step 3: Create Payment Token from Setup Token
async function handleCreatePaymentToken() {
  console.log('[3DS API] ========================================');
  console.log('[3DS API] Step 3: Creating payment token via API');
  console.log('[3DS API] API Call: POST /api/vault/payment-token/:setupToken');
  console.log(
    '[3DS API] References setup token with completed 3DS authentication',
  );
  console.log('[3DS API] ========================================');

  btnCreatePaymentToken.disabled = true;
  btnCreatePaymentToken.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    const response = await fetch(
      `/api/vault/payment-token/${state.setupTokenId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment token');
    }

    const data = await response.json();
    console.log('[3DS API] Payment token created successfully via API');
    console.log('[3DS API] Payment Token (vault_id):', data.id);
    console.log('[3DS API] This token stores the 3DS-authenticated card');

    state.paymentToken = data;
    state.paymentTokenId = data.id;

    // Display results
    displayResult('payment-token-result', 'payment-token-json', data);
    showMessage(
      'Payment token created successfully! You can now use it for orders.',
      'success',
    );

    // Move to step 4
    setActiveStep(4);
    document.getElementById('section-order-capture').style.display = 'block';
    document.getElementById('display-payment-token-id').textContent = data.id;

    // Display card details if available
    if (data.payment_source?.card) {
      const card = data.payment_source.card;
      document.getElementById('display-card-last4').textContent =
        card.last_digits || 'N/A';
      document.getElementById('display-card-brand').textContent =
        card.brand || 'N/A';
    }

    btnCreatePaymentToken.innerHTML = '✓ Payment Token Created';
  } catch (error) {
    console.error('[3DS Vault] Error creating payment token:', error);
    showMessage(`Error: ${error.message}`, 'error');
    btnCreatePaymentToken.disabled = false;
    btnCreatePaymentToken.innerHTML = 'Create Payment Token';
  }
}

// Step 4a: Create Order with Vaulted Payment Token
async function handleCreateOrder() {
  console.log('[3DS API] ========================================');
  console.log('[3DS API] Step 4: Creating order with vaulted card via API');
  console.log('[3DS API] API Call: POST /api/vault/create-order');
  console.log(
    '[3DS API] Using vault_id (payment token):',
    state.paymentTokenId,
  );
  console.log(
    '[3DS API] Will include stored_credential parameters in API call',
  );
  console.log('[3DS API] ========================================');

  const amount = document.getElementById('order-amount').value;

  if (!amount || parseFloat(amount) <= 0) {
    showMessage('Please enter a valid order amount', 'error');
    return;
  }

  btnCreateOrder.disabled = true;
  btnCreateOrder.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    const response = await fetch('/api/vault/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vault_id: state.paymentTokenId,
        payment_source_type: 'card',
        amount: amount,
        currency_code: 'USD',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create order');
    }

    const data = await response.json();
    console.log('[3DS API] Order created successfully via API');
    console.log('[3DS API] Order ID:', data.id);
    console.log(
      '[3DS API] stored_credential parameters were passed server-side',
    );

    state.orderId = data.id;

    // Display results
    displayResult('order-result', 'order-json', data);
    showMessage(
      'Order created successfully! Now capture the payment.',
      'success',
    );

    btnCreateOrder.innerHTML = '✓ Order Created';
    btnCaptureOrder.disabled = false;
  } catch (error) {
    console.error('[3DS Vault] Error creating order:', error);
    showMessage(`Error: ${error.message}`, 'error');
    btnCreateOrder.disabled = false;
    btnCreateOrder.innerHTML = 'Create Order';
  }
}

// Step 4b: Capture the Order
async function handleCaptureOrder() {
  console.log('[3DS Vault] Capturing order:', state.orderId);

  btnCaptureOrder.disabled = true;
  btnCaptureOrder.innerHTML = '<span class="spinner"></span> Capturing...';

  try {
    const response = await fetch(`/api/orders/${state.orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to capture order');
    }

    const data = await response.json();
    console.log('[3DS Vault] Order captured:', data);

    // Display results
    displayResult('order-result', 'order-json', data);
    showMessage(
      'Order captured successfully! 3DS vault flow completed. 🎉',
      'success',
    );

    btnCaptureOrder.innerHTML = '✓ Order Captured';
  } catch (error) {
    console.error('[3DS Vault] Error capturing order:', error);
    showMessage(`Error: ${error.message}`, 'error');
    btnCaptureOrder.disabled = false;
    btnCaptureOrder.innerHTML = 'Capture Order';
  }
}

// Reset the entire flow
function handleReset() {
  console.log('[3DS Vault] Resetting flow...');

  // Reset state
  state.setupToken = null;
  state.setupTokenId = null;
  state.paymentToken = null;
  state.paymentTokenId = null;
  state.orderId = null;
  state.cardFields = null;
  state.cardFieldsReady = false;

  // Reset UI
  setActiveStep(1);

  // Hide sections
  document.getElementById('section-card-auth').style.display = 'none';
  document.getElementById('section-payment-token').style.display = 'none';
  document.getElementById('section-order-capture').style.display = 'none';

  // Hide results
  document.getElementById('setup-token-result').style.display = 'none';
  document.getElementById('card-auth-result').style.display = 'none';
  document.getElementById('payment-token-result').style.display = 'none';
  document.getElementById('order-result').style.display = 'none';

  // Reset buttons
  btnCreateSetupToken.disabled = false;
  btnCreateSetupToken.innerHTML = 'Create Setup Token with SCA_ALWAYS';
  btnSubmitCard.disabled = true;
  btnSubmitCard.innerHTML = 'Submit Card & Authenticate';
  btnCreatePaymentToken.disabled = false;
  btnCreatePaymentToken.innerHTML = 'Create Payment Token';
  btnCreateOrder.disabled = false;
  btnCreateOrder.innerHTML = 'Create Order';
  btnCaptureOrder.disabled = true;
  btnCaptureOrder.innerHTML = 'Capture Order';

  // Clear card fields
  const cardFieldContainers = [
    'card-number-field',
    'card-cvv-field',
    'card-expiry-field',
  ];
  cardFieldContainers.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.innerHTML = '';
    }
  });

  // Reset order amount
  document.getElementById('order-amount').value = '10.00';

  showMessage('Flow reset. Start over by creating a new setup token.', 'info');
}

// Utility function to display API responses
function displayResult(containerId, jsonId, data) {
  const container = document.getElementById(containerId);
  const jsonElement = document.getElementById(jsonId);

  if (container && jsonElement) {
    jsonElement.textContent = JSON.stringify(data, null, 2);
    container.style.display = 'block';
  }
}

// Utility function to show status messages
function showMessage(message, type = 'info') {
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;

    // Auto-hide after 5 seconds for success/info messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        statusMessage.classList.remove('show');
      }, 5000);
    }
  }
}

// Utility function to set active step indicator
function setActiveStep(stepNumber) {
  // Clear all steps
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step-${i}`);
    if (step) {
      step.classList.remove('active', 'completed');

      // Mark completed steps
      if (i < stepNumber) {
        step.classList.add('completed');
      }
    }
  }

  // Set active step
  const activeStep = document.getElementById(`step-${stepNumber}`);
  if (activeStep) {
    activeStep.classList.add('active');
  }
}
