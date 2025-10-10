const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
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
      },

      // User's chosen addon (no price)
      addOn: {
        variation: { type: String }, // e.g. "Full" or "Half"
        plateitems: { type: Number, default: 0 }, // e.g. 2 plates
      },

      name: { type: String },
      basePrice: { type: Number, default: 0 }, // backend sets this automatically
      platePrice: { type: Number, default: 0 },
      image: { type: String },
    },
  ],

  subTotal: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 20 },
  couponDiscount: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 },
  appliedCouponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null }, // <-- store coupon
  appliedCoupon: { // new: store details snapshot
        code: String,
        discountPercentage: Number,
        maxDiscountAmount: Number,
        minCartAmount: Number,
        expiresAt: Date
    },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Cart", cartSchema);
