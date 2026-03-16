const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema({
  type: {
    type: String,
  },
  email: {
    type: String,
  },
  mobile: {
    type: String,
  },
   whatsappNumber: {
    type: String,
  },
        note: { type: String },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubAdmin",
        default: null,
      },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Credential', credentialSchema);
