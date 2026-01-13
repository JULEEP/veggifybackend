const mongoose = require('mongoose');

const AmbassadorPaymentSchema = new mongoose.Schema({
  ambassadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ambassador',
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AmbassadorPlan',
  },
  transactionId: {
    type: String,
  },
  planPurchaseDate: {
    type: Date,
    default: Date.now,
  },
  expiryDate: {
    type: Date,
  },
  isPurchased: {
    type: Boolean,
    default: false,
  },
  
  // ✅ Added discount related fields:
  baseAmount: {
    type: Number, // plan price before tax
    default: 0
  },
  discount: {
    type: Number, // discount percentage
    default: 0
  },
  discountAmount: {
    type: Number, // discount amount in rupees
    default: 0
  },
  discountedPrice: {
    type: Number, // price after discount
    default: 0
  },
  gstAmount: {
    type: Number, // calculated GST
    default: 0
  },
  totalAmount: {
    type: Number, // discountedPrice + gst
    default: 0
  },
  razorpayPaymentId: {
    type: String,
  },
  paymentStatus: {
    type: String,
  },
   status: {
    type: String,
  },
  paymentMethod: {
    type: String,
  },
  bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      bankName: { type: String },
      ifscCode: { type: String },
      referenceNumber: { type: String },
    },
  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model('AmbassadorPayment', AmbassadorPaymentSchema);