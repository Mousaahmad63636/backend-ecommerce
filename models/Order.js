// backend/models/Order.js
const mongoose = require('mongoose');
const Counter = require('./Counter');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: Number,
    unique: true
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    selectedColor: {
      type: String,
      default: ''
    },
    selectedSize: {
      type: String,
      default: ''
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  promoDiscount: {
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: function() { return this.promoDiscount?.value != null; }
    },
    value: {
      type: Number,
      required: function() { return this.promoDiscount?.type != null; }
    }
  },
  shippingFee: {
    type: Number,
    required: true,
    min: 0,
    default: 5
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  specialInstructions: {
    type: String,
    trim: true,
    default: ''
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

orderSchema.pre('save', async function(next) {
  if (!this.orderId) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        'orderId',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.orderId = counter.seq;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;