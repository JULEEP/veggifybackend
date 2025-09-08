const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    restaurantName: {
      type: String,
      required: [true, 'Restaurant name is required'],
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
    startingPrice: {
      type: Number,
      required: [true, 'Starting price is required']
    },
    locationName: {
      type: String,
      trim: true,
      required: [true, 'Location name is required']
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
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
        required: true
      },
      url: {
        type: String,
        required: true
      }
    }
  },
  { timestamps: true }
);

// Add 2dsphere index for location-based queries
restaurantSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Restaurant', restaurantSchema);
