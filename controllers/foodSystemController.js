// controllers/restaurantController.js
const { Category, VegFood } = require("../models/foodSystemModel");
const mongoose = require("mongoose");
const cloudinary = require('cloudinary').v2;
const User = require("../models/userModel");
const Restaurant = require("../models/restaurantModel");
const RestaurantProduct = require("../models/restaurantProductModel");

const fs = require("fs");
const notificationModel = require("../models/notificationModel");
const orderModel = require("../models/orderModel");
const WalletTransaction = require("../models/WalletTransaction");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const Amount = require("../models/Amount");
const Ambassador = require("../models/ambassadorModel");
const userModel = require("../models/userModel");
const Commission = require("../models/Commission");


// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.createCategory = async (req, res) => {
  try {
    const { categoryName } = req.body;
    const file = req.files?.image;

    if (!file) {
      return res.status(400).json({ message: "Main category image is required" });
    }

    // Upload main category image directly to Cloudinary
    const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "categories",
    });

    // Handle subcategories
    const formattedSubcategories = [];
    const subcategories = JSON.parse(req.body.subcategories || "[]"); // array of { subcategoryName }

    for (let i = 0; i < subcategories.length; i++) {
      const subImage = req.files?.[`subcategoryImage_${i}`];
      let subImageUrl = null;

      if (subImage) {
        const uploadedSub = await cloudinary.uploader.upload(subImage.tempFilePath, {
          folder: "subcategories",
        });
        subImageUrl = uploadedSub.secure_url;
      }

      formattedSubcategories.push({
        subcategoryName: subcategories[i].subcategoryName,
        subcategoryImageUrl: subImageUrl,
      });
    }

    // Save category to DB
    const category = await Category.create({
      categoryName,
      imageUrl: uploaded.secure_url,
      subcategories: formattedSubcategories,
      status: "pending",
    });

    return res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error("Error creating category:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { categoryName, status } = req.body; // ✅ Status add kiya
    const file = req.files?.image;

    // Find existing category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // 🟢 Update category name if provided
    if (categoryName) {
      category.categoryName = categoryName;
    }

    // 🟢 Update status if provided ✅ Yahan add kiya
    if (status) {
      category.status = status;
    }

    // 🟢 Update main category image if provided
    if (file) {
      const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "categories",
      });
      category.imageUrl = uploaded.secure_url;
    }

    // 🟢 Update subcategories if provided
    if (req.body.subcategories) {
      const subcategories = JSON.parse(req.body.subcategories || "[]");
      const updatedSubcategories = [];

      for (let i = 0; i < subcategories.length; i++) {
        const subImage = req.files?.[`subcategoryImage_${i}`];
        let subImageUrl = subcategories[i].subcategoryImageUrl || null;

        // If new image provided, upload to cloudinary
        if (subImage) {
          const uploadedSub = await cloudinary.uploader.upload(subImage.tempFilePath, {
            folder: "subcategories",
          });
          subImageUrl = uploadedSub.secure_url;
        }

        updatedSubcategories.push({
          subcategoryName: subcategories[i].subcategoryName,
          subcategoryImageUrl: subImageUrl,
        });
      }

      category.subcategories = updatedSubcategories;
    }

    await category.save();

    return res.status(200).json({ success: true, data: category });
  } catch (err) {
    console.error("Error updating category:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Find and delete category in one step
    const category = await Category.findByIdAndDelete(categoryId);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // If you have stored cloudinary public_id, delete image from cloudinary here
    // await cloudinary.uploader.destroy(category.cloudinary_public_id);

    res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createVegFood = async (req, res) => {
  try {
    const { name, rating, type, locationName } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ status: false, message: "Image is required" });
    }

    // Upload image to Cloudinary
    const uploaded = await cloudinary.uploader.upload(file.path, { folder: "vegFoods" });
    fs.unlinkSync(file.path); // Remove local file

    const food = await VegFood.create({
      name,
      rating,
      type,
      locationName,
      image: uploaded.secure_url // ✅ Save image
    });

    res.status(201).json({
      status: true,
      message: "Veg food created successfully",
      data: food
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Server error",
      error: err.message
    });
  }
};

