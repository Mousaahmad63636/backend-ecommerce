// backend/models/Timer.js
const mongoose = require('mongoose');

const timerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Timer = mongoose.model('Timer', timerSchema);
module.exports = Timer;