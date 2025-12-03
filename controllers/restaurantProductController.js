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

// 📤 Cloudinary Upload Helper
const uploadToCloudinary = async (file, folder) => {
  try {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: folder || "restaurant-images",
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};

exports.createRestaurantProduct = async (req, res) => {
  try {
    const { restaurantId } = req.body;

    // ✅ Check restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found" });

    // --- Parse recommended items ---
    let recommended = [];
    if (typeof req.body.recommended === "string") {
      recommended = JSON.parse(req.body.recommended);
    } else if (Array.isArray(req.body.recommended)) {
      recommended = req.body.recommended;
    }

    // --- Handle recommended images upload ---
    let recommendedFiles = [];
    if (req.files && req.files.recommendedImages) {
      recommendedFiles = Array.isArray(req.files.recommendedImages)
        ? req.files.recommendedImages
        : [req.files.recommendedImages];
    }

    // ✅ Map recommended items with preparationTime
   const formattedRecommended = await Promise.all(
  recommended.map(async (item, i) => {
    let imageUrl = "";
    if (recommendedFiles[i]) {
      try {
        imageUrl = await uploadToCloudinary(
          recommendedFiles[i],
          "restaurant-recommended"
        );
      } catch (err) {
        console.error("Cloudinary Upload Error:", err);
        imageUrl = "";
      }
    }

    const price = parseFloat(item.price) || 0;

    return {
      name: item.name,
      price: price,
      halfPlatePrice: parseFloat(item.halfPlatePrice) || 0,
      fullPlatePrice: price, // ✅ fullPlatePrice now equals price
      discount: parseFloat(item.discount) || 0,
      tags: Array.isArray(item.tags) ? item.tags : [],
      content: item.content || "",
      image: imageUrl,
      category: item.category || null,
      preparationTime: item.preparationTime || "",
      status: "inactive",
    };
  })
);

    // --- Create Restaurant Product ---
    const newProduct = new RestaurantProduct({
      restaurantName: restaurant.restaurantName,
      locationName: restaurant.locationName,
      recommended: formattedRecommended,
      restaurantId,
      status: "inactive",
      timeAndKm: { time: "0 mins", distance: "0 km" },
    });

    const savedProduct = await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Restaurant product created successfully",
      data: savedProduct,
    });

  } catch (error) {
    console.error("Create Restaurant Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
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
exports.getByrestaurantProductId = async (req, res) => {
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
    const { categoryName, name } = req.query;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ success: false, message: "Valid restaurantId is required" });
    }

    // Get restaurant data
    const restaurant = await Restaurant.findById(restaurantId).lean();
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const restaurantStatus = restaurant.status || "unknown";

    // Calculate totalRatings and totalReviews
    let totalRatings = 0;
    let totalReviews = 0;
    if (Array.isArray(restaurant.reviews) && restaurant.reviews.length > 0) {
      totalReviews = restaurant.reviews.length;
      const ratingSum = restaurant.reviews.reduce((sum, r) => sum + (r.stars || 0), 0);
      totalRatings = parseFloat((ratingSum / totalReviews).toFixed(2));

      const userIds = restaurant.reviews.map(r => r.userId);
      const users = await User.find({ _id: { $in: userIds } })
        .select("firstName lastName profileImg")
        .lean();

      restaurant.reviews = restaurant.reviews.map(r => {
        const user = users.find(u => u._id.toString() === r.userId.toString());
        return {
          _id: r._id,
          stars: r.stars,
          comment: r.comment,
          createdAt: r.createdAt,
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          profileImg: user?.profileImg || null
        };
      });
    }

    // Get recommended products
    const products = await RestaurantProduct.find({ restaurantId })
      .populate("recommended.category");

    if (!products.length) {
      return res.status(404).json({ success: false, message: "No recommended products found" });
    }

    let recommendedList = [];

    products.forEach(product => {
      if (Array.isArray(product.recommended) && product.recommended.length > 0) {
        product.recommended.forEach(item => {
          const imageUrl = item.image || product.image || "";

          recommendedList.push({
            productId: product._id,
            restaurantName: product.restaurantName,
            locationName: product.locationName,
            type: product.type,
            rating: product.rating,
            viewCount: product.viewCount,
            recommendedItem: {
              _id: item._id,
              name: item.name || "",
              price: parseFloat(item.price) || 0,
              halfPlatePrice: parseFloat(item.halfPlatePrice) || 0,
              fullPlatePrice: parseFloat(item.fullPlatePrice) || 0,
              discount: parseFloat(item.discount) || 0,
              tags: Array.isArray(item.tags) ? item.tags : [],
              content: item.content || "",
              image: imageUrl,
              category: item.category || null,
              status: item.status,
              preparationTime: item.preparationTime || "",
              reviews: Array.isArray(item.reviews) ? item.reviews.map(r => ({
                _id: r._id,
                stars: r.stars,
                comment: r.comment,
                createdAt: r.createdAt,
                firstName: r.user?.firstName || null,
                lastName: r.user?.lastName || null,
                profileImg: r.user?.profileImg || null
              })) : []
            }
          });
        });
      }
    });

    // Apply filters
    if (categoryName) {
      const regex = new RegExp(categoryName.trim(), "i");
      recommendedList = recommendedList.filter(item =>
        item.recommendedItem.category?.categoryName &&
        regex.test(item.recommendedItem.category.categoryName)
      );
    }

    if (name) {
      const regex = new RegExp(name.trim(), "i");
      recommendedList = recommendedList.filter(item =>
        item.recommendedItem.name && regex.test(item.recommendedItem.name)
      );
    }

    if (!recommendedList.length) {
      return res.status(404).json({
        success: false,
        message: "No recommended items found for given filters"
      });
    }

    return res.status(200).json({
      success: true,
      totalRecommendedItems: recommendedList.length,
      restaurantStatus,  // <-- TOP LEVEL after totalRecommendedItems
      recommendedProducts: recommendedList,
      restaurantReviews: restaurant.reviews || [],
      totalRatings,
      totalReviews
    });

  } catch (error) {
    console.error("Get Recommended Products Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};



exports.updateRestaurantProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId is required." });
    }

    // Fetch existing product
    const existingProduct = await RestaurantProduct.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: "Restaurant Product not found." });
    }

    // Start with existing product data
    let updateData = { ...existingProduct.toObject() };

    // Update only the fields that are provided in request
    if (req.body.type) {
      updateData.type = JSON.parse(req.body.type);
    }

    if (req.body.status) {
      updateData.status = req.body.status;
    }

    if (req.body.viewCount) {
      updateData.viewCount = parseInt(req.body.viewCount);
    }

    // Handle recommended updates - only update provided fields
    if (req.body.recommended) {
      let recommendedUpdates = [];
      if (typeof req.body.recommended === "string") {
        recommendedUpdates = JSON.parse(req.body.recommended);
      } else if (Array.isArray(req.body.recommended)) {
        recommendedUpdates = req.body.recommended;
      }

      // Image upload handling
      let recommendedFiles = [];
      if (req.files && req.files.recommendedImages) {
        recommendedFiles = Array.isArray(req.files.recommendedImages)
          ? req.files.recommendedImages
          : [req.files.recommendedImages];
      }

      // Update only the fields that are provided in recommended
      updateData.recommended = await Promise.all(
        existingProduct.recommended.map(async (existingItem, index) => {
          const itemUpdate = recommendedUpdates[index] || {};
          let imageUrl = existingItem.image;

          // Handle image upload if new image provided
          if (recommendedFiles[index]) {
            try {
              imageUrl = await uploadToCloudinary(
                recommendedFiles[index],
                "restaurant-recommended"
              );
            } catch (err) {
              console.error("Cloudinary Upload Error:", err);
            }
          }

          return {
            ...existingItem.toObject(),

            ...(itemUpdate.name && { name: itemUpdate.name }),
            ...(itemUpdate.price && { price: parseFloat(itemUpdate.price) }),
            ...(itemUpdate.halfPlatePrice && { halfPlatePrice: parseFloat(itemUpdate.halfPlatePrice) }),
            ...(itemUpdate.fullPlatePrice && { fullPlatePrice: parseFloat(itemUpdate.fullPlatePrice) }),
            ...(itemUpdate.discount && { discount: parseFloat(itemUpdate.discount) }),
            ...(itemUpdate.tags && { tags: Array.isArray(itemUpdate.tags) ? itemUpdate.tags : [] }),
            ...(itemUpdate.content && { content: itemUpdate.content }),
            ...(itemUpdate.category && { category: itemUpdate.category }),
            ...(itemUpdate.preparationTime && { preparationTime: itemUpdate.preparationTime }),

            // ⭐ FIXED HERE — update regardless of active/inactive
            ...(itemUpdate.status !== undefined && { status: itemUpdate.status }),

            ...(imageUrl !== existingItem.image && { image: imageUrl }),
          };

        })
      );
    }

    // Update product
    const updatedProduct = await RestaurantProduct.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Restaurant Product updated successfully",
      data: updatedProduct,
    });

  } catch (error) {
    console.error("❌ Update Restaurant Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
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