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
  // 🔐 LOGIN OTP (if used)
  otp: {
    code: String,
    expiresAt: Date,
  },

  // 🔁 FORGOT PASSWORD OTP (❗ REQUIRED)
  resetOTP: {
    type: String,
  },
  resetOTPExpires: {
    type: Date,
  },
        password: {
    type: String,
  },
     otp: {
      code: {
        type: String,
      },
      expiresAt: {
        type: Date,
      },
    },
  whyVeggyfy: { type: String, },
  marketingIdeas: { type: String },
  targetAudience: { type: String },
  expectedCommission: { type: String },
  referralCode: { type: String },
  referredBy: { type: String },
  status: { type: String, default: "pending" },
  profileImage: { type: String }, 
   users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
   commissionPercentage: { type: Number }, // NEW: Commission field in percentage
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
   aadharCardFront: {
    type: String, // Cloudinary URL
  },
  aadharCardBack: {
    type: String // Cloudinary URL (optional)
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

  purchasedPlans: [{
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AmbassadorPlan',
    },
    planName: String,
    planValidity: Number,
    purchaseDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date,
    },
    transactionId: {
      type: String,
    },
    razorpayPaymentId: String,
    baseAmount: {
      type: Number,
    },
    gstAmount: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    
    isPurchased: {
      type: Boolean,
      default: true
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'pending_verification'],
      default: 'completed'
    },
    planBenefits: [String],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
}, { timestamps: true });

const Ambassador = mongoose.model('Ambassador', ambassadorSchema);

module.exports = Ambassador;
