const mongoose = require("mongoose");

// ✅ Category Schema
const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  subcategories: [{
    subcategoryName: {
      type: String,
    },
    subcategoryImageUrl: {
      type: String,
    },
  }],
      // 🔹 NEW FIELDS (like Banner)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubAdmin",
    default: null // null = Admin
  },
  note: {
    type: String
  },
  status: {
    type: String,
  },
}, { timestamps: true });

// ✅ VegFood Schema
const vegFoodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    required: true
  },
  locationName: {
    type: String,
    required: true
  },image: { type: String, required: true }
},
 { timestamps: true });

// ✅ Export both models
const Category = mongoose.model("Category", categorySchema);
const VegFood = mongoose.model("VegFood", vegFoodSchema);

module.exports = { Category, VegFood };
