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
  image:{type:String},


address: [{
  addressLine: { type: String, required: true },
  city: { type: String },
  state: { type: String },
  pinCode: { type: String },
  country: { type: String },
  phone: { type: String },
  houseNumber: { type: String },
  apartment: { type: String },
  directions: { type: String },
  street: { type: String },
  latitud: { type: Number },
  longitud: { type: Number },
  postalCode: { type: String },  // New field
  addressType: { type: String },  // New field
  fullAddress: { type: String }   // New field
}],

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

