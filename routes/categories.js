// backend/routes/categories.js
const router = require('express').Router();
const Product = require('../models/Product');
const { adminAuth } = require('../middleware/auth');

// Get all categories with product counts
router.get('/', async (req, res) => {
  try {
    console.log('Fetching categories with counts...');
    
    // Get all products
    const products = await Product.find();
    
    // Create a Set for unique categories and an object for counting
    const categoriesSet = new Set();
    const categoryCounts = {};
    
    // Initialize counts for all categories
    products.forEach(product => {
      // Process primary category
      if (product.category) {
        categoriesSet.add(product.category);
        categoryCounts[product.category] = 0;
      }
      
      // Process categories array
      if (Array.isArray(product.categories)) {
        product.categories.forEach(cat => {
          if (cat) {
            categoriesSet.add(cat);
            if (!categoryCounts[cat]) categoryCounts[cat] = 0;
          }
        });
      }
    });
    
    // Count products for each category
    products.forEach(product => {
      // Count primary category
      if (product.category) {
        categoryCounts[product.category]++;
      }
      
      // Count categories from array (avoiding duplicates)
      if (Array.isArray(product.categories)) {
        const counted = new Set(); // Track counted categories for this product
        if (product.category) counted.add(product.category);
        
        product.categories.forEach(cat => {
          if (cat && !counted.has(cat)) {
            categoryCounts[cat]++;
            counted.add(cat);
          }
        });
      }
    });
    
    // Convert to sorted array
    const categoriesList = [...categoriesSet].sort();
    
    console.log(`Found ${categoriesList.length} categories with counts:`, categoryCounts);
    
    res.json({
      categories: categoriesList,
      categoryCounts: categoryCounts
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ 
      message: 'Error fetching categories', 
      error: err.message 
    });
  }
});

// Create a new category
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    const categoryName = name.trim();
    
    // Check if category already exists
    const existingCategories = await Product.distinct('categories');
    const primaryCategories = await Product.distinct('category');
    const allCategories = [...new Set([...existingCategories.flat(), ...primaryCategories])];
    
    if (allCategories.includes(categoryName)) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    
    // Since we don't have a separate Categories collection,
    // we just return success - the category will be created
    // when first assigned to a product
    res.status(201).json({ 
      message: 'Category created successfully',
      category: categoryName
    });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update a category name
router.put('/:name', adminAuth, async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const { newName } = req.body;
    
    if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
      return res.status(400).json({ message: 'Both old and new category names are required' });
    }
    
    const trimmedOldName = oldName.trim();
    const trimmedNewName = newName.trim();
    
    if (trimmedOldName === trimmedNewName) {
      return res.status(400).json({ message: 'New category name must be different' });
    }
    
    // Check if new category already exists
    const existingCategories = await Product.distinct('categories');
    const primaryCategories = await Product.distinct('category');
    const allCategories = [...new Set([...existingCategories.flat(), ...primaryCategories])];
    
    if (allCategories.includes(trimmedNewName)) {
      return res.status(400).json({ message: 'New category name already exists' });
    }
    
    // Update primary category
    const primaryResult = await Product.updateMany(
      { category: trimmedOldName },
      { $set: { category: trimmedNewName } }
    );
    
    // Update categories array (using aggregation for safety)
    const productsToUpdate = await Product.find({ categories: trimmedOldName });
    
    let updatedArrayCount = 0;
    for (const product of productsToUpdate) {
      const updatedCategories = product.categories.map(c => 
        c === trimmedOldName ? trimmedNewName : c
      );
      
      await Product.updateOne(
        { _id: product._id },
        { $set: { categories: updatedCategories } }
      );
      updatedArrayCount++;
    }
    
    res.json({ 
      message: 'Category updated successfully',
      oldCategory: trimmedOldName,
      newCategory: trimmedNewName,
      updatedPrimary: primaryResult.modifiedCount,
      updatedArray: updatedArrayCount
    });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete a category - MODIFIED to allow deletion if fewer than 2 products
router.delete('/:name', adminAuth, async (req, res) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);
    console.log(`Attempting to delete category: ${categoryName}`);
    
    if (!categoryName) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    // Count products using this category
    const productsWithCategory = await Product.countDocuments({
      $or: [
        { category: categoryName },
        { categories: categoryName }
      ]
    });
    
    console.log(`Category ${categoryName} is used by ${productsWithCategory} products`);
    
    // NEW: Allow deletion if fewer than 2 products
    if (productsWithCategory >= 2) {
      return res.status(400).json({ 
        message: `Cannot delete category "${categoryName}" because it is used by ${productsWithCategory} products`,
        productsCount: productsWithCategory
      });
    }
    
    // If category is used as primary category for a single product, update it
    if (productsWithCategory === 1) {
      const product = await Product.findOne({ 
        $or: [
          { category: categoryName },
          { categories: categoryName }
        ]
      });
      
      if (product) {
        // If this is the primary category, replace it with another category if available
        if (product.category === categoryName) {
          // Find another category from the array to use as primary
          const newPrimaryCategory = product.categories.find(cat => cat !== categoryName);
          
          if (newPrimaryCategory) {
            product.category = newPrimaryCategory;
          } else {
            product.category = 'Uncategorized'; // Fallback
          }
        }
        
        // Remove from categories array
        if (Array.isArray(product.categories)) {
          product.categories = product.categories.filter(cat => cat !== categoryName);
        }
        
        await product.save();
        console.log(`Updated product ${product._id} to remove category ${categoryName}`);
      }
    }
    
    res.json({ 
      message: 'Category deleted successfully',
      category: categoryName
    });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: err.message });
  }
});

// Merge categories
router.post('/merge', adminAuth, async (req, res) => {
  try {
    const { sourceCategory, targetCategory } = req.body;
    
    if (!sourceCategory || !targetCategory) {
      return res.status(400).json({ message: 'Source and target categories are required' });
    }
    
    if (sourceCategory === targetCategory) {
      return res.status(400).json({ message: 'Source and target categories cannot be the same' });
    }
    
    // Check if categories exist
    const existingCategories = await Product.distinct('categories');
    const primaryCategories = await Product.distinct('category');
    const allCategories = [...new Set([...existingCategories.flat(), ...primaryCategories])];
    
    if (!allCategories.includes(sourceCategory)) {
      return res.status(400).json({ message: `Source category "${sourceCategory}" does not exist` });
    }
    
    if (!allCategories.includes(targetCategory)) {
      return res.status(400).json({ message: `Target category "${targetCategory}" does not exist` });
    }
    
    // Update primary category
    const primaryResult = await Product.updateMany(
      { category: sourceCategory },
      { $set: { category: targetCategory } }
    );
    
    // Update categories array
    const productsToUpdate = await Product.find({ categories: sourceCategory });
    
    let updatedArrayCount = 0;
    for (const product of productsToUpdate) {
      // Add target category if not present
      if (!product.categories.includes(targetCategory)) {
        await Product.updateOne(
          { _id: product._id },
          { $addToSet: { categories: targetCategory } }
        );
      }
      
      // Remove source category
      await Product.updateOne(
        { _id: product._id },
        { $pull: { categories: sourceCategory } }
      );
      
      updatedArrayCount++;
    }
    
    res.json({ 
      message: 'Categories merged successfully',
      sourceCategory,
      targetCategory,
      updatedPrimary: primaryResult.modifiedCount,
      updatedArray: updatedArrayCount
    });
  } catch (err) {
    console.error('Error merging categories:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;