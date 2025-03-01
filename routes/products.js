// backend/routes/products.js
const router = require('express').Router();
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');
const { productUpload } = require('../middleware/upload');
const fs = require('fs');
const { DISK_MOUNT_PATH } = require('../middleware/upload');
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

// Add new product with multiple categories
router.post('/add', productUpload.array('images', 5), async (req, res) => {
  try {
    console.log('Adding product with data:', req.body);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    // Store DATABASE paths as relative URLs, not filesystem paths
    const imagesPaths = req.files.map(file => `/uploads/products/${file.filename}`);
    
    // Parse the categories array from JSON
    let categories = [];
    if (req.body.categories) {
      try {
        categories = JSON.parse(req.body.categories);
        console.log('Parsed categories:', categories);
        if (!Array.isArray(categories)) {
          categories = [];
        }
      } catch (e) {
        console.error('Error parsing categories JSON:', e);
        // Fall back to single category if JSON parsing fails
        if (req.body.category) {
          categories = [req.body.category];
        }
      }
    }

    // Ensure backward compatibility - use first category as main if not provided
    const category = req.body.category || (categories.length > 0 ? categories[0] : '');
    
    // If we have a main category but it's not in the categories array, add it
    if (category && !categories.includes(category)) {
      categories.push(category);
    }

    // Parse rating and reviewCount from the form data
    const rating = parseFloat(req.body.rating) || 4;
    const reviewCount = parseInt(req.body.reviewCount) || 0;

    const newProduct = new Product({
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      category: category,
      categories: categories,
      images: imagesPaths,
      rating: rating, 
      reviewCount: reviewCount
    });

    console.log('Saving product with categories:', categories);
    console.log('Product rating:', rating, 'review count:', reviewCount);
    
    const savedProduct = await newProduct.save();
    console.log('Saved product:', savedProduct);
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    // Delete uploaded images if product creation fails
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const filePath = path.join(DISK_MOUNT_PATH, 'products', file.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error('Error deleting file:', err);
          }
        }
      });
    }
    res.status(500).json({ message: error.message });
  }
});


// Get best selling products
router.get('/best-selling', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ salesCount: -1 })
      .limit(8);
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

// Update product with multiple categories support
router.put('/:id', productUpload.array('images', 5), async (req, res) => {
  try {
    console.log('Update request for product ID:', req.params.id);
    console.log('Request body:', req.body);
    
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      category: req.body.category,
      rating: parseFloat(req.body.rating) || 4,
      reviewCount: parseInt(req.body.reviewCount) || 0
    };

    console.log('Update data rating:', updateData.rating, 'review count:', updateData.reviewCount);

    // Handle categories array - ensure proper parsing
    if (req.body.categories) {
      try {
        const categoriesArray = JSON.parse(req.body.categories);
        console.log('Parsed categories:', categoriesArray);
        if (Array.isArray(categoriesArray)) {
          updateData.categories = categoriesArray;
          
          // Ensure main category is also in categories array
          if (updateData.category && !updateData.categories.includes(updateData.category)) {
            updateData.categories.push(updateData.category);
          }
          
          // If no main category provided but categories exist, use first one
          if (!updateData.category && updateData.categories.length > 0) {
            updateData.category = updateData.categories[0];
          }
        } else {
          console.log('Categories not an array after parsing, using fallback');
          updateData.categories = updateData.category ? [updateData.category] : [];
        }
      } catch (err) {
        console.error('Error parsing categories array:', err);
        // If parsing fails, fall back to single category
        updateData.categories = updateData.category ? [updateData.category] : [];
      }
    } else if (updateData.category) {
      // If no categories array but category exists, create a categories array with that category
      updateData.categories = [updateData.category];
    }
    
    console.log('Final update data:', updateData);

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
            const filename = path.basename(imagePath);
            const fullPath = path.join(DISK_MOUNT_PATH, 'products', filename);
            
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

    console.log('Updated product:', updatedProduct);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
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

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete associated image files
    if (product.images && product.images.length > 0) {
      product.images.forEach(imagePath => {
        // Extract filename from the URL-like path
        const filename = path.basename(imagePath);
        const fullPath = path.join(DISK_MOUNT_PATH, 'products', filename);
        
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

// Toggle product sold out status
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
      // Match products that have the category either in the category field or in the categories array
      query = {
        $or: [
          { category: category },
          { categories: category }
        ]
      };
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
router.get('/categories', async (req, res) => {
  try {
    // Find all products and select only category and categories fields
    const products = await Product.find().select('category categories');
    
    // Create a Set to store unique categories
    const categoriesSet = new Set();
    
    // Add all categories to the Set
    products.forEach(product => {
      // Add primary category
      if (product.category) {
        categoriesSet.add(product.category);
      }
      
      // Add categories from array
      if (Array.isArray(product.categories)) {
        product.categories.forEach(category => {
          if (category) categoriesSet.add(category);
        });
      }
    });
    
    // Convert Set to Array and sort alphabetically
    const categoriesList = [...categoriesSet].sort();
    
    res.json(categoriesList);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: err.message });
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