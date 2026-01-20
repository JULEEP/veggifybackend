const mongoose = require("mongoose");

const subAdminSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  phoneNumber: {
    type: String,
  },
  password: {
    type: String,
  },
  role: {
    type: String,
    default: "subadmin"
  },
  access: {
    type: [String],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",   // main admin
  }
}, { timestamps: true });

module.exports = mongoose.model("SubAdmin", subAdminSchema);