// Get all
exports.getAllVegFoods = async (req, res) => {
  try {
    const foods = await VegFood.find().sort({ createdAt: -1 });
    res.status(200).json({ status: true, data: foods });
  } catch (error) {
    res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};

// Get by ID
exports.getVegFoodById = async (req, res) => {
  try {
    const food = await VegFood.findById(req.params.id);
    if (!food) return res.status(404).json({ status: false, message: "Veg food not found" });

    res.status(200).json({ status: true, data: food });
  } catch (error) {
    res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};

// Update
exports.updateVegFood = async (req, res) => {
  try {
    const { name, rating, type, locationName } = req.body;
    const updateData = { name, rating, type, locationName };

    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, { folder: "vegFoods" });
      fs.unlinkSync(req.file.path);
      updateData.image = uploaded.secure_url;
    }

    const updated = await VegFood.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updated) return res.status(404).json({ status: false, message: "Veg food not found" });

    res.status(200).json({ status: true, message: "Veg food updated successfully", data: updated });
  } catch (error) {
    res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};

// Delete
exports.deleteVegFood = async (req, res) => {
  try {
    const deleted = await VegFood.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ status: false, message: "Veg food not found" });

    res.status(200).json({ status: true, message: "Veg food deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};

// Create Restaurant with Image Upload
// @desc    Create a new restaurant
// @route   POST /api/restaurants
// @access  Private/Admin
// CREATE restaurant
// @desc    Create restaurant

exports.createRestaurant = async (req, res) => {
  try {
    const {
      restaurantName,
      description,
      locationName,
      email,
      mobile,
      gstNumber,
      referralCode,
      password,
      lat,
      lng,
      commission // ADDED COMMISSION FIELD
    } = req.body;

    // BASIC REQUIRED VALIDATIONS ONLY
    if (!restaurantName) return sendError(res, "Restaurant name required");
    if (!locationName) return sendError(res, "Location name required");
    if (!email) return sendError(res, "Email required");
    if (!mobile) return sendError(res, "Mobile required");
    if (!password) return sendError(res, "Password required");
    if (!lat || !lng) return sendError(res, "Location required");
    if (!commission) return sendError(res, "Commission percentage required"); // ADDED COMMISSION VALIDATION
    if (isNaN(commission) || parseFloat(commission) < 0 || parseFloat(commission) > 50) {
      return sendError(res, "Commission must be a valid percentage between 0 and 50");
    }

    // FILES REQUIRED
    if (!req.files?.image) return sendError(res, "Restaurant image required");
    if (!req.files?.fssaiLicense) return sendError(res, "FSSAI license required");
    if (!req.files?.panCard) return sendError(res, "PAN card required");
    if (!req.files?.aadharCard) return sendError(res, "Aadhar card required");

    // SIMPLE CLOUDINARY UPLOAD FUNCTION
    const uploadFile = async (file, folder) => {
      const result = await cloudinary.uploader.upload(file.tempFilePath, { folder });
      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    };

    // Upload all files
    const image = await uploadFile(req.files.image, "restaurants");

    const gstCertificate = req.files.gstCertificate
      ? await uploadFile(req.files.gstCertificate, "restaurants-docs")
      : null;

    const fssaiLicense = await uploadFile(req.files.fssaiLicense, "restaurants-docs");
    const panCard = await uploadFile(req.files.panCard, "restaurants-docs");
    const aadharCard = await uploadFile(req.files.aadharCard, "restaurants-docs");

    // Generate Referral
    const count = await Restaurant.countDocuments();
    const generatedReferralCode = `VEGVEN${count + 1}`;

    // CREATE RESTAURANT
    const restaurant = await Restaurant.create({
      restaurantName,
      description,
      locationName,
      email,
      mobile,
      gstNumber: gstNumber || null,
      commission: parseFloat(commission), // ADDED COMMISSION FIELD
      password,
      referredBy: referralCode || null,
      referralCode: generatedReferralCode,
      location: {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)]
      },
      image,
      gstCertificate,
      fssaiLicense,
      panCard,
      aadharCard,
      status: "pending",
      walletBalance: 0
    });

    res.status(201).json({
      success: true,
      data: restaurant
    });

  } catch (err) {
    console.error("Create Restaurant Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// basic error sender
function sendError(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}




exports.getAllRestaurants = async (req, res) => {
  try {
    // 🔹 Step 1: Aggregate order stats (group by restaurantId)
    const orderStats = await orderModel.aggregate([
      {
        $match: { restaurantId: { $ne: null } }, // Only include orders where restaurantId is not null
      },
      {
        $group: {
          _id: "$restaurantId",  // Group by restaurantId
          totalOrders: { $sum: 1 },  // Count total orders
          totalEarnings: { $sum: "$subTotal" }  // Sum of earnings (subTotal)
        }
      }
    ]);

    // 🔹 Step 2: Aggregate user count (group by referredBy - the restaurant's referralCode)
    const userStats = await userModel.aggregate([
      {
        $match: { referredBy: { $ne: null } },  // Only include users where referredBy is not null
      },
      {
        $group: {
          _id: "$referredBy",  // Group by referredBy field (restaurant's referralCode)
          totalUsers: { $sum: 1 }  // Count total users referred by each restaurant
        }
      }
    ]);

    // 🔹 Step 3: Convert aggregation results to maps for quick lookup
    const statsMap = {};
    orderStats.forEach(stat => {
      if (stat._id) {  // Ensure _id is not null or undefined
        statsMap[stat._id.toString()] = {
          totalOrders: stat.totalOrders,
          totalEarnings: stat.totalEarnings.toFixed(2)
        };
      }
    });

    const userMap = {};
    userStats.forEach(stat => {
      if (stat._id) {  // Ensure _id (referralCode) is not null or undefined
        userMap[stat._id.toString()] = {
          totalUsers: stat.totalUsers
        };
      }
    });

    // 🔹 Step 4: Fetch all restaurants normally (full details)
    const restaurants = await Restaurant.find();

    // 🔹 Step 5: Merge stats and user count into restaurant objects
    const result = restaurants.map(restaurant => {
      // Use null checks to prevent errors
      const orderStats = statsMap[restaurant._id.toString()] || { totalOrders: 0, totalEarnings: 0 };
      const userStats = userMap[restaurant.referralCode] || { totalUsers: 0 };

      return {
        ...restaurant.toObject(),  // Keep all original restaurant fields
        totalOrders: orderStats.totalOrders,
        totalEarnings: orderStats.totalEarnings,
        totalUsers: userStats.totalUsers  // Add the user count
      };
    });

    // 🔹 Step 6: Send the response
    res.status(200).json({
      success: true,
      message: "All restaurants with order statistics and user counts fetched successfully.",
      data: result
    });
  } catch (err) {
    console.error("Error fetching restaurants with order stats and user counts:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


// ✅ Get Restaurant by ID
exports.getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate({
        path: "reviews.userId",
        select: "firstName lastName profileImg"
      });

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    // Calculate totalRatings as average stars
    const totalRatings = restaurant.reviews.length > 0
      ? parseFloat(
          (
            restaurant.reviews.reduce((acc, r) => acc + r.stars, 0) / restaurant.reviews.length
          ).toFixed(2)
        )
      : 0;

    res.status(200).json({
      success: true,
      data: {
        ...restaurant.toObject(),
        totalRatings
      }
    });

  } catch (err) {
    console.error("Get Restaurant Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



// ✅ Update Restaurant
exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      restaurantName,
      description,
      locationName,
      location,
      rating,
      startingPrice,
      status,
      commission, // ADDED COMMISSION FIELD
      email,
      mobile,
      gstNumber
    } = req.body;

    // ✅ Find restaurant
    let restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found"
      });
    }

    // ✅ Validate commission if provided
    if (commission !== undefined) {
      if (commission === "" || commission === null) {
        return res.status(400).json({
          success: false,
          message: "Commission percentage is required"
        });
      }
      if (isNaN(commission) || parseFloat(commission) < 0 || parseFloat(commission) > 50) {
        return res.status(400).json({
          success: false,
          message: "Commission must be a valid percentage between 0 and 50"
        });
      }
    }

    // ✅ Parse location if provided
    let parsedLocation = null;
    if (location) {
      try {
        parsedLocation = JSON.parse(location);
        if (
          typeof parsedLocation.latitude !== "number" ||
          typeof parsedLocation.longitude !== "number"
        ) {
          return res.status(400).json({
            success: false,
            message: "Latitude and Longitude must be valid numbers"
          });
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid location format. Must be JSON with latitude and longitude"
        });
      }
    }

    // ✅ Handle image if provided
    if (req.files && req.files.image) {
      const imageFile = req.files.image;

      // Upload new image
      const result = await cloudinary.uploader.upload(imageFile.tempFilePath, {
        folder: "restaurants",
        width: 1500,
        crop: "scale"
      });

      // Delete old image from Cloudinary if exists
      if (restaurant.image?.public_id) {
        await cloudinary.uploader.destroy(restaurant.image.public_id);
      }

      // Update image data
      restaurant.image = {
        public_id: result.public_id,
        url: result.secure_url
      };

      // Remove temp file
      if (fs.existsSync(imageFile.tempFilePath)) {
        fs.unlinkSync(imageFile.tempFilePath);
      }
    }

    // ✅ Handle document updates if provided
    const documentFields = ['gstCertificate', 'fssaiLicense', 'panCard', 'aadharCard'];
    
    for (const field of documentFields) {
      if (req.files && req.files[field]) {
        const documentFile = req.files[field];

        // Upload new document
        const result = await cloudinary.uploader.upload(documentFile.tempFilePath, {
          folder: "restaurants-docs"
        });

        // Delete old document from Cloudinary if exists
        if (restaurant[field]?.public_id) {
          await cloudinary.uploader.destroy(restaurant[field].public_id);
        }

        // Update document data
        restaurant[field] = {
          public_id: result.public_id,
          url: result.secure_url
        };

        // Remove temp file
        if (fs.existsSync(documentFile.tempFilePath)) {
          fs.unlinkSync(documentFile.tempFilePath);
        }
      }
    }

    // ✅ Update other fields
    if (restaurantName) restaurant.restaurantName = restaurantName;
    if (description) restaurant.description = description;
    if (locationName) restaurant.locationName = locationName;
    if (startingPrice) restaurant.startingPrice = startingPrice;
    if (rating) restaurant.rating = rating;
    if (status) restaurant.status = status;
    if (email) restaurant.email = email;
    if (mobile) restaurant.mobile = mobile;
    if (gstNumber !== undefined) restaurant.gstNumber = gstNumber;
    
    // ADDED COMMISSION UPDATE
    if (commission !== undefined) restaurant.commission = parseFloat(commission);

    if (parsedLocation) {
      restaurant.location = {
        type: "Point",
        coordinates: [parsedLocation.longitude, parsedLocation.latitude]
      };
    }

    await restaurant.save();

    res.status(200).json({
      success: true,
      message: "Restaurant updated successfully ✅",
      data: restaurant
    });

  } catch (err) {
    // Cleanup temp files on error
    if (req.files) {
      Object.values(req.files).forEach(file => {
        if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
          fs.unlinkSync(file.tempFilePath);
        }
      });
    }

    console.error("Update Restaurant Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};



// ✅ Delete Restaurant
exports.deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    if (restaurant.image?.public_id) {
      await cloudinary.uploader.destroy(restaurant.image.public_id);
    }

    res.status(200).json({ success: true, message: "Restaurant deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


// @desc    Get top-rated restaurants near a user's location
// @route   GET /api/restaurants/top-rated-nearby/:userId
// @access  Public
// @query   [limit] Optional, number of restaurants to return (default: 5)

// ✅ Get Top Rated Restaurants Nearby (from already nearby)
exports.getTopRatedNearbyRestaurants = async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxDistance = 5000 } = req.query; // Default 5km

    // 1. Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // 2. Get user with location
    const user = await User.findById(userId);
    if (!user || !user.location || !Array.isArray(user.location.coordinates)) {
      return res.status(404).json({ success: false, message: "User or location not found" });
    }

    const userCoords = user.location.coordinates;

    // 3. First get all nearby restaurants (within distance)
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: userCoords,
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
    }).select("-__v");

    // 4. From those nearby, filter top-rated (rating >= 4) and sort
    const topRated = nearbyRestaurants
      .filter((r) => r.rating >= 4)
      .sort((a, b) => b.rating - a.rating); // Descending order

    res.status(200).json({
      success: true,
      message: "Top-rated nearby restaurants",
      count: topRated.length,
      data: topRated,
    });
  } catch (error) {
    console.error("Error fetching top-rated nearby restaurants:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


//**
// * @desc    Get restaurants near a user's location
//* @route   GET /api/restaurants/nearby/:userId
// * @access  Public
// * @param   {string} userId - User ID to get location from
//* @param   {number} [distance=10] - Maximum distance in kilometers (optional)
//* @returns {Object} List of nearby restaurants with count

// Get nearby restaurants by user ID


// Get Nearby Restaurants
exports.getNearbyRestaurants = async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxDistance = 5000 } = req.query; // Default 5km

    // 1. Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // 2. Find user and check location
    const user = await User.findById(userId);
    if (!user || !user.location || !Array.isArray(user.location.coordinates)) {
      return res.status(404).json({ success: false, message: "User not found or location missing" });
    }

    const userCoords = user.location.coordinates;

    // 3. Find restaurants near the user
    const restaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: userCoords,
          },
          $maxDistance: parseInt(maxDistance), // meters
        },
      },
    }).select("-__v"); // Exclude unnecessary fields

    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error) {
    console.error("Error fetching nearby restaurants:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Helper function to calculate distance between two points (in meters)
function getDistance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}



// ✅ V2: Get Nearby Restaurants by Category (Optimized)
// Helper: calculate distance in km (Haversine formula)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

exports.getNearbyRestaurantsByCategoryV2 = async (req, res) => {
  try {
    const { userId } = req.params;
    const { categoryName, maxDistance = 5000 } = req.query;

    // ---------------- Validation ----------------
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    if (!categoryName || categoryName.trim() === "") {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    // ---------------- Fetch user ----------------
    const user = await User.findById(userId).select("location");
    if (!user || !user.location?.coordinates?.length) {
      return res.status(404).json({ success: false, message: "User or location not found" });
    }
    const [userLon, userLat] = user.location.coordinates;

    // ---------------- Get category ID ----------------
    const category = await Category.findOne({
      categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") }
    });
    if (!category) {
      return res.status(404).json({ success: false, message: `Category '${categoryName}' not found` });
    }
    const categoryId = category._id;

    // ---------------- Query RestaurantProduct ----------------
    let products = await RestaurantProduct.find({
      "recommended.category": categoryId,
      status: "active"
    })
    .populate({
      path: "restaurantId",
      select: "restaurantName locationName location image description rating"
    })
    .lean();

    // ---------------- Group products by restaurant ----------------
    const restaurantMap = new Map();

    products.forEach(product => {
      const restaurant = product.restaurantId;
      if (!restaurant) return;

      const matchingRecommended = product.recommended.filter(item =>
        item.category && item.category.toString() === categoryId.toString()
      );

      if (!matchingRecommended.length) return;

      if (!restaurantMap.has(restaurant._id.toString())) {
        restaurantMap.set(restaurant._id.toString(), {
          ...restaurant,
          recommended: matchingRecommended
        });
      } else {
        // Append recommended items if restaurant already exists
        restaurantMap.get(restaurant._id.toString()).recommended.push(...matchingRecommended);
      }
    });

    // ---------------- Calculate distance & time ----------------
    const nearbyRestaurants = Array.from(restaurantMap.values())
      .map(restaurant => {
        if (!restaurant.location?.coordinates) {
          return { ...restaurant, timeAndKm: { distance: "N/A", time: "N/A" } };
        }

        const [restLon, restLat] = restaurant.location.coordinates;
        const distanceKm = calculateDistanceKm(userLat, userLon, restLat, restLon);
        const timeMins = Math.ceil(distanceKm / 0.5); // assume 30 km/h

        return {
          ...restaurant,
          timeAndKm: {
            distance: `${distanceKm.toFixed(2)} km`,
            time: `${timeMins} mins`
          }
        };
      })
      .filter(r => {
        const distStr = r.timeAndKm.distance;
        if (distStr === "N/A") return false;
        const distNum = parseFloat(distStr);
        return distNum <= maxDistance / 1000; // convert meters → km
      });

    res.status(200).json({
      success: true,
      message: `Nearby restaurants with products in '${categoryName}' category`,
      count: nearbyRestaurants.length,
      data: nearbyRestaurants
    });

  } catch (error) {
    console.error("❌ Error in getNearbyRestaurantsByCategoryV2:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// vendor transaction module


// Add amount to restaurant wallet (Admin)
exports.addToWallet = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { amount, description } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid positive amount'
      });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    const amountValue = parseFloat(amount);

    // Update restaurant wallet balance
    restaurant.walletBalance = (restaurant.walletBalance || 0) + amountValue;
    restaurant.totalEarnings = (restaurant.totalEarnings || 0) + amountValue;

    // Create wallet transaction record
    const walletTransaction = new WalletTransaction({
      restaurantId: restaurant._id,
      amount: amountValue,
      type: 'credit',
      transactionType: 'admin_added',
      description: description || `Amount added by admin`,
      status: 'completed',
      balanceAfter: restaurant.walletBalance
    });

    // Save both restaurant and transaction
    await Promise.all([
      restaurant.save(),
      walletTransaction.save()
    ]);

    res.status(200).json({
      success: true,
      message: `₹${amountValue} successfully added to ${restaurant.restaurantName}'s wallet`,
      data: {
        restaurant: {
          _id: restaurant._id,
          restaurantName: restaurant.restaurantName,
          walletBalance: restaurant.walletBalance,
          totalEarnings: restaurant.totalEarnings
        },
        transaction: {
          _id: walletTransaction._id,
          amount: walletTransaction.amount,
          type: walletTransaction.type,
          description: walletTransaction.description,
          status: walletTransaction.status,
          createdAt: walletTransaction.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error adding to wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Restaurant creates withdrawal request
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { amount, accountDetails } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid positive amount'
      });
    }

    if (!accountDetails || !accountDetails.accountNumber || !accountDetails.bankName || !accountDetails.accountHolderName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete account details'
      });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    const amountValue = parseFloat(amount);

    // Check if sufficient balance exists
    if ((restaurant.walletBalance || 0) < amountValue) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Check minimum withdrawal amount
    if (amountValue < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹100'
      });
    }

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      restaurantId: restaurant._id,
      amount: amountValue,
      accountDetails,
      status: 'pending',
      requestedBy: restaurantId // Restaurant itself is requesting
    });

    await withdrawalRequest.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawalRequest: {
          _id: withdrawalRequest._id,
          amount: withdrawalRequest.amount,
          status: withdrawalRequest.status,
          accountDetails: withdrawalRequest.accountDetails,
          createdAt: withdrawalRequest.createdAt
        },
        restaurant: {
          _id: restaurant._id,
          restaurantName: restaurant.restaurantName,
          walletBalance: restaurant.walletBalance
        }
      }
    });

  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all withdrawal requests (Admin)
