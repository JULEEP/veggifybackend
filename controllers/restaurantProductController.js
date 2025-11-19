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
    console.log("📦 Request Body:", req.body);
    console.log("🖼️ Raw Request:", req);
    
    const { restaurantId, userId, type, status, viewCount } = req.body;

    // ✅ Check restaurant existence
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    // 🧩 Parse Recommended Array
    let recommended = [];
    if (typeof req.body.recommended === "string") {
      try {
        recommended = JSON.parse(req.body.recommended);
      } catch (err) {
        console.error("Invalid JSON in recommended field:", err);
        return res.status(400).json({ success: false, message: "Invalid recommended data" });
      }
    } else if (Array.isArray(req.body.recommended)) {
      recommended = req.body.recommended;
    }

    console.log("🔢 Recommended items:", recommended.length);
    console.log("📝 Recommended data:", recommended);

    // Handle file uploads - Cloudinary direct
    let recommendedFiles = [];
    
    // Check if files are coming in the request
    if (req.files && req.files.recommendedImages) {
      recommendedFiles = Array.isArray(req.files.recommendedImages) 
        ? req.files.recommendedImages 
        : [req.files.recommendedImages];
    }

    console.log("🖼️ Received files count:", recommendedFiles.length);
    recommendedFiles.forEach((file, index) => {
      console.log(`File ${index}:`, file.name, file.size, file.mimetype);
    });

    const formattedRecommended = [];

    for (let i = 0; i < recommended.length; i++) {
      const item = recommended[i];
      let imageUrl = "";

      // ✅ Upload image to Cloudinary if exists
      if (recommendedFiles[i]) {
        console.log(`📤 Uploading image for index ${i}:`, recommendedFiles[i].name);
        try {
          imageUrl = await uploadToCloudinary(
            recommendedFiles[i],
            "restaurant-recommended"
          );
          console.log(`✅ Image uploaded for index ${i}:`, imageUrl);
        } catch (uploadError) {
          console.error(`❌ Cloudinary upload failed for index ${i}:`, uploadError);
          imageUrl = ""; // Empty if upload fails
        }
      } else {
        console.log(`❌ No file found for index ${i}`);
      }

      // ✅ Parse addons safely
      let parsedAddons = {
        productName: item.name || "",
        variation: { name: "", type: [] },
        plates: { name: "" },
      };

      if (item.addons) {
        try {
          parsedAddons = {
            productName: item.addons.productName || item.name || "",
            variation: {
              name: item.addons.variation?.name || "",
              type: Array.isArray(item.addons.variation?.type) 
                ? item.addons.variation.type 
                : [],
            },
            plates: {
              name: item.addons.plates?.name || "",
            },
          };
        } catch (err) {
          console.error("Error parsing addons:", err);
        }
      }

      const vendorPlateCost = parseFloat(item.vendor_Platecost) || 0;
      const vendorHalfPercentage = parseFloat(item.vendorHalfPercentage) || 0;

      formattedRecommended.push({
        name: item.name,
        price: parseFloat(item.price) || 0,
        rating: 0,
        viewCount: 0,
        content: item.content || "",
        image: imageUrl, // This will be Cloudinary URL or empty string
        vendorHalfPercentage: vendorHalfPercentage,
        vendor_Platecost: vendorPlateCost,
        addons: parsedAddons,
        category: item.category || null,
      });
    }

    // ⚙️ Create new Restaurant Product
    const newProduct = new RestaurantProduct({
      restaurantName: restaurant.restaurantName,
      locationName: restaurant.locationName,
      type: typeof type === "string" ? JSON.parse(type) : type,
      rating: restaurant.rating || 0,
      viewCount: parseInt(viewCount) || 0,
      recommended: formattedRecommended,
      restaurantId: restaurantId,
      userId: userId,
      timeAndKm: {
        time: "0 mins",
        distance: "0 km"
      },
      status: status || "active",
    });

    const savedProduct = await newProduct.save();

    console.log("✅ Product saved successfully:", savedProduct._id);

    return res.status(201).json({
      success: true,
      message: "Restaurant Product created successfully ✅",
      data: savedProduct,
    });
  } catch (error) {
    console.error("❌ Create Restaurant Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
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
    const { categoryName, name } = req.query; // filters

    // ✅ Validate restaurantId
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ success: false, message: "Valid restaurantId is required" });
    }

    // ✅ Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    // ✅ Fetch all products with populated categories
    const products = await RestaurantProduct.find({ restaurantId })
      .populate("recommended.category");

    if (!products.length) {
      return res.status(404).json({ success: false, message: "No recommended products found" });
    }

    // ✅ Flatten all recommended items
    let recommendedList = [];

    products.forEach(product => {
      if (Array.isArray(product.recommended) && product.recommended.length > 0) {
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
              _id: item._id,
              name: item.name || "",
              price: item.price || 0,
              rating: item.rating || 0,
              viewCount: item.viewCount || 0,
              content: item.content || "",
              image: item.image || "",
              addons: item.addons || {},
              category: item.category || null,
              vendorHalfPercentage: item.vendorHalfPercentage || 0,
              vendor_Platecost: item.vendor_Platecost || 0,
              calculatedPrice: item.calculatedPrice || null,
            }
          });
        });
      }
    });

    // ✅ Apply filters (case-insensitive)
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
      recommendedProducts: recommendedList
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

    // Find existing product
    const existingProduct = await RestaurantProduct.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: "Restaurant Product not found." });
    }

    const { type, status, viewCount } = req.body;

    // Parse recommended array
    let recommended = [];
    if (typeof req.body.recommended === "string") {
      try {
        recommended = JSON.parse(req.body.recommended);
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid recommended JSON" });
      }
    } else if (Array.isArray(req.body.recommended)) {
      recommended = req.body.recommended;
    }

    const recommendedFiles = req.files?.recommendedImages || [];

    const formattedRecommended = [];

    for (let i = 0; i < recommended.length; i++) {
      const item = recommended[i];
      // Keep existing image if not updating
      let imageUrl = item.image || (existingProduct.recommended[i]?.image || "");

      // Upload new image if provided
      if (recommendedFiles[i]) {
        imageUrl = await uploadToCloudinary(recommendedFiles[i], "restaurant-recommended");
      }

      // Parse addons safely
      const parsedAddons = {
        productName: item.addons?.productName || existingProduct.recommended[i]?.addons?.productName || "",
        variation: {
          name: item.addons?.variation?.name || existingProduct.recommended[i]?.addons?.variation?.name || "",
          type: Array.isArray(item.addons?.variation?.type) ? item.addons.variation.type : existingProduct.recommended[i]?.addons?.variation?.type || []
        },
        plates: {
          name: item.addons?.plates?.name || existingProduct.recommended[i]?.addons?.plates?.name || ""
        }
      };

      formattedRecommended.push({
        name: item.name || existingProduct.recommended[i]?.name || "",
        price: parseFloat(item.price) || existingProduct.recommended[i]?.price || 0,
        rating: item.rating || existingProduct.recommended[i]?.rating || 0,
        viewCount: item.viewCount || existingProduct.recommended[i]?.viewCount || 0,
        content: item.content || existingProduct.recommended[i]?.content || "",
        image: imageUrl,
        vendorHalfPercentage: parseFloat(item.vendorHalfPercentage) || existingProduct.recommended[i]?.vendorHalfPercentage || 0,
        vendor_Platecost: parseFloat(item.vendor_Platecost) || existingProduct.recommended[i]?.vendor_Platecost || 0,
        addons: parsedAddons,
        category: item.category || existingProduct.recommended[i]?.category || null
      });
    }

    // Prepare update object
    const updateData = {
      ...(type && { type: typeof type === "string" ? JSON.parse(type) : type }),
      ...(status && { status }),
      ...(viewCount !== undefined && { viewCount: parseInt(viewCount) }),
      ...(recommended.length > 0 && { recommended: formattedRecommended })
    };

    // Update the product
    const updatedProduct = await RestaurantProduct.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Restaurant Product updated successfully ✅",
      data: updatedProduct
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