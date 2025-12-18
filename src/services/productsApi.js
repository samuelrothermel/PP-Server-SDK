import fetch from 'node-fetch';
import { generateAccessToken } from './authApi.js';
import { handleResponse } from '../utils/responseHandler.js';

const base = 'https://api-m.sandbox.paypal.com';

/**
 * Products API Service
 *
 * NOTE: Products API is NOT available in PayPal Server SDK v2.1.0
 * Must use Direct REST API calls
 */

// Create a product in the PayPal catalog
export const createProduct = async ({
  name,
  description,
  type,
  category,
  image_url,
  home_url,
}) => {
  const accessToken = await generateAccessToken();

  const payload = {
    name,
    description,
    type, // PHYSICAL, DIGITAL, SERVICE
    category,
    ...(image_url && { image_url }),
    ...(home_url && { home_url }),
  };

  const response = await fetch(`${base}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'PayPal-Request-Id': `product-${Date.now()}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

// Get product details
export const getProduct = async productId => {
  const accessToken = await generateAccessToken();

  const response = await fetch(`${base}/v1/catalogs/products/${productId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  return handleResponse(response);
};

// List products with pagination
export const listProducts = async ({ page = 1, page_size = 20 } = {}) => {
  const accessToken = await generateAccessToken();

  const response = await fetch(
    `${base}/v1/catalogs/products?page=${page}&page_size=${page_size}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  return handleResponse(response);
};

// Update a product
export const updateProduct = async (productId, updates) => {
  const accessToken = await generateAccessToken();

  // Build PATCH operations
  const operations = [];

  if (updates.description) {
    operations.push({
      op: 'replace',
      path: '/description',
      value: updates.description,
    });
  }

  if (updates.category) {
    operations.push({
      op: 'replace',
      path: '/category',
      value: updates.category,
    });
  }

  if (updates.image_url) {
    operations.push({
      op: 'replace',
      path: '/image_url',
      value: updates.image_url,
    });
  }

  if (updates.home_url) {
    operations.push({
      op: 'replace',
      path: '/home_url',
      value: updates.home_url,
    });
  }

  const response = await fetch(`${base}/v1/catalogs/products/${productId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(operations),
  });

  if (response.status === 204) {
    // PATCH returns 204 No Content on success
    return { success: true, message: 'Product updated successfully' };
  }

  return handleResponse(response);
};
