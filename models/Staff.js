const mongoose = require('mongoose');

// Define Staff schema
const staffSchema = new mongoose.Schema({
  fullName: {
    type: String,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  role: {
    type: String,
  },
   aadharCardFront: {
    type: String, // Cloudinary URL
    required: [true, 'Aadhar Card Front is required']
  },
  aadharCardBack: {
    type: String // Cloudinary URL (optional)
  },
  gender: {
    type: String,
  },
  age: {
    type: Number,
  },
  aadharCard: {
    type: String, // URL from Cloudinary
  },
  photo: {
    type: String, // URL from Cloudinary
  },
  pagesAccess: [{
    type: String // Array of page paths that staff can access
  }],
  status: {
    type: String,
    default: 'pending', // Default status for staff
  },
    mySalary: [
    {
      amount: Number,
      month: String,
      status: String,
      date: { type: Date, default: Date.now } // Default to current date
    }
  ],
}, { timestamps: true }); // Include createdAt & updatedAt automatically

// Create Staff model
const Staff = mongoose.model('Staff', staffSchema);

module.exports = Staff;
