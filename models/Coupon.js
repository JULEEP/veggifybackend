const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  couponCode: {
    type: String,
  },

  title: {
    type: String,
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

   note: {
    type: String,
    trim: true,
  },

  discountType: {
    type: String,
    enum: ["percentage", "flat", "fixed"],
  },

  discountValue: {
    type: Number,
  },

  minOrderAmount: {
    type: Number,
    default: 0,
  },

  maxDiscountAmount: {
    type: Number,
  },

  startDate: {
    type: Date,
  },

  endDate: {
    type: Date,
  },

  usageLimit: {
    type: Number, // total usage count
  },

  usedCount: {
    type: Number,
    default: 0,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubAdmin",
    default: null,
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubAdmin",
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Coupon", couponSchema);
