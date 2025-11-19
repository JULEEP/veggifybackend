const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
  },
  amount: {
    type: Number,
    min: 0
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
  },
  transactionType: {
    type: String,
    enum: ['order_payment', 'admin_added', 'withdrawal', 'refund', 'other'],
    default: 'other'
  },
  description: {
    type: String,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  withdrawalRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WithdrawalRequest'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  balanceAfter: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Index for better query performance
walletTransactionSchema.index({ restaurantId: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ withdrawalRequestId: 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);