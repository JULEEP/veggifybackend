const mongoose = require("mongoose");
const { Category } = require("./foodSystemModel");


const RestaurantProductSchema = new mongoose.Schema({
  restaurantName: { type: String },
  locationName: { type: String },
  type: { type: [String] },
  rating: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },

  recommended: [{
    name: { type: String },
    price: { type: Number },
    rating: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    content: { type: String },
    image: { type: String },
    vendorHalfPercentage: { type: Number },
    vendor_Platecost: { type: Number },

    addons: {
      productName: { type: String },
      variation: {             // Single object
        name: { type: String, default: "" },
        type: { type: [String], default: [] } // e.g., ["Half"] or ["Full"]
      },
      plates: {
        _id: false,
        name: { type: String, default: "" }
      }
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category"
    }
  }],

     categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',  // Reference to the Category model
      },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },
  timeAndKm: { time: String, distance: String },
  status: { type: String, enum: ["active", "inactive"], default: "pending" }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model("RestaurantProduct", RestaurantProductSchema);
