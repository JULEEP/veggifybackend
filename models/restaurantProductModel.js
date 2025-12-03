const mongoose = require("mongoose");

const RestaurantProductSchema = new mongoose.Schema(
  {
    restaurantName: { type: String },
    locationName: { type: String },

    // Recommended items
  recommended: [
  {
    name: { type: String },
    price: { type: Number, default: 0 },
    halfPlatePrice: { type: Number, default: 0 },
    fullPlatePrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    content: { type: String, default: "" },
    image: { type: String, default: "" },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // ⭐ Added Here (New Field)
    preparationTime: { type: String, default: "" },

    reviews: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        stars: { type: Number, min: 1, max: 5 },
        comment: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive"
    },
  },
],


    // Menu items
    menu: [
      {
        name: { type: String},
        price: { type: Number, default: 0 },
        halfPlatePrice: { type: Number, default: 0 },
        fullPlatePrice: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        status: { type: String, enum: ["active", "inactive"], default: "inactive" },
      },
    ],

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },

    timeAndKm: {
      time: { type: String, default: "0 mins" },
      distance: { type: String, default: "0 km" },
    },

    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("RestaurantProduct", RestaurantProductSchema);
