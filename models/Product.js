// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discountEndDate: {
    type: Date
  },
  isBlackFridayDeal: {
    type: Boolean,
    default: false
  },
  images: [{
    type: String,
    required: true
  }],
  // Keep the original category field for backward compatibility
  category: {
    type: String,
    required: true,
    trim: true
  },
  // Add new categories array field
  categories: [{
    type: String,
    trim: true
  }],
  salesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  soldOut: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save middleware to check discount expiration
productSchema.pre('save', function(next) {
  if (this.discountEndDate && new Date() > this.discountEndDate) {
    this.discountPercentage = 0;
    this.price = this.originalPrice;
    this.discountEndDate = null;
    this.isBlackFridayDeal = false;
  }
  
  // Ensure the main category is also in the categories array
  if (this.category && (!this.categories || !this.categories.includes(this.category))) {
    if (!this.categories) {
      this.categories = [];
    }
    if (!this.categories.includes(this.category)) {
      this.categories.push(this.category);
    }
  }
  
  // If categories exist but no main category, use the first one
  if (this.categories && this.categories.length > 0 && !this.category) {
    this.category = this.categories[0];
  }
  
  next();
});

// Virtual field for if the discount is active
productSchema.virtual('hasActiveDiscount').get(function() {
  return this.discountPercentage > 0 && 
         this.discountEndDate && 
         new Date() < this.discountEndDate;
});

// Method to calculate current price
productSchema.methods.getCurrentPrice = function() {
  if (this.hasActiveDiscount) {
    return this.price;
  }
  return this.originalPrice || this.price;
};

const Product = mongoose.model('Product', productSchema);
module.exports = Product;