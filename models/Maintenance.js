// models/Maintenance.js
const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: false, // default is not under maintenance
    },
    message: {
      type: String,
      default: "OK", // default message
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Maintenance", maintenanceSchema);
