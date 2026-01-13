// models/WebsiteEnquiry.js
const mongoose = require("mongoose");

const websiteEnquirySchema = new mongoose.Schema(
  {
    name: { type: String,},
    phoneNumber: { type: String, },
    email: { type: String, },
    partnerType: { type: String, },
    status: { 
      type: String, 
      enum: ['pending', 'contacted', 'in progress', 'rejected'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

const WebsiteEnquiry = mongoose.model("WebsiteEnquiry", websiteEnquirySchema);

module.exports = WebsiteEnquiry;