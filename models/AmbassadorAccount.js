// models/ambassadorAccount.js
const mongoose = require("mongoose");

const ambassadorAccountSchema = new mongoose.Schema(
  {
    ambassadorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambassador",
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
      enum: ["savings", "current", "salary"],
      default: "savings"
    },
    phoneNumber: {
      type: String,
    },
    email: {
      type: String,
    },
    isPrimary: {
      type: Boolean,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active"
    }
  },
  { timestamps: true }
);

// Ensure only one primary account per ambassador
ambassadorAccountSchema.pre('save', async function(next) {
  if (this.isPrimary) {
    try {
      await this.constructor.updateMany(
        { ambassadorId: this.ambassadorId, _id: { $ne: this._id } },
        { $set: { isPrimary: false } }
      );
    } catch (error) {
      next(error);
    }
  }
  next();
});

module.exports = mongoose.model("AmbassadorAccount", ambassadorAccountSchema);