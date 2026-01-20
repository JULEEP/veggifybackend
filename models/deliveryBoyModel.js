const mongoose = require("mongoose");

// Delivery Boy Schema
const deliveryBoySchema = new mongoose.Schema({
   fullName: { type: String, },
  mobileNumber: { type: String, },
  vehicleType: { type: String, },
  aadharCard: { type: String, }, // Cloudinary URL
  drivingLicense: { type: String, }, // Cloudinary URL
  email: {
    type: String,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
   deleteToken: { type: String, default: null },
  deleteTokenExpiration: { type: Date, default: null },
   currentOrder: {
    type: Boolean,
    default: false // Initially, no delivery boy has an active order
  },
   currentOrderStatus: {
      type: String,
      default: "Pending",
    },
  otp: { type: Number},
  image: { type: String },
   profileImage: { type: String },  // Profile Image (Cloudinary URL)
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],
      default: [0.0, 0.0]
    }
  },
  isActive: { type: Boolean, default: true },
   // 🔹 NEW FIELDS for deletion
  documentStatus: {
    aadharCard: { type: String, default: "pending" }, // Default status is 'pending'
    drivingLicense: { type: String, default: "pending" }, // Default status is 'pending'
  },
  deliveryBoyStatus: {
    type: String,
    enum: ["pending", "active", "inactive"],
    default: "pending", // Default status is 'pending'
  },
  // Add baseDeliveryCharge field here
  baseDeliveryCharge: { type: Number, default: 0 }, // Default delivery charge is 0
  walletBalance: {
    type: Number,
    default: 0,  // Set default to 0 for new delivery boys
  },
  walletTransactions: [{  // Array to store all wallet transactions
    amount: { type: Number, },  // Amount added to the wallet
    dateAdded: { type: Date, default: Date.now },  // Date of the transaction
    type: { type: String, },  // Type of transaction (e.g., 'delivery')
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },  // Reference to the order
  }],
  myAccountDetails: [  // This should be at the root level
    {
      accountNumber: { type: String, },
      bankName: { type: String, },
      accountHolderName: { type: String, },
      ifscCode: { type: String, },
      upiId: { type: String, },  // UPI ID is optional
    }
  ],
}, { timestamps: true });

deliveryBoySchema.index({ location: "2dsphere" }); // For geospatial queries schema m koi problem h  kya?

module.exports = mongoose.model('DeliveryBoy', deliveryBoySchema);
// Delivery Assignment Schema
const deliveryAssignmentSchema = new mongoose.Schema({
 orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant",  },
  deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", },
  pickupDistance: { type: Number, },
  dropDistance: { type: Number, },

  status: { type: String, enum: ["Pending", "Accepted", "Picked", "Delivered"], default: "Pending" },
  acceptedAt: Date,
  cancelledAt: Date,
  deliveredAt: Date,

  orderDetails: { type: Object }, 
  chat: [{ 
    sender: { type: String, enum: ["User", "DeliveryBoy"], },
    message: { type: String, },
    timestamp: { type: Date, default: Date.now }
  }],
    baseDeliveryCharge: { type: Number, default: 0 }, // Default value is 0, can be changed later
  chatActive: { type: Boolean, default: false }      // Will store order info
  }, { timestamps: true });
// Export both models
module.exports = {
  DeliveryBoy: mongoose.model("DeliveryBoy", deliveryBoySchema),
  DeliveryAssignment: mongoose.model("DeliveryAssignment", deliveryAssignmentSchema)
};
