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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Credential', credentialSchema);
