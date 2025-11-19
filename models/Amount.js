const mongoose = require('mongoose');

const amountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
    },
    amount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

amountSchema.index({ type: 1 });

module.exports = mongoose.model('Amount', amountSchema);
