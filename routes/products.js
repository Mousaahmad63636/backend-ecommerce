// backend/routes/products.js
const router = require('express').Router();
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/add', upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    const imagesPaths = req.files.map(file => `/uploads/products/${file.filename}`);

    const newProduct = new Product({
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      category: req.body.category,
      images: imagesPaths
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: error.message });
  }
});
// backend/routes/products.js - in the getBestSelling route
router.get('/best-selling', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ salesCount: -1 })
      .limit(8); // Fetch at least 8 products
    res.json(products);
  } catch (err) {
    console.error('Error fetching best selling products:', err);
    res.status(500).json({ message: err.message });
  }
});
// Get black friday status
router.get('/black-friday', async (req, res) => {
  try {
    const blackFridayProduct = await Product.findOne({
      isBlackFridayDeal: true,
      discountEndDate: { $gt: new Date() }
    }).lean();

    if (!blackFridayProduct) {
      return res.json({ isActive: false });
    }

    res.json({
      isActive: true,
      discountPercentage: blackFridayProduct.discountPercentage,
      endDate: blackFridayProduct.discountEndDate
    });
  } catch (err) {
    console.error('Black Friday data error:', err);
    res.json({ isActive: false });
  }
});

// Apply black friday discount
router.post('/black-friday', adminAuth, async (req, res) => {
  try {
    const { discountPercentage, endDate } = req.body;

    if (!discountPercentage || !endDate) {
      return res.status(400).json({ message: 'Discount percentage and end date are required' });
    }

    const endDateTime = new Date(endDate);
    if (endDateTime <= new Date()) {
      return res.status(400).json({ message: 'End date must be in the future' });
    }

    const result = await Product.updateMany(
      {},
      {
        $set: {
          isBlackFridayDeal: true,
          discountPercentage: discountPercentage,
          discountEndDate: endDateTime,
          originalPrice: { $cond: [{ $ifNull: ['$originalPrice', false] }, '$originalPrice', '$price'] },
          price: {
            $multiply: [
              { $cond: [{ $ifNull: ['$originalPrice', false] }, '$originalPrice', '$price'] },
              { $subtract: [1, { $divide: [discountPercentage, 100] }] }
            ]
          }
        }
      }
    );

    res.json({
      message: 'Black Friday discount applied successfully',
      endDate: endDateTime,
      affectedProducts: result.nModified
    });
  } catch (err) {
    console.error('Error applying Black Friday discount:', err);
    res.status(500).json({ message: 'Error applying Black Friday discount' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: err.message });
  }
});


// Update product
// Update the update product route
router.put('/:id', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      category: req.body.category
    };

    // If new images are uploaded, add them to the update data
    if (req.files && req.files.length > 0) {
      const newImagesPaths = req.files.map(file => `/uploads/products/${file.filename}`);

      // Get existing product to handle image updates
      const existingProduct = await Product.findById(req.params.id);
      if (existingProduct) {
        // If keepExisting is true in the request body, combine old and new images
        if (req.body.keepExisting === 'true') {
          updateData.images = [...existingProduct.images, ...newImagesPaths];
        } else {
          updateData.images = newImagesPaths;

          // Delete old images from storage
          existingProduct.images.forEach(imagePath => {
            const fullPath = path.join(__dirname, '..', imagePath);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          });
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add a route to delete specific images from a product
router.delete('/:id/images', adminAuth, async (req, res) => {
  try {
    const { imageIndexes } = req.body; // Array of indexes to remove
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Sort indexes in descending order to avoid shifting issues
    const sortedIndexes = imageIndexes.sort((a, b) => b - a);

    // Remove images from storage and array
    sortedIndexes.forEach(index => {
      if (index >= 0 && index < product.images.length) {
        const imagePath = product.images[index];
        const fullPath = path.join(__dirname, '..', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        product.images.splice(index, 1);
      }
    });

    // Ensure at least one image remains
    if (product.images.length === 0) {
      return res.status(400).json({ message: 'Product must have at least one image' });
    }

    await product.save();
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete associated image files
    if (product.images && product.images.length > 0) {
      product.images.forEach(imagePath => {
        // Remove the leading slash if it exists
        const cleanPath = imagePath.replace(/^\//, '');
        const fullPath = path.join(__dirname, '..', cleanPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    // Delete the product from database
    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/toggle-sold-out', async (req, res) => {
  try {
    const { soldOut } = req.body;

    if (typeof soldOut !== 'boolean') {
      return res.status(400).json({ message: 'Invalid soldOut value' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { soldOut: soldOut },
      {
        new: true,
        runValidators: true,
        select: '-__v' // Exclude version field
      }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error toggling sold out status:', error);
    res.status(400).json({ message: error.message });
  }
});
// Apply discount to products
// Apply discount to products
router.post('/discount', adminAuth, async (req, res) => {
  try {
    const { type, value, targetId, category, discountEndDate } = req.body;

    if (!value || value < 0 || value > 100) {
      return res.status(400).json({ message: 'Invalid discount percentage' });
    }

    let query = {};
    if (type === 'specific' && targetId) {
      query = { _id: targetId };
    } else if (type === 'category' && category) {
      query = { category: category };
    }

    // Find products to update
    const products = await Product.find(query);
    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found to update' });
    }

    // Update each product with discount and end date
    const updatePromises = products.map(async (product) => {
      const originalPrice = product.originalPrice || product.price;
      const discountedPrice = originalPrice * (1 - value / 100);

      return Product.findByIdAndUpdate(
        product._id,
        {
          $set: {
            originalPrice: originalPrice,
            price: discountedPrice,
            discountPercentage: value,
            discountEndDate: discountEndDate // Save the end date
          }
        },
        { new: true }
      );
    });

    const updatedProducts = await Promise.all(updatePromises);

    res.json({
      message: 'Discount applied successfully',
      products: updatedProducts
    });

  } catch (err) {
    console.error('Error applying discount:', err);
    res.status(500).json({
      message: 'Error applying discount',
      error: err.message
    });
  }
});
// Reset product discounts
router.post('/reset-discount', adminAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    let query = productId ? { _id: productId } : {};

    // Modified update operation to handle price updates correctly
    const updateOperation = {
      $set: {
        price: '$originalPrice',
        discountPercentage: 0,
        discountEndDate: null,
        isBlackFridayDeal: false
      }
    };

    // First update to restore original prices
    await Product.updateMany(
      query,
      [
        {
          $set: {
            price: { $ifNull: ['$originalPrice', '$price'] },
            discountPercentage: 0,
            discountEndDate: null,
            isBlackFridayDeal: false,
            originalPrice: null
          }
        }
      ]
    );

    // Fetch updated products
    const updatedProducts = await Product.find(query);

    res.json({
      message: 'Discount reset successfully',
      products: updatedProducts
    });

  } catch (err) {
    console.error('Error resetting discount:', err);
    res.status(500).json({
      message: 'Error resetting discount',
      error: err.message
    });
  }
});

module.exports = router;