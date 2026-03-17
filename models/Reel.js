const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant", // Reference to Restaurant model
    },
    videoUrl: {
      type: String,
    },
    thumbUrl: {
      type: String,
    },
    title: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default: ""
    },
    deepLink: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["active", "pending", "inactive"],
      default: "pending"
    },
    isHot: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Reel", reelSchema);