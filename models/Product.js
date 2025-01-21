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
  category: {
    type: String,
    required: true,
    trim: true
  },
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