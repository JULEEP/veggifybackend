const mongoose = require('mongoose');

const vendorAccountSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
  },
  accountHolderName: {
    type: String,
  },
  accountNumber: {
    type: String,
  },
  bankName: {
    type: String,
  },
  ifscCode: {
    type: String,
  },
  branchName: {
    type: String,
  },
  accountType: {
    type: String,
    enum: ['savings', 'current', 'salary'],
    default: 'savings'
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'blocked'],
    default: 'active'
  },
  verified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('VendorAccount', vendorAccountSchema);