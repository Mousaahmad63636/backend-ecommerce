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
    min: 0,
    max: 100
  },
  colors: {
    type: [String],
    default: []
  },
  sizes: {
    type: [String],
    default: []
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
  hidden: {
    type: Boolean,
    default: false
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  soldOut: {
    type: Boolean,
    default: false
  },
  // Add new rating fields
  rating: {
    type: Number,
    default: 4,
    min: 1,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Pre-save middleware to check discount expiration
productSchema.pre('save', function(next) {
  if (this.discountEndDate && new Date() > this.discountEndDate) {
    this.discountPercentage = 0;
    this.discountType = 'percentage'; // Reset to default type
    if (this.originalPrice) {
      this.price = this.originalPrice;
      this.originalPrice = null; // Clear original price after restoring
    }
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

// Method to calculate current price with proper handling of fixed and percentage discounts
productSchema.methods.getCurrentPrice = function() {
  if (this.hasActiveDiscount) {
    if (this.discountType === 'fixed') {
      // For fixed discount, subtract the amount from original price
      return Math.max(0, (this.originalPrice || this.price) - this.discountPercentage);
    } else {
      // For percentage discount, apply percentage reduction
      return this.price;
    }
  }
  return this.originalPrice || this.price;
};

// Helper method to calculate the discount amount (useful for displaying to users)
productSchema.methods.getDiscountAmount = function() {
  if (!this.hasActiveDiscount) return 0;
  
  if (this.discountType === 'fixed') {
    return this.discountPercentage; // Return the fixed amount directly
  } else {
    // For percentage, calculate the actual amount saved
    return (this.originalPrice || this.price) * (this.discountPercentage / 100);
  }
};

const Product = mongoose.model('Product', productSchema);
module.exports = Product;