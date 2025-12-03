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
      price: { type: Number, default: 0 }, // backend sets automatically
      image: { type: String, default: "" },
        discountPercent: { type: Number, default: 0 },   // <-- add this
      discountAmount: { type: Number, default: 0 }    // <-- add this
    },
  ],

  subTotal: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 20 },
  gstAmount: { type: Number, default: 0 },
  couponDiscount: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 },
  appliedCouponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
  appliedCoupon: { // snapshot of coupon
    code: String,
    discountPercentage: Number,
    maxDiscountAmount: Number,
    minCartAmount: Number,
    expiresAt: Date
  },
    totalDiscount: { type: Number, default: 0 },       // <-- add this
     platformCharge: { type: Number, default: 10 },     // <-- add this
     discount: { type: Number, default: 0 },           // <-- cart-level discount
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Cart", cartSchema);
