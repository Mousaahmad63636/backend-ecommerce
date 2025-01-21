const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  whatsappMessageTemplate: {
    english: {
      type: String,
      default: `🛍️ *New Order*\n──────────────\n\nHello {{customerName}}! 👋\n\nYour order has been received ✅\nOrder #{{orderId}}`
    },
    arabic: {
      type: String,
      default: `🛍️ *طلب جديد*\n──────────────\n\nمرحباً {{customerName}}! 👋\n\nتم استلام طلبك بنجاح ✅\nرقم الطلب: #{{orderId}}`
    }
  },
  // Add hero section settings
  heroSection: {
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    },
    mediaUrl: {
      type: String,
      default: '/hero.jpg'
    },
    title: {
      type: String,
      default: 'Welcome to our Store'
    },
    subtitle: {
      type: String,
      default: 'Discover amazing products at great prices'
    }
  }
}, {
  timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;