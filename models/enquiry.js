const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please enter a valid email address"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
          note: { type: String },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubAdmin",
          default: null,
        },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

module.exports = mongoose.model("Enquiry", enquirySchema);
