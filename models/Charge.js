const mongoose = require('mongoose');

const chargeSchema = new mongoose.Schema({
  type: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    min: 0 // amount cannot be negative
  },
  chargeType: {
    type: String,
    default: 'fixed'
  }
}, { timestamps: true }); // automatically adds createdAt and updatedAt

const Charge = mongoose.model('Charge', chargeSchema);

module.exports = Charge;
