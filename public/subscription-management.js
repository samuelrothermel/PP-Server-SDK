// Subscription Management Dashboard
console.log('📋 Subscription Management loaded');

// Load subscriptions from localStorage (in production, fetch from API)
async function loadSubscriptions() {
  try {
    // Get subscription IDs from localStorage
    const subscriptionIds = JSON.parse(
      localStorage.getItem('subscriptionIds') || '[]'
    );

    if (subscriptionIds.length === 0) {
      showEmptyState();
      return;
    }

    // Fetch subscription details from server
    const subscriptions = await Promise.all(
      subscriptionIds.map(async id => {
        try {
          const response = await fetch(`/api/subscriptions/${id}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          console.error(`Error fetching subscription ${id}:`, error);
          return null;
        }
      })
    );

    const validSubscriptions = subscriptions.filter(s => s !== null);

    if (validSubscriptions.length === 0) {
      showEmptyState();
      return;
    }

    displaySubscriptions(validSubscriptions);
  } catch (error) {
    console.error('Error loading subscriptions:', error);
    showEmptyState();
  }
}

function displaySubscriptions(subscriptions) {
  const container = document.getElementById('subscriptions-container');
  const loadingState = document.getElementById('loading-state');

  loadingState.style.display = 'none';
  container.style.display = 'block';

  container.innerHTML = subscriptions
    .map(sub => createSubscriptionCard(sub))
    .join('');

  // Attach event listeners
  subscriptions.forEach(sub => {
    const cancelBtn = document.getElementById(`cancel-${sub.id}`);
    const viewBtn = document.getElementById(`view-${sub.id}`);

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => cancelSubscription(sub.id));
    }
    if (viewBtn) {
      viewBtn.addEventListener('click', () => viewSubscriptionDetails(sub));
    }
  });
}

function createSubscriptionCard(subscription) {
  const status = subscription.status || 'ACTIVE';
  const statusClass = status.toLowerCase();
  const planName = subscription.plan?.name || 'Subscription Plan';
  const amount =
    subscription.plan?.billing_cycles?.[0]?.pricing_scheme?.fixed_price
      ?.value || '0.00';
  const currency =
    subscription.plan?.billing_cycles?.[0]?.pricing_scheme?.fixed_price
      ?.currency_code || 'USD';
  const startDate = new Date(
    subscription.create_time || subscription.start_time
  ).toLocaleDateString();
  const nextBillingDate = subscription.billing_info?.next_billing_time
    ? new Date(subscription.billing_info.next_billing_time).toLocaleDateString()
    : 'N/A';

  return `
    <div class="subscription-card ${statusClass}">
      <div class="subscription-header">
        <h3>${planName}</h3>
        <span class="status-badge ${statusClass}">${status}</span>
      </div>
      
      <div class="subscription-details">
        <div class="detail-item">
          <div class="detail-label">Subscription ID</div>
          <div class="detail-value" style="font-size: 0.85em;">${
            subscription.id
          }</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Amount</div>
          <div class="detail-value">${currency} $${amount}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Start Date</div>
          <div class="detail-value">${startDate}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Next Billing</div>
          <div class="detail-value">${nextBillingDate}</div>
        </div>
      </div>
      
      <div class="action-buttons">
        <button id="view-${
          subscription.id
        }" class="btn btn-primary">View Details</button>
        ${
          status === 'ACTIVE'
            ? `
          <button id="cancel-${subscription.id}" class="btn btn-danger">Cancel Subscription</button>
        `
            : ''
        }
      </div>
    </div>
  `;
}

async function cancelSubscription(subscriptionId) {
  if (!confirm('Are you sure you want to cancel this subscription?')) {
    return;
  }

  try {
    const response = await fetch(
      `/api/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Customer requested cancellation',
        }),
      }
    );

    if (response.ok) {
      alert('Subscription cancelled successfully');
      loadSubscriptions(); // Reload the list
    } else {
      const error = await response.json();
      alert(
        `Failed to cancel subscription: ${error.message || 'Unknown error'}`
      );
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    alert('Failed to cancel subscription. Please try again.');
  }
}

function viewSubscriptionDetails(subscription) {
  console.log('Full Subscription Details:', subscription);
  alert(
    `Subscription ID: ${subscription.id}\n\nCheck console for full details.`
  );
}

function showEmptyState() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('empty-state').style.display = 'block';
}

// Load subscriptions on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSubscriptions();
});
