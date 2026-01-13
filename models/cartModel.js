const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
  },
  products: [
    {
      restaurantProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RestaurantProduct",
      },
      recommendedId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      quantity: {
        type: Number,
        min: 1,
        default: 1
      },

      // Plate selection flags
      isHalfPlate: { type: Boolean, default: false },
      isFullPlate: { type: Boolean, default: false },

      name: { type: String, required: true },
      price: { type: Number, default: 0 },
      originalPrice: { type: Number, default: 0 }, // Add this for original price
      image: { type: String, default: "" },
      discountPercent: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 }
    },
  ],

  amountSavedOnOrder: {
    type: Number,
    default: 0
  },

  subTotal: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  packingCharges: { type: Number, default: 0 }, // Add packing charges
  gstCharges: { type: Number, default: 0 }, // GST on food items (5%)
  gstOnDelivery: { type: Number, default: 0 }, // GST on delivery charges (18%)
  platformCharge: { type: Number, default: 0 }, // Platform charge (10%)
  couponDiscount: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 },
  
  // For distance based delivery
  distance: { type: Number, default: 0 }, // Distance in km
  perKmRate: { type: Number, default: 0 }, // Per km rate for delivery
  
  appliedCouponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
  appliedCoupon: { // snapshot of coupon
    code: String,
    discountPercentage: Number,
    maxDiscountAmount: Number,
    minCartAmount: Number,
    expiresAt: Date
  },
  totalDiscount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 }, // cart-level discount
  
  // Free delivery threshold
  freeDeliveryThreshold: { type: Number, default: 199 },
  isDeliveryFree: { type: Boolean, default: false },
  
  // Charge calculations breakdown
  chargeCalculations: {
    deliveryCharge: {
      baseAmount: { type: Number, default: 0 },
      distanceCharge: { type: Number, default: 0 },
      freeDeliveryApplied: { type: Boolean, default: false }
    },
    gstOnFood: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    packingCharges: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    platformCharge: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    gstOnDelivery: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Cart", cartSchema);