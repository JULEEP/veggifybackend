const mongoose = require('mongoose');
const { Schema } = mongoose;

const AmbassadorWithdrawalSchema = new Schema({
  ambassadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ambassador',
  },
  amount: {
    type: Number,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  accountDetails: {
    accountNumber: {
      type: String,
    },
    ifscCode: {
      type: String,
    },
    bankName: {
      type: String,
    },
    accountHolderName: {
      type: String,
    },
  },
  upiId: {
    type: String,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  rejectedAt: {
    type: Date,
    default: null,
  },
});

const AmbassadorWithdrawal = mongoose.model('AmbassadorWithdrawal', AmbassadorWithdrawalSchema);

module.exports = AmbassadorWithdrawal;
