const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  image: {
    type: String,
  },
  status: {
    type: String,
    default: 'pending',  // Default status is 'pending'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubAdmin',  // Agar null → created by Admin
    default: null,
  },
  note: {
    type: String, // e.g. "Created by Sub-admin: John Doe" or "Created by Admin"
  }
}, { timestamps: true });

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;
