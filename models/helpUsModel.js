const mongoose = require('mongoose');

const helpUsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",   // optional: agar aapka User model hai to
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  issueType: {
    type: String,
    enum: ['Payment', 'Delivery', 'Product', 'Refund', 'Other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('HelpUs', helpUsSchema);
