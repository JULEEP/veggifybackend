const RestaurantProduct = require("../models/restaurantProductModel");
const User = require("../models/userModel");
const Restaurant = require("../models/restaurantModel");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const mongoose = require("mongoose");
const streamifier = require("streamifier");

// Cloudinary helper
function uploadBufferToCloudinary(buffer, folder = "") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

// Haversine distance calculator
const calculateDistance = (coord1, coord2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  const time = (distance / 30) * 60;
  return { distance: `${distance.toFixed(2)} km`, time: `${Math.ceil(time)} mins` };
};

exports.createRestaurantProduct = async (req, res) => {
    try {
    const { restaurantId, userId, type, status, viewCount } = req.body;

    // Validate restaurant & user
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    const user = await User.findById(userId);
    if (!user || !user.location?.coordinates)
      return res.status(404).json({ success: false, message: "User or user location not found" });

    const { distance, time } = calculateDistance(user.location.coordinates, restaurant.location.coordinates);

    // Parse type
    let parsedType = [];
    if (typeof type === "string") {
      try { parsedType = JSON.parse(type); }
      catch { parsedType = type.split(",").map(s => s.trim()); }
    } else if (Array.isArray(type)) parsedType = type;

    // Parse recommended
    let recommended = [];
    if (typeof req.body.recommended === "string") recommended = JSON.parse(req.body.recommended);
    else if (Array.isArray(req.body.recommended)) recommended = req.body.recommended;

    const recommendedFiles = req.files?.recommendedImages || [];

    const formattedRecommended = [];
    for (let i = 0; i < recommended.length; i++) {
      const item = recommended[i];
      let imageUrl = "";
      if (recommendedFiles[i]) {
        const upload = await uploadBufferToCloudinary(recommendedFiles[i].buffer, "restaurant-recommended");
        imageUrl = upload.secure_url;
      }

      // Parse addons safely
      let parsedAddons = { productName: item.name, variation: { name: "", type: [] }, plates: { name: "" } };
      if (item.addons) {
        parsedAddons = typeof item.addons === "string" ? JSON.parse(item.addons) : item.addons;
        let variationInput = parsedAddons.variation || {};
        if (Array.isArray(variationInput)) variationInput = variationInput[0] || {};
        parsedAddons.variation = {
          name: variationInput.name || "",
          type: Array.isArray(variationInput.type)
            ? variationInput.type
            : (variationInput.type ? [variationInput.type] : [])
        };
        parsedAddons.plates = parsedAddons.plates ? { name: parsedAddons.plates.name || "" } : { name: "" };
        parsedAddons.productName = item.name;
      }

      const vendorPlateCost = item.vendor_Platecost || 0;
      const vendorHalfPercentage = item.vendorHalfPercentage || 0;
      const calculatedPrice = {
        full: vendorPlateCost,
        half: Math.round(vendorPlateCost * (vendorHalfPercentage / 100))
      };

      formattedRecommended.push({
  name: item.name,
  price: item.price,
  rating: item.rating || 0,
  viewCount: item.viewCount || 0,
  content: item.content || "",
  image: imageUrl,
  addons: parsedAddons,
  category: item.category || null,
  vendorHalfPercentage: vendorHalfPercentage,
  vendor_Platecost: vendorPlateCost,  // <-- use vendorPlateCost here
  calculatedPrice: calculatedPrice
});
    }

    // Save product
    const newProduct = new RestaurantProduct({
      restaurantName: restaurant.restaurantName,
      locationName: restaurant.locationName,
      type: parsedType,
      rating: restaurant.rating || 0,
      viewCount: viewCount || 0,
      recommended: formattedRecommended,
      user: userId,
      restaurantId, // pass as string
      timeAndKm: { distance, time },
      status: status || "active"
    });

    const saved = await newProduct.save();
    res.status(201).json({ success: true, message: "Restaurant Product created successfully", data: saved });

  } catch (error) {
    console.error("Create Restaurant Product Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
// Get all restaurant products
exports.getAllRestaurantProducts = async (req, res) => {
  try {
    const products = await RestaurantProduct.find();
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error("Get All Products Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
// Get product by product ID
exports.getByrestaurantProductId= async (req, res) => {
  try {
    const { Id } = req.params;  // Ensure your route uses /:productId

    // Validate ID
    if (!Id || !mongoose.Types.ObjectId.isValid(Id)) {
      return res.status(400).json({ success: false, message: "Valid productId is required." });
    }

    // Fetch product and populate category if needed
    const product = await RestaurantProduct.findById(Id)
      .populate("recommended.category")  // populate category inside recommended
      .populate("user", "firstName lastName email") // optional user fields
      .populate("restaurantId", "restaurantName locationName rating"); // optional restaurant fields

    if (!product) {
      return res.status(404).json({ success: false, message: "Restaurant Product not found." });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error("Get Restaurant Product By ID Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
exports.getCartByUserId = async (req, res) => {
  try {
    const { userId } = req.params; // make sure your route is using /:userId

    // Validate ID
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Valid userId is required." });
    }

    // Fetch products
    const products = await RestaurantProduct.find({ user: userId })
      .populate("recommended.category")  // populate category inside recommended
      .populate("user", "firstName lastName email") // optional fields
      .populate("restaurantId", "restaurantName locationName rating"); // optional fields

    if (!products || products.length === 0) {
      return res.status(404).json({ success: false, message: "No products found for this user." });
    }

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error("Get Restaurant Products By User ID Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
// Get restaurant products by category ID
exports.getRestaurantProductsByCategoryId = async (req, res) => {
    try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId))
      return res.status(400).json({ success: false, message: "Invalid category ID" });

    const products = await RestaurantProduct.find({ "recommended.category": categoryId });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error("Get Products by Category ID Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

exports.getRecommendedByRestaurantId = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurantId
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ success: false, message: "Valid restaurantId is required" });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    // Fetch all RestaurantProduct documents for this restaurant
    console.log("Restaurant ID: ", restaurantId);  // Debug log
    const products = await RestaurantProduct.find({ restaurantId: restaurantId })
      .populate("recommended.category");

    console.log("Fetched Products: ", products);  // Debug log

    if (!products.length) {
      return res.status(404).json({ success: false, message: "No recommended products found for this restaurant" });
    }

    // Flatten all recommended items
    const recommendedList = [];
    products.forEach(product => {
      console.log("Recommended Items for Product: ", product.recommended);  // Debug log
      if (product.recommended && product.recommended.length > 0) {
        product.recommended.forEach(item => {
          recommendedList.push({
            productId: product._id,
            restaurantName: product.restaurantName,
            locationName: product.locationName,
            type: product.type,
            status: product.status,
            rating: product.rating,
            viewCount: product.viewCount,
              recommendedItem: {
              _id: item._id,  // Adding the item ID
              name: item.name,
              price: item.price,
              rating: item.rating,
              viewCount: item.viewCount,
              content: item.content,
              image: item.image,
              addons: item.addons,
              category: item.category,  // This will send the populated category object
              vendorHalfPercentage: item.vendorHalfPercentage,
              vendor_Platecost: item.vendor_Platecost,
              calculatedPrice: item.calculatedPrice
            }
          });
        });
      }
    });

    if (recommendedList.length === 0) {
      return res.status(404).json({ success: false, message: "No recommended products found for this restaurant" });
    }

    return res.status(200).json({
      success: true,
      totalRecommendedItems: recommendedList.length,
      recommendedProducts: recommendedList
    });

  } catch (error) {
    console.error("Get Recommended Products Error:", error);
    return res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

exports.updateRestaurantProduct  = async (req, res) => {
   try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId is required." });
    }

    const updated = await RestaurantProduct.findByIdAndUpdate(
      productId,
      { $set: req.body },  // You may sanitize input to avoid overwriting unintended fields
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Restaurant Product not found." });
    }

    res.status(200).json({ success: true, message: "Restaurant Product updated successfully", data: updated });
  } catch (error) {
    console.error("Update Restaurant Product Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// Delete restaurant product by ID
exports.deleteRestaurantProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId is required." });
    }

    const deleted = await RestaurantProduct.findByIdAndDelete(productId);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Restaurant Product not found." });
    }

    res.status(200).json({ success: true, message: "Restaurant Product deleted successfully" });
  } catch (error) {
    console.error("Delete Restaurant Product Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

exports.deleteRecommendedByProductId = async (req, res) => {
  try {
    const { productId, recommendedId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId is required." });
    }
    if (!recommendedId || !mongoose.Types.ObjectId.isValid(recommendedId)) {
      return res.status(400).json({ success: false, message: "Valid recommendedId is required." });
    }

    const updated = await RestaurantProduct.findByIdAndUpdate(
      productId,
      { $pull: { recommended: { _id: recommendedId } } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Product or recommended item not found." });
    }

    res.status(200).json({
      success: true,
      message: "Recommended item deleted successfully",
      data: updated
    });
  } catch (error) {
    console.error("Delete Recommended Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};