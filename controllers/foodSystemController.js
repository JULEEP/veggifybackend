// controllers/restaurantController.js
const { Category, VegFood } = require("../models/foodSystemModel");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const Restaurant = require("../models/restaurantModel");
const cloudinary = require("../config/cloudinary");
const RestaurantProduct = require("../models/restaurantProductModel");

const fs = require("fs");


// CATEGORY SECTION
exports.createCategory = async (req, res) => {
  try {
    const { categoryName } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "Image is required" });

    const uploaded = await cloudinary.uploader.upload(file.path, {
      folder: "categories"
    });
    fs.unlinkSync(file.path);

    const category = await Category.create({ categoryName, imageUrl: uploaded.secure_url });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.updateCategory = async (req, res) => {
  try {
    const { categoryName } = req.body;
    const file = req.file; // optional file for update
    const categoryId = req.params.id;

    // Find existing category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Update categoryName if provided
    if (categoryName) category.categoryName = categoryName;

    if (file) {
      // Upload new image to Cloudinary
      const uploaded = await cloudinary.uploader.upload(file.path, {
        folder: "categories",
      });

      // Delete the uploaded file locally
      fs.unlinkSync(file.path);

      // Optionally: delete old image from cloudinary here if you saved the public_id (not covered in create)
      // Update imageUrl
      category.imageUrl = uploaded.secure_url;
    }

    await category.save();

    res.status(200).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
      location,
      rating,
      startingPrice,
      email,
      mobile
    } = req.body;

    // ✅ Basic validation
    if (
      !restaurantName ||
      !location ||
      !locationName ||
      !startingPrice ||
      !req.file ||
      !email ||
      !mobile
    ) {
      return res.status(400).json({
        success: false,
        message: "restaurantName, locationName, location, startingPrice, email, mobile, and image are required"
      });
    }

    // ✅ Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // ✅ Mobile number format check (simple 10-digit)
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number (must be 10 digits)"
      });
    }

    // ✅ Parse and validate location string
    let parsedLocation;
    try {
      parsedLocation = JSON.parse(location); // Expected { latitude, longitude }
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

    // ✅ Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "restaurants",
      width: 1500,
      crop: "scale"
    });

    // ✅ Create restaurant with GeoJSON & added fields
    const restaurant = await Restaurant.create({
      restaurantName,
      description,
      locationName,
      rating,
      startingPrice,
      email,
      mobile,
      location: {
        type: "Point",
        coordinates: [parsedLocation.longitude, parsedLocation.latitude]
      },
      image: {
        public_id: result.public_id,
        url: result.secure_url
      }
    });

    // ✅ Remove local image
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(201).json({
      success: true,
      data: restaurant
    });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


// @desc    Get all restaurants
// @route   GET /api/restaurants
// @access  Public
// ✅ Get All Restaurants
exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.status(200).json({ success: true, data: restaurants });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ Get Restaurant by ID
exports.getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    res.status(200).json({ success: true, data: restaurant });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ Update Restaurant
exports.updateRestaurant = async (req, res) => {
  try {
    const { restaurantName, description, locationName, location, rating, startingPrice } = req.body;

    let restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    // Parse and validate location
    let parsedLocation;
    if (location) {
      try {
        parsedLocation = JSON.parse(location);
        if (!parsedLocation.latitude || !parsedLocation.longitude) {
          return res.status(400).json({ success: false, message: "Latitude and Longitude are required" });
        }
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid location format" });
      }
    }

    // Upload new image if provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "restaurants",
        width: 1500,
        crop: "scale"
      });

      if (restaurant.image?.public_id) {
        await cloudinary.uploader.destroy(restaurant.image.public_id);
      }

      restaurant.image = {
        public_id: result.public_id,
        url: result.secure_url
      };

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }

    // Update fields
    if (restaurantName) restaurant.restaurantName = restaurantName;
    if (description) restaurant.description = description;
    if (locationName) restaurant.locationName = locationName;
    if (startingPrice) restaurant.startingPrice = startingPrice;
    if (rating) restaurant.rating = rating;
    if (parsedLocation) {
      restaurant.location = {
        type: "Point",
        coordinates: [parsedLocation.longitude, parsedLocation.latitude]
      };
    }

    await restaurant.save();

    res.status(200).json({ success: true, data: restaurant });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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
exports.getNearbyRestaurantsByCategoryV2 = async (req, res) => {
  try {
    const { userId } = req.params;
    const { categoryName, maxDistance = 5000 } = req.query;

    // 🔹 Validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    if (!categoryName || categoryName.trim() === "") {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    // 🔹 Fetch user and location
    const user = await User.findById(userId);
    if (!user || !user.location?.coordinates?.length) {
      return res.status(404).json({ success: false, message: "User or location not found" });
    }

    const userCoords = user.location.coordinates;

    // 🔹 Query: Geo + CategoryName (corrected)
    const restaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: userCoords,
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
      categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") }, // case-insensitive exact match
    }).select("-__v");

    res.status(200).json({
      success: true,
      message: `Nearby restaurants in '${categoryName}' category`,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error) {
    console.error("Error in getNearbyRestaurantsByCategoryV2:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
