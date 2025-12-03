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
  password: {
    type: String,
    minlength: 6, // Only validated if password exists
    // DO NOT add required: true
  },
  isOtpVerified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
