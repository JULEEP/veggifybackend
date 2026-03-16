const mongoose = require('mongoose');

const helpUsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",   // Optional: if you have a "User" model
  },
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  issueType: {
    type: String,
  },
  description: {
    type: String,
  },
    description: {
    type: String,
  },
  imageUrl: {  // New field to store the URL of the image
    type: String,
  },
   status: {  // New field to store the URL of the image
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

module.exports = mongoose.model('HelpUs', helpUsSchema);
