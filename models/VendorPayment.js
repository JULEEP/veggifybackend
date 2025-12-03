const mongoose = require('mongoose');

const vendorPaymentSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorPlan',
  },
  transactionId: {
    type: String,
  },
  isPurchased: {
    type: Boolean,
    default: false
  },
  planPurchaseDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
  },
  amount: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  razorpayPaymentId: {
    type: String
  }
}, {
  timestamps: true
});

// Index for better query performance
vendorPaymentSchema.index({ vendorId: 1, planId: 1 });
vendorPaymentSchema.index({ transactionId: 1 });

module.exports = mongoose.model('VendorPayment', vendorPaymentSchema);