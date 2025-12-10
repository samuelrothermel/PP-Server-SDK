import {
  createProduct,
  getProduct,
  listProducts,
} from '../services/productsApi.js';

// Create a new product
export const createProductHandler = async (req, res, next) => {
  try {
    const { name, description, type, category, image_url, home_url } = req.body;

    if (!name || !description || !type || !category) {
      return res.status(400).json({
        error: 'Missing required fields: name, description, type, category',
      });
    }

    const product = await createProduct({
      name,
      description,
      type,
      category,
      image_url,
      home_url,
    });

    // Store product ID in response for client-side tracking
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    next(error);
  }
};

// Get product details
export const getProductHandler = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const product = await getProduct(productId);
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    next(error);
  }
};

// List all products
export const listProductsHandler = async (req, res, next) => {
  try {
    const { page = 1, page_size = 20 } = req.query;

    const products = await listProducts({ page, page_size });
    res.json(products);
  } catch (error) {
    console.error('Error listing products:', error);
    next(error);
  }
};
