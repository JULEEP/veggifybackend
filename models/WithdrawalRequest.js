const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },
    amount: {
      type: Number,
    },
    processingFee: {
      type: Number,
    },
    netAmount: {
      type: Number,
      required: true
    },
    accountDetails: {
      bankName: { type: String, },
      accountNumber: { type: String, },
      ifsc: { type: String, },
      accountHolder: { type: String, },
      accountType: { type: String },
      branchName: { type: String }
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "processing", "completed"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    approvedAt: {
      type: Date
    },
    remarks: { 
      type: String,
      default: ''
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction"
    },
    paymentReference: {
      type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);