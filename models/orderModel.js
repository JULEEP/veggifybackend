const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },
    restaurantLocation: {
      type: String, // populated from Restaurant.locationName
    },
    deliveryAddress: {
      type: mongoose.Schema.Types.Mixed, // whole address object (flexible schema)
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending"
    },


      totalAmount: {
    type: Number,
  },

  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending"
  },

  orderStatus: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected", "Picked", "Delivered", "Cancelled"],
    default: "Pending"
  },

  // ✅ Location of the restaurant (for pickup)
  restaurantLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },

  // ✅ Location of the user (optional redundancy)
  deliveryLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },

  // ✅ Assigned DeliveryBoy (if any)
  deliveryBoyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryBoy",
    default: null
  },

  // ✅ Track delivery status (Optional)
  deliveryStatus: {
    type: String,
    enum: ["Pending", "Assigned", "Picked", "Delivered", "Failed"],
    default: "Pending"
  },

  // ✅ Optional timestamps
  acceptedAt: Date,
  pickedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
    totalItems: {
      type: Number,
      default: 0
    },
    subTotal: {
      type: Number,
      default: 0
    },
    deliveryCharge: {
      type: Number,
      default: 20
    },
      couponDiscount: { type: Number, default: 0 },
    totalPayable: {
      type: Number,
      default: 0
    }, 
    distanceKm: { type: Number, default: 0 },
   
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Order", orderSchema);
