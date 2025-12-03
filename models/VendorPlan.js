const mongoose = require('mongoose');

const vendorPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    min: 0
  },
  validity: {
    type: Number,
    min: 1
  },
  benefits: [{
    type: String,
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('VendorPlan', vendorPlanSchema);