exports.getAllWithdrawalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const withdrawalRequests = await Withrawal.find(filter)
      .populate('restaurantId', 'restaurantName email mobile')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const totalCount = await WithdrawalRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: 'Withdrawal requests fetched successfully',
      data: {
        withdrawalRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalRequests: totalCount,
          hasNextPage: page * limit < totalCount,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get withdrawal requests for specific restaurant
exports.getRestaurantWithdrawalRequests = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const withdrawalRequests = await WithdrawalRequest.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const totalCount = await WithdrawalRequest.countDocuments({ restaurantId });

    res.status(200).json({
      success: true,
      message: 'Withdrawal requests fetched successfully',
      data: {
        withdrawalRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalRequests: totalCount,
          hasNextPage: page * limit < totalCount,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching restaurant withdrawal requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Admin processes withdrawal request
exports.processWithdrawalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, adminNotes } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    // Find withdrawal request
    const withdrawalRequest = await WithdrawalRequest.findById(requestId)
      .populate('restaurantId');
    
    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Check if already processed
    if (withdrawalRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Withdrawal request is already ${withdrawalRequest.status}`
      });
    }

    const restaurant = withdrawalRequest.restaurantId;

    if (status === 'approved') {
      // Check if still sufficient balance
      if ((restaurant.walletBalance || 0) < withdrawalRequest.amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance for withdrawal'
        });
      }

      // Update restaurant wallet balance
      restaurant.walletBalance = (restaurant.walletBalance || 0) - withdrawalRequest.amount;

      // Create wallet transaction record
      const walletTransaction = new WalletTransaction({
        restaurantId: restaurant._id,
        amount: withdrawalRequest.amount,
        type: 'debit',
        transactionType: 'withdrawal',
        description: `Withdrawal to ${withdrawalRequest.accountDetails.bankName} - ${withdrawalRequest.accountDetails.accountNumber}`,
        status: 'completed',
        balanceAfter: restaurant.walletBalance,
        withdrawalRequestId: withdrawalRequest._id
      });

      // Update withdrawal request
      withdrawalRequest.status = 'completed';
      withdrawalRequest.processedAt = new Date();
      withdrawalRequest.adminNotes = adminNotes;
      withdrawalRequest.processedBy = req.user?._id; // Assuming admin user ID from auth

      // Save all changes
      await Promise.all([
        restaurant.save(),
        walletTransaction.save(),
        withdrawalRequest.save()
      ]);

    } else if (status === 'rejected') {
      // Update withdrawal request as rejected
      withdrawalRequest.status = 'rejected';
      withdrawalRequest.processedAt = new Date();
      withdrawalRequest.adminNotes = adminNotes;
      withdrawalRequest.processedBy = req.user?._id;

      await withdrawalRequest.save();
    }

    res.status(200).json({
      success: true,
      message: `Withdrawal request ${status} successfully`,
      data: {
        withdrawalRequest: {
          _id: withdrawalRequest._id,
          amount: withdrawalRequest.amount,
          status: withdrawalRequest.status,
          accountDetails: withdrawalRequest.accountDetails,
          adminNotes: withdrawalRequest.adminNotes,
          processedAt: withdrawalRequest.processedAt
        },
        restaurant: {
          _id: restaurant._id,
          restaurantName: restaurant.restaurantName,
          walletBalance: restaurant.walletBalance
        }
      }
    });

  } catch (error) {
    console.error('Error processing withdrawal request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get wallet transactions
exports.getWalletTransactions = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Get transactions with pagination
    const transactions = await WalletTransaction.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count
    const totalCount = await WalletTransaction.countDocuments({ restaurantId });

    res.status(200).json({
      success: true,
      message: 'Wallet transactions fetched successfully',
      data: {
        restaurant: {
          _id: restaurant._id,
          restaurantName: restaurant.restaurantName,
          walletBalance: restaurant.walletBalance,
          totalEarnings: restaurant.totalEarnings
        },
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalTransactions: totalCount,
          hasNextPage: page * limit < totalCount,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get wallet summary
exports.getWalletSummary = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Get transaction statistics
    const totalCredits = await WalletTransaction.aggregate([
      { $match: { restaurantId: restaurant._id, type: 'credit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalDebits = await WalletTransaction.aggregate([
      { $match: { restaurantId: restaurant._id, type: 'debit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pendingWithdrawals = await WithdrawalRequest.aggregate([
      { $match: { restaurantId: restaurant._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const recentTransactions = await WalletTransaction.find({ restaurantId: restaurant._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    res.status(200).json({
      success: true,
      message: 'Wallet summary fetched successfully',
      data: {
        restaurant: {
          _id: restaurant._id,
          restaurantName: restaurant.restaurantName,
          walletBalance: restaurant.walletBalance,
          totalEarnings: restaurant.totalEarnings
        },
        summary: {
          currentBalance: restaurant.walletBalance || 0,
          totalCredits: totalCredits[0]?.total || 0,
          totalDebits: totalDebits[0]?.total || 0,
          pendingWithdrawals: pendingWithdrawals[0]?.total || 0,
          netAmount: (totalCredits[0]?.total || 0) - (totalDebits[0]?.total || 0)
        },
        recentTransactions
      }
    });

  } catch (error) {
    console.error('Error fetching wallet summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



exports.getRestaurantWalletBalance = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // 🔹 Find the restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found."
      });
    }

    // 🔹 Fetch all wallet transactions (latest 10)
    const transactions = await WalletTransaction.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(10);

    // 🔹 Fetch all withdrawal requests for this restaurant
    const withdrawalRequests = await WithdrawalRequest.find({ restaurantId })
      .sort({ createdAt: -1 });

    // 🔹 Send full wallet + withdrawal data
    res.status(200).json({
      success: true,
      message: `Wallet balance and withdrawal requests for ${restaurant.restaurantName} fetched successfully.`,
      data: {
        _id: restaurant._id,
        restaurantName: restaurant.restaurantName,
        email: restaurant.email,
        contactNumber: restaurant.contactNumber,
        walletBalance: restaurant.walletBalance || 0,
        totalEarnings: restaurant.totalEarnings || 0,
        transactions: transactions.map(txn => ({
          _id: txn._id,
          amount: txn.amount,
          type: txn.type,
          transactionType: txn.transactionType,
          description: txn.description,
          status: txn.status,
          createdAt: txn.createdAt,
          balanceAfter: txn.balanceAfter
        })),
        withdrawalRequests: withdrawalRequests.map(req => ({
          _id: req._id,
          amount: req.amount,
          status: req.status,
          createdAt: req.createdAt
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching restaurant wallet balance:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message
    });
  }
};



exports.createWithdrawalRequest = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { amount, accountDetails } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid positive amount."
      });
    }

    if (!accountDetails || typeof accountDetails !== "object") {
      return res.status(400).json({
        success: false,
        message: "Account details are required."
      });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found."
      });
    }

    // Check if restaurant has sufficient balance
    const withdrawAmount = parseFloat(amount);
    if ((restaurant.walletBalance || 0) < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance."
      });
    }

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      restaurantId: restaurant._id,
      amount: withdrawAmount,
      accountDetails,
      status: "pending"  // always pending initially
    });

    await withdrawalRequest.save();

    // Optional: Deduct from wallet balance immediately
    restaurant.walletBalance -= withdrawAmount;
    await restaurant.save();

    res.status(200).json({
      success: true,
      message: `Withdrawal request of ₹${withdrawAmount} created successfully.`,
      data: {
        _id: withdrawalRequest._id,
        restaurantId: restaurant._id,
        amount: withdrawalRequest.amount,
        accountDetails: withdrawalRequest.accountDetails,
        status: withdrawalRequest.status,
        createdAt: withdrawalRequest.createdAt
      }
    });

  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message
    });
  }
};


exports.getAllWithdrawalRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find()
      .populate("restaurantId", "restaurantName email contactNumber walletBalance totalEarnings")
      .sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      success: true,
      message: "Withdrawal requests fetched successfully.",
      data: requests
    });
  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message
    });
  }
};



exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { withdrawalId } = req.params; // changed from requestId
    const { status } = req.body; // "approved" or "rejected"

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'approved' or 'rejected'."
      });
    }

    const withdrawalRequest = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found."
      });
    }

    // Already processed?
    if (withdrawalRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This request has already been processed."
      });
    }

    const restaurant = await Restaurant.findById(withdrawalRequest.restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Associated restaurant not found."
      });
    }

    if (status === "approved") {
      // Wallet was already deducted at request creation
    } else if (status === "rejected") {
      // Refund the amount back to wallet
      restaurant.walletBalance += withdrawalRequest.amount;
      await restaurant.save();
    }

    withdrawalRequest.status = status;
    await withdrawalRequest.save();

    res.status(200).json({
      success: true,
      message: `Withdrawal request has been ${status}.`,
      data: withdrawalRequest
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message
    });
  }
};



exports.getRestaurantProfile = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // 🔹 Find the restaurant by ID (return full document)
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found."
      });
    }

    // 🔹 Send full restaurant document
    res.status(200).json({
      success: true,
      message: `Complete profile of ${restaurant.restaurantName} fetched successfully.`,
      data: restaurant
    });

  } catch (error) {
    console.error("Error fetching restaurant profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message
    });
  }
};



exports.getRestaurantsByCategory = async (req, res) => {
  try {
    // Retrieve categoryId from the request params
    const { categoryId } = req.params;

    // Validate if categoryId exists
    if (!categoryId) {
      return res.status(400).json({ success: false, message: "Category ID is required" });
    }

    // Find the restaurants that match the provided categoryId
    const restaurants = await Restaurant.find({
      categories: categoryId  // This will match all restaurants that have the categoryId in the categories array
    });

    // If no restaurants are found
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: "No restaurants found for the given category" });
    }

    // Respond with the restaurants data
    return res.status(200).json({ success: true, data: restaurants });

  } catch (error) {
    console.error("Error fetching restaurants by category:", error);
    return res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};




exports.uploadRestaurantDocuments = async (req, res) => {
  try {
    const { vendorId } = req.params; // ✅ changed from 'id' to 'vendorId'

    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: "Valid vendorId is required in params"
      });
    }

    // Check if restaurant/vendor exists
    const restaurant = await Restaurant.findById(vendorId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Vendor/Restaurant not found'
      });
    }

    // Check if at least one file is provided
    if (!req.files?.declarationForm && !req.files?.vendorAgreement) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one document to upload'
      });
    }

    // Cloudinary upload function
    const uploadFile = async (file, folder) => {
      const result = await cloudinary.uploader.upload(file.tempFilePath, { 
        folder: `restaurants-docs/${folder}`,
        resource_type: 'auto'
      });
      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    };

    const updateData = {};

    // Upload declaration form
    if (req.files.declarationForm) {
      try {
        updateData.declarationForm = await uploadFile(req.files.declarationForm, "declaration-forms");
        updateData.declarationForm.uploadedAt = new Date();
      } catch (uploadError) {
        console.error("Declaration form upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload declaration form'
        });
      }
    }

    // Upload vendor agreement
    if (req.files.vendorAgreement) {
      try {
        updateData.vendorAgreement = await uploadFile(req.files.vendorAgreement, "vendor-agreements");
        updateData.vendorAgreement.uploadedAt = new Date();
      } catch (uploadError) {
        console.error("Vendor agreement upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload vendor agreement'
        });
      }
    }

    // Update vendor/restaurant document
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      vendorId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: updatedRestaurant
    });

  } catch (err) {
    console.error("Upload Restaurant Documents Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};



// Get All Commissions
exports.getAllCommissions = async (req, res) => {
  try {
    const commissions = await Commission.find()
      .populate("vendorId", "name email")
      .populate("ambassadorId", "name email");
    res.status(200).json({ success: true, data: commissions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
