const mongoose = require('mongoose');

const ambassadorSchema = new mongoose.Schema({
  fullName: { type: String, },
  email: { type: String, },
  mobileNumber: { type: String, },
  dateOfBirth: { type: String },
  gender: { type: String },
  city: { type: String, },
  area: { type: String, },
  pincode: { type: String },
  instagram: { type: String },
  facebook: { type: String },
  twitter: { type: String },
  whyVeggyfy: { type: String, },
  marketingIdeas: { type: String },
  targetAudience: { type: String },
  expectedCommission: { type: String },
  referralCode: { type: String },
  referredBy: { type: String },
  status: { type: String, default: "pending" },
  profileImage: { type: String }, 
   users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
   wallet: { type: Number, default: 0 }, 
  wallet: { 
      type: Number, 
      default: 0 
    },
    transactionHistory: [
      {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        totalPayable: { type: Number, },
        commission: { type: Number, },
        date: { type: Date, default: Date.now },
      },
    ],
      aadharCard: {
    type: String,
  },
  panCard: {
    type: String,
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'under_review'],
    default: 'pending'
  },
  kycSubmittedAt: {
    type: Date,
    default: Date.now
  },
  kycVerifiedAt: {
    type: Date,
    default: null
  },
  kycRejectionReason: {
    type: String,
    default: ""
  },
}, { timestamps: true });

const Ambassador = mongoose.model('Ambassador', ambassadorSchema);

module.exports = Ambassador;
