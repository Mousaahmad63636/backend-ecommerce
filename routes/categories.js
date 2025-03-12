// backend/routes/categories.js
const router = require('express').Router();
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');

// Get all categories
router.get('/', async (req, res) => {
  try {
    // Get all products with their category data
    const products = await Product.find({}, { category: 1, categories: 1 });
    
    // Create a Set to eliminate duplicates
    const categoriesSet = new Set();
    
    products.forEach(product => {
      // Add primary category if it exists
      if (product.category && typeof product.category === 'string') {
        categoriesSet.add(product.category.trim());
      }
      
      // Add categories from array if they exist
      if (Array.isArray(product.categories)) {
        product.categories.forEach(cat => {
          if (cat && typeof cat === 'string') {
            categoriesSet.add(cat.trim());
          }
        });
      }
    });
    
    // Convert to array and sort
    const categories = [...categoriesSet].sort();
    
    // Count products per category
    const categoryCounts = {};
    categories.forEach(category => {
      categoryCounts[category] = products.filter(product => {
        return product.category === category || 
               (Array.isArray(product.categories) && product.categories.includes(category));
      }).length;
    });
    
    res.json({
      categories,
      categoryCounts
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// Create a new category
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Valid category name is required' });
    }
    
    const categoryName = name.trim();
    
    // Check for existing categories
    const products = await Product.find({}, { category: 1, categories: 1 });
    const existingCategories = new Set();
    
    products.forEach(product => {
      if (product.category) existingCategories.add(product.category.trim());
      if (Array.isArray(product.categories)) {
        product.categories.forEach(cat => {
          if (cat) existingCategories.add(cat.trim());
        });
      }
    });
    
    if (existingCategories.has(categoryName)) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    
    // Create the category by adding it to a placeholder product
    // This ensures the category exists in the system
    let placeholderProduct = await Product.findOne({ name: 'Category Placeholder' });
    
    if (!placeholderProduct) {
      // Create a placeholder product if it doesn't exist
      placeholderProduct = new Product({
        name: 'Category Placeholder',
        description: 'This product exists only to store categories',
        price: 0,
        category: 'System',
        categories: [categoryName],
        images: ['/placeholder.jpg'],
        stock: 0,
        soldOut: true,
        hidden: true  // Add this flag to hide it from frontend
      });
      await placeholderProduct.save();
    } else {
      // Add the new category to the placeholder product
      if (!placeholderProduct.categories.includes(categoryName)) {
        placeholderProduct.categories.push(categoryName);
        await placeholderProduct.save();
      }
    }
    
    res.status(201).json({ message: 'Category created successfully', category: categoryName });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// Update a category
router.put('/:oldName', adminAuth, async (req, res) => {
  try {
    const { oldName } = req.params;
    const { newName } = req.body;
    
    if (!oldName || !newName || typeof newName !== 'string' || !newName.trim()) {
      return res.status(400).json({ message: 'Both old and new category names are required' });
    }
    
    const decodedOldName = decodeURIComponent(oldName);
    const trimmedNewName = newName.trim();
    
    if (decodedOldName === trimmedNewName) {
      return res.status(400).json({ message: 'New name must be different from old name' });
    }
    
    // Check if new name already exists
    const products = await Product.find({}, { category: 1, categories: 1 });
    const existingCategories = new Set();
    
    products.forEach(product => {
      if (product.category) existingCategories.add(product.category.trim());
      if (Array.isArray(product.categories)) {
        product.categories.forEach(cat => {
          if (cat) existingCategories.add(cat.trim());
        });
      }
    });
    
    if (existingCategories.has(trimmedNewName)) {
      return res.status(400).json({ message: 'New category name already exists' });
    }
    
    // Update main category field in products
    const primaryResult = await Product.updateMany(
      { category: decodedOldName },
      { $set: { category: trimmedNewName } }
    );
    
    // Update category in categories array
    const productsToUpdate = await Product.find({ categories: decodedOldName });
    let updatedArrayCount = 0;
    
    for (const product of productsToUpdate) {
      const updatedCategories = product.categories.map(cat => 
        cat === decodedOldName ? trimmedNewName : cat
      );
      
      await Product.updateOne(
        { _id: product._id },
        { $set: { categories: updatedCategories } }
      );
      updatedArrayCount++;
    }
    
    res.json({
      message: 'Category updated successfully',
      oldName: decodedOldName,
      newName: trimmedNewName,
      primaryUpdates: primaryResult.modifiedCount,
      arrayUpdates: updatedArrayCount
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
});

// Delete a category
router.delete('/:name', adminAuth, async (req, res) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);
    
    // Check if category is in use
    const productsCount = await Product.countDocuments({
      $or: [
        { category: decodedName },
        { categories: decodedName }
      ]
    });
    
    if (productsCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete category that is in use',
        productsCount
      });
    }
    
    // Remove from placeholder product if it exists
    const placeholderProduct = await Product.findOne({ name: 'Category Placeholder' });
    if (placeholderProduct && placeholderProduct.categories.includes(decodedName)) {
      placeholderProduct.categories = placeholderProduct.categories.filter(cat => cat !== decodedName);
      await placeholderProduct.save();
    }
    
    res.json({ message: 'Category deleted successfully', category: decodedName });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category', error: error.message });
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
    
    // Update primary category
    const primaryResult = await Product.updateMany(
      { category: sourceCategory },
      { $set: { category: targetCategory } }
    );
    
    // Update categories array
    let arrayUpdates = 0;
    const productsWithSource = await Product.find({ categories: sourceCategory });
    
    for (const product of productsWithSource) {
      // Add target if not present
      if (!product.categories.includes(targetCategory)) {
        product.categories.push(targetCategory);
      }
      
      // Remove source
      product.categories = product.categories.filter(cat => cat !== sourceCategory);
      
      await product.save();
      arrayUpdates++;
    }
    
    res.json({
      message: 'Categories merged successfully',
      sourceCategory,
      targetCategory,
      primaryUpdates: primaryResult.modifiedCount,
      arrayUpdates
    });
  } catch (error) {
    console.error('Error merging categories:', error);
    res.status(500).json({ message: 'Error merging categories', error: error.message });
  }
});

module.exports = router;