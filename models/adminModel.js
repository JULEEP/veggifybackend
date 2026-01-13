const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  otp: { type: String },
  otpExpiry: { type: Date },
  password: {
    type: String,
    minlength: 6,
  },
 walletBalance: {
    type: Number,
    default: 0,
  },
  // Forgot Password OTP fields
  resetOTP: {
    type: String
  },
  resetOTPExpires: {
    type: Date
  },
    otp: {
    type: String
  },
  otpExpires: {
    type: Date
  },
  // CHANGE HERE: String array rakh lo
  walletTransactions: [{
    type: String // Simply String array rakh do
  }],
  isOtpVerified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);