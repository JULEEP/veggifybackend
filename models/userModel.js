const { latitudeKeys, longitudeKeys } = require('geolib');
const mongoose = require('mongoose');
const { DOUBLE } = require('sequelize');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  otp: { type: String },
  isVerified: { type: Boolean, default: false },
  password: { type: String },
  profileImg: { type: String, default: "" },  // renamed field
  referralCode: {type: String},
  referredBy: { type: String, default: null },  // Add this field


addresses: [
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    addressType: { type: String, default: 'Home' },
    location: {
      type: {
        type: String, 
        enum: ['Point'], 
        default: 'Point' 
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0.0, 0.0]
      }
    }
  }
],



  notifications: [
  {
    type: { type: String },
    title: String,
    message: String,
    timestamp: Date,
    status: { type: String, default: "unread" }
  }
],

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  myWishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }

}, { timestamps: true });

// ✅ Named Exports

// Create 2dsphere index for geospatial queries
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);

