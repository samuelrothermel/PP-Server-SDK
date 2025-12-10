// Products Management Dashboard
console.log('📦 Products Management loaded');

// Create Product Form Handler
document
  .getElementById('create-product-form')
  .addEventListener('submit', async e => {
    e.preventDefault();

    const formData = {
      name: document.getElementById('product-name').value,
      description: document.getElementById('product-description').value,
      type: document.getElementById('product-type').value,
      category: document.getElementById('product-category').value,
    };

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const product = await response.json();
        showSuccess(
          `Product "${product.name}" created successfully! ID: ${product.id}`
        );
        document.getElementById('create-product-form').reset();
        loadProducts(); // Reload the products list
      } else {
        const error = await response.json();
        showError(
          `Failed to create product: ${error.message || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Error creating product:', error);
      showError('Failed to create product. Please try again.');
    }
  });

// Load Products
async function loadProducts() {
  try {
    // Get product IDs from localStorage
    const productIds = JSON.parse(localStorage.getItem('productIds') || '[]');

    if (productIds.length === 0) {
      showEmptyState();
      return;
    }

    // Fetch product details from server
    const products = await Promise.all(
      productIds.map(async id => {
        try {
          const response = await fetch(`/api/products/${id}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          console.error(`Error fetching product ${id}:`, error);
          return null;
        }
      })
    );

    const validProducts = products.filter(p => p !== null);

    if (validProducts.length === 0) {
      showEmptyState();
      return;
    }

    displayProducts(validProducts);
  } catch (error) {
    console.error('Error loading products:', error);
    showEmptyState();
  }
}

function displayProducts(products) {
  const container = document.getElementById('products-container');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');

  loadingState.style.display = 'none';
  emptyState.style.display = 'none';
  container.style.display = 'grid';

  container.innerHTML = products
    .map(product => createProductCard(product))
    .join('');
}

function createProductCard(product) {
  const createdDate = new Date(product.create_time).toLocaleDateString();

  return `
    <div class="product-card">
      <h3>${product.name}</h3>
      <p class="description">${product.description || 'No description'}</p>
      
      <div class="product-meta">
        <div class="product-meta-item">
          <span class="product-meta-label">Type</span>
          <span class="product-meta-value">${product.type || 'N/A'}</span>
        </div>
        <div class="product-meta-item">
          <span class="product-meta-label">Category</span>
          <span class="product-meta-value">${product.category || 'N/A'}</span>
        </div>
      </div>
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
        <div style="font-size: 0.85em; color: #666;">
          <strong>Product ID:</strong><br>
          <code style="background: #f8f9fa; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${
            product.id
          }</code>
        </div>
        <div style="font-size: 0.85em; color: #666; margin-top: 10px;">
          <strong>Created:</strong> ${createdDate}
        </div>
      </div>
    </div>
  `;
}

function showEmptyState() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('products-container').style.display = 'none';
}

function showSuccess(message) {
  const successDiv = document.getElementById('success-message');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 5000);
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Load products on page load
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
});
