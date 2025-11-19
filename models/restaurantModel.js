const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const restaurantSchema = new mongoose.Schema(
  {
    restaurantName: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    rating: {
      type: Number,
      min: [0, 'Rating must be at least 0'],
      max: [5, 'Rating cannot exceed 5'],
      default: 0
    },
   categories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category' // Reference to the Category model
      }
    ],
    startingPrice: {
      type: Number,
    },
    locationName: {
      type: String,
      trim: true,
    },
      status: {
      type: String,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      }
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address'
      ]
    },
     walletBalance: {
    type: Number,
    default: 0
  },
    // ✅ New field: referral code generated automatically
    referralCode: {
      type: String,
      unique: true, // ensures no duplicate referral codes
      trim: true,
    },

    // ✅ New field: optional referral (if someone referred them)
    referredBy: {
      type: String,
      default: null,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
      match: [
        /^[0-9]{10}$/,
        'Mobile number must be exactly 10 digits'
      ]
    },
    image: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      }
    }
  },
  { timestamps: true }
);

// Add 2dsphere index for location-based queries
restaurantSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Restaurant', restaurantSchema);
