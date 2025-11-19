const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },
    amount: {
      type: Number,
      min: 1,
    },
    accountDetails: {
      bankName: { type: String,},
      accountNumber: { type: String, },
      ifsc: { type: String, },
      accountHolder: { type: String, },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    remarks: { type: String }, // optional, admin can add notes
  },
  { timestamps: true }
);

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
