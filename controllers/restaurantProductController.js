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
    const restaurantImage = restaurant.image?.url || "";

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
            restaurantImage,  // ✅ Include restaurant image
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
      restaurantImage,   // ✅ Include restaurant image top-level
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
    const { productId, recommendedId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId is required." });
    }

    if (!recommendedId || !mongoose.Types.ObjectId.isValid(recommendedId)) {
      return res.status(400).json({ success: false, message: "Valid recommendedId is required." });
    }

    // Fetch existing product
    const existingProduct = await RestaurantProduct.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: "Restaurant Product not found." });
    }

    // Find the specific recommended item
    const existingItemIndex = existingProduct.recommended.findIndex(
      (item) => item._id.toString() === recommendedId
    );

    if (existingItemIndex === -1) {
      return res.status(404).json({ success: false, message: "Recommended item not found." });
    }

    let itemUpdate = {};
    if (req.body.recommended) {
      itemUpdate = typeof req.body.recommended === "string" ? JSON.parse(req.body.recommended) : req.body.recommended;
    }

    // Handle image upload
    let imageUrl = existingProduct.recommended[existingItemIndex].image;
    if (req.files && req.files.recommendedImage) {
      try {
        imageUrl = await uploadToCloudinary(req.files.recommendedImage, "restaurant-recommended");
      } catch (err) {
        console.error("Cloudinary Upload Error:", err);
      }
    }

    // Update only provided fields
    const updatedItem = {
      ...existingProduct.recommended[existingItemIndex].toObject(),
      ...(itemUpdate.name && { name: itemUpdate.name }),
      ...(itemUpdate.price !== undefined && { price: parseFloat(itemUpdate.price) }),
      ...(itemUpdate.halfPlatePrice !== undefined && { halfPlatePrice: parseFloat(itemUpdate.halfPlatePrice) }),
      ...(itemUpdate.fullPlatePrice !== undefined && { fullPlatePrice: parseFloat(itemUpdate.fullPlatePrice) }),
      ...(itemUpdate.discount !== undefined && { discount: parseFloat(itemUpdate.discount) }),
      ...(itemUpdate.tags && { tags: Array.isArray(itemUpdate.tags) ? itemUpdate.tags : [] }),
      ...(itemUpdate.content && { content: itemUpdate.content }),
      ...(itemUpdate.category && { category: itemUpdate.category }),
      ...(itemUpdate.preparationTime && { preparationTime: itemUpdate.preparationTime }),
      ...(itemUpdate.status !== undefined && { status: itemUpdate.status }),
      ...(imageUrl !== existingProduct.recommended[existingItemIndex].image && { image: imageUrl }),
    };

    // Update the specific item
    existingProduct.recommended[existingItemIndex] = updatedItem;

    // Save product
    const updatedProduct = await existingProduct.save();

    return res.status(200).json({
      success: true,
      message: "Recommended item updated successfully",
      data: updatedProduct,
    });

  } catch (error) {
    console.error("❌ Update Recommended Item Error:", error);
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


exports.getAllRestaurantProductsBySearch = async (req, res) => {
  try {
    const { search } = req.query;
    console.log("Search Query Received:", search);

    // If no search query, return all restaurant products
    if (!search || search.trim() === '') {
      console.log("No search query, returning all restaurant products");
      const allProducts = await RestaurantProduct.find()
        .sort({ createdAt: -1 })
        .populate('categoryId', 'name')
        .populate({
          path: 'restaurantId',
          select: 'restaurantName email phone locationName description rating image walletBalance status mobile commission',
          model: 'Restaurant'
        });
      
      return res.status(200).json({ 
        success: true, 
        data: allProducts,
        total: allProducts.length,
        message: "All restaurant products fetched successfully"
      });
    }
    
    const searchTerm = search.trim().toLowerCase();
    const searchRegex = new RegExp(searchTerm, 'i'); // Case-insensitive regex
    
    console.log("Searching for:", searchTerm);
    
    // Pehle restaurant khud search karo (Restaurant model se)
    const Restaurant = mongoose.model('Restaurant');
    const restaurants = await Restaurant.find({
      $or: [
        { restaurantName: searchRegex },
        { locationName: searchRegex },
        { description: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex }
      ]
    }).select('restaurantName email phone locationName description rating image walletBalance status mobile commission');
    
    console.log("Found restaurants:", restaurants.length);
    
    // Ab restaurant products search karo
    const searchQuery = {
      $or: [
        // Restaurant details (string fields)
        { restaurantName: searchRegex },
        { locationName: searchRegex },
        
        // Recommended items string fields
        { 'recommended.name': searchRegex },
        { 'recommended.tags': searchRegex },
        { 'recommended.content': searchRegex },
        { 'recommended.preparationTime': searchRegex },
        { 'recommended.status': searchRegex },
        
        // Menu items string fields
        { 'menu.name': searchRegex },
        { 'menu.status': searchRegex },
        
        // Reviews (string field)
        { 'recommended.reviews.comment': searchRegex },
        
        // Time and distance (string fields)
        { 'timeAndKm.time': searchRegex },
        { 'timeAndKm.distance': searchRegex },
        
        // Status (string field)
        { status: searchRegex }
      ]
    };
    
    // Restaurant products find karo with restaurant details
    const restaurantProducts = await RestaurantProduct.find(searchQuery)
      .sort({ createdAt: -1 })
      .populate('categoryId', 'name')
      .populate({
        path: 'restaurantId',
        select: 'restaurantName email phone locationName description rating image walletBalance status mobile commission',
        model: 'Restaurant'
      });
    
    console.log("Found restaurant products:", restaurantProducts.length);
    
    // Combined results banayenge
    let results = [];
    
    // 1. Pehle restaurant details add karo (agar koi restaurant mila)
    if (restaurants.length > 0) {
      restaurants.forEach(restaurant => {
        results.push({
          type: 'restaurant',
          data: restaurant.toObject(),
          restaurantDetails: restaurant.toObject(),
          relevanceScore: 10, // Highest score for direct restaurant match
          searchMatch: true
        });
      });
    }
    
    // 2. Phir restaurant products add karo
    if (restaurantProducts.length > 0) {
      restaurantProducts.forEach(product => {
        // Check if this product's restaurant already added
        const restaurantExists = results.some(r => 
          r.type === 'restaurant' && 
          r.data._id.toString() === product.restaurantId?._id?.toString()
        );
        
        // Calculate relevance score for product
        const productData = product.toObject();
        let relevanceScore = 0;
        
        // Check exact matches in important fields
        if (productData.restaurantName?.toLowerCase().includes(searchTerm)) {
          relevanceScore += 5;
        }
        if (productData.locationName?.toLowerCase().includes(searchTerm)) {
          relevanceScore += 4;
        }
        
        // Check in recommended items
        if (productData.recommended && Array.isArray(productData.recommended)) {
          productData.recommended.forEach(item => {
            if (item.name?.toLowerCase().includes(searchTerm)) relevanceScore += 3;
            if (item.content?.toLowerCase().includes(searchTerm)) relevanceScore += 2;
            if (item.tags && Array.isArray(item.tags)) {
              if (item.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
                relevanceScore += 3;
              }
            }
          });
        }
        
        // Check in menu items
        if (productData.menu && Array.isArray(productData.menu)) {
          productData.menu.forEach(item => {
            if (item.name?.toLowerCase().includes(searchTerm)) relevanceScore += 2;
          });
        }
        
        // Add restaurant details to product if not already in results
        let restaurantDetails = null;
        if (product.restaurantId) {
          restaurantDetails = product.restaurantId.toObject ? product.restaurantId.toObject() : product.restaurantId;
        }
        
        results.push({
          type: 'product',
          data: productData,
          restaurantDetails: restaurantDetails,
          relevanceScore: relevanceScore,
          searchMatch: relevanceScore > 0
        });
      });
    }
    
    // Sort by relevance score (highest first)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Filter out items with no match (relevanceScore === 0)
    const filteredResults = results.filter(item => item.relevanceScore > 0);
    
    console.log("Total filtered results:", filteredResults.length);
    
    if (filteredResults.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
        searchQuery: searchTerm,
        message: `No restaurants or products found matching "${searchTerm}"`
      });
    }
    
    // Group results by restaurant for better organization
    const groupedResults = {};
    filteredResults.forEach(item => {
      if (item.type === 'restaurant') {
        const restaurantId = item.data._id.toString();
        if (!groupedResults[restaurantId]) {
          groupedResults[restaurantId] = {
            restaurant: item.data,
            products: []
          };
        }
      }
    });
    
    // Add products to their respective restaurants
    filteredResults.forEach(item => {
      if (item.type === 'product' && item.restaurantDetails) {
        const restaurantId = item.restaurantDetails._id?.toString();
        if (restaurantId && groupedResults[restaurantId]) {
          groupedResults[restaurantId].products.push(item.data);
        } else if (restaurantId) {
          // Agar restaurant group nahi bana hai, toh banao
          groupedResults[restaurantId] = {
            restaurant: item.restaurantDetails,
            products: [item.data]
          };
        }
      }
    });
    
    // Convert grouped results to array
    const finalResults = Object.values(groupedResults);
    
    res.status(200).json({ 
      success: true, 
      data: finalResults,
      total: finalResults.length,
      searchQuery: searchTerm,
      searchPerformed: true,
      message: `Found ${finalResults.length} restaurants/products matching "${searchTerm}"`,
      breakdown: {
        restaurants: results.filter(r => r.type === 'restaurant').length,
        products: results.filter(r => r.type === 'product').length,
        groupedResults: finalResults.length
      }
    });
    
  } catch (error) {
    console.error("Search Restaurant Products Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server Error",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};