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
}, { timestamps: true });

module.exports = mongoose.model('AmbassadorPayment', AmbassadorPaymentSchema);
