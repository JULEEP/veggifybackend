const mongoose = require('mongoose');
const { Schema } = mongoose;

const AmbassadorWithdrawalSchema = new Schema({
  ambassadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ambassador',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 100
  },
  processingFee: {
    type: Number,
    required: true,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'processing', 'completed'],
    default: 'pending',
  },
  accountDetails: {
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    },
    accountHolderName: {
      type: String,
      required: true
    },
    branchName: {
      type: String
    },
    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary']
    }
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
  paymentReference: {
    type: String
  },
  remarks: {
    type: String
  }
});

const AmbassadorWithdrawal = mongoose.model('AmbassadorWithdrawal', AmbassadorWithdrawalSchema);

module.exports = AmbassadorWithdrawal;