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
const SubAdmin = require("../models/SubAdmin");
const path = require('path');



// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOADS_DIR = path.join(__dirname, '../uploads');


// Upload directories
const CATEGORIES_DIR = path.join(UPLOADS_DIR, 'categories');
const SUBCATEGORIES_DIR = path.join(UPLOADS_DIR, 'subcategories');

// Ensure directories exist
if (!fs.existsSync(CATEGORIES_DIR)) {
  fs.mkdirSync(CATEGORIES_DIR, { recursive: true });
  console.log(`📁 Created categories directory: ${CATEGORIES_DIR}`);
}
if (!fs.existsSync(SUBCATEGORIES_DIR)) {
  fs.mkdirSync(SUBCATEGORIES_DIR, { recursive: true });
  console.log(`📁 Created subcategories directory: ${SUBCATEGORIES_DIR}`);
}

// Base URL
const BASE_URL = 'https://api.vegiffyy.com';

// ✅ CREATE CATEGORY
exports.createCategory = async (req, res) => {
  try {
    console.log('📁 Received files:', req.files);
    console.log('📝 Received body:', req.body);

    const { categoryName, subAdminId } = req.body;
    const file = req.files?.image;

    if (!categoryName) {
      return res.status(400).json({ message: "Category name is required" });
    }

    if (!file) {
      return res.status(400).json({ message: "Main category image is required" });
    }

    // 🔹 Upload category image locally
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.name);
    const filename = `category-${uniqueSuffix}${ext}`;
    const uploadPath = path.join(CATEGORIES_DIR, filename);
    await file.mv(uploadPath);

    const imageUrl = `${BASE_URL}/uploads/categories/${filename}`;
    console.log(`✅ Category image saved: ${imageUrl}`);

    // 🔹 Default → Admin
    let createdBy = null;
    let note = "Created by Admin";

    // 🔹 If SubAdmin
    if (subAdminId && subAdminId !== 'null' && subAdminId !== 'undefined') {
      const subAdmin = await SubAdmin.findById(subAdminId);
      if (!subAdmin) {
        return res.status(404).json({ message: "Sub-admin not found" });
      }

      createdBy = subAdmin._id;
      note = `Created by Sub-admin: ${subAdmin.name} on ${new Date().toLocaleDateString()}`;
    }

    // 🔹 Subcategories
    let subcategories = [];
    try {
      subcategories = JSON.parse(req.body.subcategories || "[]");
    } catch (e) {
      subcategories = [];
    }

    const formattedSubcategories = [];

    for (let i = 0; i < subcategories.length; i++) {
      const subImage = req.files?.[`subcategoryImage_${i}`];
      let subImageUrl = null;

      if (subImage) {
        const subUniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const subExt = path.extname(subImage.name);
        const subFilename = `subcategory-${subUniqueSuffix}${subExt}`;
        const subUploadPath = path.join(SUBCATEGORIES_DIR, subFilename);
        await subImage.mv(subUploadPath);

        subImageUrl = `${BASE_URL}/uploads/subcategories/${subFilename}`;
        console.log(`✅ Subcategory image saved: ${subImageUrl}`);
      }

      formattedSubcategories.push({
        subcategoryName: subcategories[i].subcategoryName,
        subcategoryImageUrl: subImageUrl
      });
    }

    // 🔹 SAVE CATEGORY
    const category = await Category.create({
      categoryName,
      imageUrl: imageUrl,
      subcategories: formattedSubcategories,
      status: "pending",
      createdBy,
      note
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully ✅",
      data: category
    });

  } catch (err) {
    console.error("Create Category Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ✅ UPDATE CATEGORY
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { categoryName, status, subAdminId } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    /* ======================
       UPDATE CATEGORY DATA
    ====================== */

    if (categoryName) category.categoryName = categoryName;
    if (status) category.status = status;

    const file = req.files?.image;

    if (file) {
      // Delete old image
      if (category.imageUrl) {
        const oldImagePath = path.join(CATEGORIES_DIR, path.basename(category.imageUrl));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log(`🗑️ Deleted old category image: ${oldImagePath}`);
        }
      }

      // Upload new image
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.name);
      const filename = `category-${uniqueSuffix}${ext}`;
      const uploadPath = path.join(CATEGORIES_DIR, filename);
      await file.mv(uploadPath);

      category.imageUrl = `${BASE_URL}/uploads/categories/${filename}`;
      console.log(`✅ New category image saved: ${category.imageUrl}`);
    }

    /* ======================
       UPDATE SUBCATEGORIES
    ====================== */

    if (req.body.subcategories) {
      let subcategories = [];
      try {
        subcategories = JSON.parse(req.body.subcategories);
      } catch (e) {
        subcategories = [];
      }

      const updatedSubcategories = [];

      for (let i = 0; i < subcategories.length; i++) {
        const sub = subcategories[i];

        let subImageUrl = sub.subcategoryImageUrl || null;

        const subImage = req.files?.[`subcategoryImage_${i}`];

        if (subImage) {
          // Delete old subcategory image if exists
          if (subImageUrl && !subImageUrl.startsWith('http')) {
            const oldSubImagePath = path.join(SUBCATEGORIES_DIR, path.basename(subImageUrl));
            if (fs.existsSync(oldSubImagePath)) {
              fs.unlinkSync(oldSubImagePath);
              console.log(`🗑️ Deleted old subcategory image: ${oldSubImagePath}`);
            }
          }

          // Upload new subcategory image
          const subUniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const subExt = path.extname(subImage.name);
          const subFilename = `subcategory-${subUniqueSuffix}${subExt}`;
          const subUploadPath = path.join(SUBCATEGORIES_DIR, subFilename);
          await subImage.mv(subUploadPath);

          subImageUrl = `${BASE_URL}/uploads/subcategories/${subFilename}`;
          console.log(`✅ New subcategory image saved: ${subImageUrl}`);
        }

        updatedSubcategories.push({
          _id: sub._id || new mongoose.Types.ObjectId(),
          subcategoryName: sub.subcategoryName,
          subcategoryImageUrl: subImageUrl
        });
      }

      category.subcategories = updatedSubcategories;
    }

    /* ======================
       NOTE TRACKING
    ====================== */

    if (subAdminId && subAdminId !== 'null' && subAdminId !== 'undefined') {
      const subAdmin = await SubAdmin.findById(subAdminId);

      if (!subAdmin) {
        return res.status(404).json({
          success: false,
          message: "Sub-admin not found"
        });
      }

      category.note = `Updated by Sub-admin: ${subAdmin.name} on ${new Date().toLocaleDateString()}`;
    } else {
      category.note = `Updated by Admin on ${new Date().toLocaleDateString()}`;
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully ✅",
      data: category
    });

  } catch (err) {
    console.error("Update category error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};



exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // body safe handling
    const subcategoryId = req.body ? req.body.subcategoryId : null;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    /* =====================
       DELETE SUBCATEGORY
    ===================== */

    if (subcategoryId) {

      const subcategoryExists = category.subcategories.some(
        sub => sub._id.toString() === subcategoryId
      );

      if (!subcategoryExists) {
        return res.status(404).json({
          success: false,
          message: "Subcategory not found"
        });
      }

      category.subcategories = category.subcategories.filter(
        sub => sub._id.toString() !== subcategoryId
      );

      await category.save();

      return res.status(200).json({
        success: true,
        message: "Subcategory deleted successfully",
        data: category
      });
    }

    /* =====================
       DELETE FULL CATEGORY
    ===================== */

    await Category.findByIdAndDelete(categoryId);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });

  } catch (err) {

    console.error("Delete category error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });

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

// ✅ ADDED DISCOUNT FIELD
// File size limits (in bytes)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TOTAL_SIZE = 15 * 1024 * 1024; // 15MB

// Upload directories
const RESTAURANTS_DIR = path.join(UPLOADS_DIR, 'restaurants');
const DOCUMENTS_DIR = path.join(RESTAURANTS_DIR, 'documents');
const AADHAR_DIR = path.join(DOCUMENTS_DIR, 'aadhar');
const GST_DIR = path.join(DOCUMENTS_DIR, 'gst');

// Ensure directories exist
if (!fs.existsSync(RESTAURANTS_DIR)) {
  fs.mkdirSync(RESTAURANTS_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}
if (!fs.existsSync(AADHAR_DIR)) {
  fs.mkdirSync(AADHAR_DIR, { recursive: true });
}
if (!fs.existsSync(GST_DIR)) {
  fs.mkdirSync(GST_DIR, { recursive: true });
}

console.log('📁 Restaurant upload directories created');


// Helper function to upload file locally
const uploadLocalFile = async (file, folderPath, subFolder = '') => {
  if (!file) return null;

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(file.name);
  const filename = `${uniqueSuffix}${ext}`;

  let uploadPath;
  if (subFolder) {
    uploadPath = path.join(folderPath, subFolder, filename);
  } else {
    uploadPath = path.join(folderPath, filename);
  }

  await file.mv(uploadPath);

  // Return URL relative to uploads folder
  if (subFolder) {
    return `${BASE_URL}/uploads/restaurants/${subFolder}/${filename}`;
  }
  return `${BASE_URL}/uploads/restaurants/${filename}`;
};



function sendError(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

// Create Restaurant Controller
exports.createRestaurant = async (req, res) => {
  try {
    const {
      restaurantName,
      description,
      locationName,
      fullAddress,
      email,
      mobile,
      gstNumber,
      fssaiNo,
      referralCode,
      password,
      lat,
      lng,
      commission,
      discount,
      disclaimers
    } = req.body || {};

    /* ---------------- OPTIONAL VALIDATIONS ---------------- */

    if (commission !== undefined) {
      if (isNaN(commission) || commission < 0 || commission > 50) {
        return sendError(res, "Commission must be between 0 and 50");
      }
    }

    if (discount !== undefined) {
      if (isNaN(discount) || discount < 0 || discount > 100) {
        return sendError(res, "Discount must be between 0 and 100");
      }
    }

    // Validate FSSAI No if provided
    if (fssaiNo && fssaiNo.trim() !== "") {
      const fssaiRegex = /^\d{14}$/;
      if (!fssaiRegex.test(fssaiNo.replace(/\s/g, ''))) {
        return sendError(res, "Please enter a valid 14-digit FSSAI license number");
      }
    }

    // Validate full address if provided
    if (fullAddress && fullAddress.trim() === "") {
      return sendError(res, "Full address cannot be empty");
    }

    // Parse disclaimers if it's a string
    let parsedDisclaimers = [];
    if (disclaimers) {
      try {
        parsedDisclaimers = typeof disclaimers === 'string' ? JSON.parse(disclaimers) : disclaimers;
      } catch (e) {
        parsedDisclaimers = [disclaimers];
      }
    }

    /* ---------------- FILE SIZE VALIDATION ---------------- */
    let totalSize = 0;

    if (req.files) {
      for (const [key, file] of Object.entries(req.files)) {
        if (!file) continue;

        if (file.size > MAX_FILE_SIZE) {
          return sendError(res, `${key} exceeds 5MB limit`);
        }

        totalSize += file.size;
      }

      if (totalSize > MAX_TOTAL_SIZE) {
        return sendError(res, "Total file size exceeds 15MB");
      }
    }

    /* ---------------- LOCAL FILE UPLOADS ---------------- */
    const uploadedFiles = {};

    // Upload restaurant image
    if (req.files?.image) {
      uploadedFiles.image = await uploadLocalFile(
        req.files.image,
        RESTAURANTS_DIR,
        'images'
      );
      console.log(`✅ Restaurant image saved: ${uploadedFiles.image}`);
    }

    // Upload FSSAI License
    if (req.files?.fssaiLicense) {
      uploadedFiles.fssaiLicense = await uploadLocalFile(
        req.files.fssaiLicense,
        DOCUMENTS_DIR
      );
      console.log(`✅ FSSAI License saved: ${uploadedFiles.fssaiLicense}`);
    }

    // Upload PAN Card
    if (req.files?.panCard) {
      uploadedFiles.panCard = await uploadLocalFile(
        req.files.panCard,
        DOCUMENTS_DIR
      );
      console.log(`✅ PAN Card saved: ${uploadedFiles.panCard}`);
    }

    // Upload Aadhar Card Front
    if (req.files?.aadharCardFront) {
      uploadedFiles.aadharCardFront = await uploadLocalFile(
        req.files.aadharCardFront,
        AADHAR_DIR
      );
      console.log(`✅ Aadhar Front saved: ${uploadedFiles.aadharCardFront}`);
    }

    // Upload Aadhar Card Back
    if (req.files?.aadharCardBack) {
      uploadedFiles.aadharCardBack = await uploadLocalFile(
        req.files.aadharCardBack,
        AADHAR_DIR
      );
      console.log(`✅ Aadhar Back saved: ${uploadedFiles.aadharCardBack}`);
    }

    // Upload GST Certificate
    if (req.files?.gstCertificate) {
      uploadedFiles.gstCertificate = await uploadLocalFile(
        req.files.gstCertificate,
        GST_DIR
      );
      console.log(`✅ GST Certificate saved: ${uploadedFiles.gstCertificate}`);
    }

    /* ---------------- CREATE RESTAURANT ---------------- */
    const count = await Restaurant.countDocuments();
    const generatedReferralCode = `VEGVEN${String(count + 1).padStart(5, "0")}`;

    const restaurant = await Restaurant.create({
      restaurantName: restaurantName || null,
      description: description || null,
      locationName: locationName || null,
      fullAddress: fullAddress || null,
      email: email || null,
      mobile: mobile || null,
      gstNumber: gstNumber || null,
      fssaiNo: fssaiNo || null,
      commission: commission !== undefined ? Number(commission) : null,
      discount: discount !== undefined ? Number(discount) : null,
      password: password || null,
      referredBy: referralCode || null,
      referralCode: generatedReferralCode,
      disclaimers: parsedDisclaimers,
      location: lat && lng ? {
        type: "Point",
        coordinates: [Number(lng), Number(lat)]
      } : null,
      image: uploadedFiles.image || null,
      gstCertificate: uploadedFiles.gstCertificate || null,
      fssaiLicense: uploadedFiles.fssaiLicense || null,
      panCard: uploadedFiles.panCard || null,
      aadharCardFront: uploadedFiles.aadharCardFront || null,
      aadharCardBack: uploadedFiles.aadharCardBack || null,
      status: "pending",
      walletBalance: 0
    });

    const response = restaurant.toObject();
    delete response.password;

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      data: response,
      referralCode: generatedReferralCode
    });

  } catch (err) {
    console.error("Create Restaurant Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error"
    });
  }
};



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
    const restaurants = await Restaurant.find({ status: "active" });
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



exports.getAllRestaurantsforAdmin = async (req, res) => {
  try {
    // 🔹 Step 1: Aggregate order stats
    const orderStats = await orderModel.aggregate([
      {
        $match: { restaurantId: { $ne: null } },
      },
      {
        $group: {
          _id: "$restaurantId",
          totalOrders: { $sum: 1 },
          totalEarnings: { $sum: "$subTotal" }
        }
      }
    ]);

    // 🔹 Step 2: Aggregate user stats
    const userStats = await userModel.aggregate([
      {
        $match: { referredBy: { $ne: null } },
      },
      {
        $group: {
          _id: "$referredBy",
          totalUsers: { $sum: 1 }
        }
      }
    ]);

    // 🔹 Step 3: Maps
    const statsMap = {};
    orderStats.forEach(stat => {
      if (stat._id) {
        statsMap[stat._id.toString()] = {
          totalOrders: stat.totalOrders,
          totalEarnings: stat.totalEarnings.toFixed(2)
        };
      }
    });

    const userMap = {};
    userStats.forEach(stat => {
      if (stat._id) {
        userMap[stat._id.toString()] = {
          totalUsers: stat.totalUsers
        };
      }
    });

    // 🔹 Step 4: FETCH ONLY ACTIVE RESTAURANTS ✅
    const restaurants = await Restaurant.find();

    // 🔹 Step 5: Merge data
    const result = restaurants.map(restaurant => {
      const orderStats = statsMap[restaurant._id.toString()] || { totalOrders: 0, totalEarnings: 0 };
      const userStats = userMap[restaurant.referralCode] || { totalUsers: 0 };

      return {
        ...restaurant.toObject(),
        totalOrders: orderStats.totalOrders,
        totalEarnings: orderStats.totalEarnings,
        totalUsers: userStats.totalUsers
      };
    });

    // 🔹 Step 6: Response (UNCHANGED)
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


exports.getAllPendingRestaurants = async (req, res) => {
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
    const restaurants = await Restaurant.find({ status: "pending" });
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



// Update Restaurant Controller with Category Support (NO CLOUDINARY)
exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { subAdminId, categories } = req.body;

    // Find restaurant
    let restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Allowed updatable fields
    const updatableFields = [
      "restaurantName",
      "description",
      "locationName",
      "rating",
      "status",
      "commission",
      "discount",
      "email",
      "mobile",
      "gstNumber",
      "fullAddress",
      "fssaiNo"
    ];

    // Update simple fields
    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== "") {
        restaurant[field] = req.body[field];
      }
    });

    // Commission validation
    if (req.body.commission !== undefined) {
      const commission = parseFloat(req.body.commission);
      if (isNaN(commission) || commission < 0 || commission > 50) {
        return res.status(400).json({
          success: false,
          message: "Commission must be between 0 and 50",
        });
      }
      restaurant.commission = commission;
    }

    // Discount validation
    if (req.body.discount !== undefined) {
      const discount = parseFloat(req.body.discount);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        return res.status(400).json({
          success: false,
          message: "Discount must be between 0 and 100",
        });
      }
      restaurant.discount = discount;
    }

    // ✅ Categories update
    if (categories !== undefined) {
      let categoryArray = categories;

      if (typeof categories === 'string') {
        try {
          categoryArray = JSON.parse(categories);
        } catch (e) {
          categoryArray = categories.split(',').map(id => id.trim());
        }
      }

      if (Array.isArray(categoryArray) && categoryArray.length > 0) {
        const validCategories = await Category.find({
          '_id': { $in: categoryArray },
          status: 'active'
        });

        if (validCategories.length !== categoryArray.length) {
          return res.status(400).json({
            success: false,
            message: "One or more categories are invalid or inactive",
          });
        }
      }

      restaurant.categories = Array.isArray(categoryArray) ? categoryArray : [];
    }

    // ✅ Image update (LOCAL - NO CLOUDINARY)
    if (req.files && req.files.image) {
      const file = req.files.image;

      // Delete old image if exists
      if (restaurant.image) {
        const oldImagePath = path.join(RESTAURANT_IMAGES_DIR, path.basename(restaurant.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log(`🗑️ Deleted old restaurant image: ${oldImagePath}`);
        }
      }

      // Upload new image locally
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.name);
      const filename = `restaurant-${uniqueSuffix}${ext}`;
      const uploadPath = path.join(RESTAURANT_IMAGES_DIR, filename);
      await file.mv(uploadPath);

      restaurant.image = `${BASE_URL}/uploads/restaurants/images/${filename}`;
      console.log(`✅ New restaurant image saved: ${restaurant.image}`);
    }

    // ✅ Location update
    if (req.body.lat && req.body.lng) {
      restaurant.location = {
        type: "Point",
        coordinates: [Number(req.body.lng), Number(req.body.lat)]
      };
    }

    // ✅ Disclaimers update
    if (req.body.disclaimers) {
      try {
        restaurant.disclaimers = typeof req.body.disclaimers === 'string'
          ? JSON.parse(req.body.disclaimers)
          : req.body.disclaimers;
      } catch (e) {
        restaurant.disclaimers = [req.body.disclaimers];
      }
    }

    // ✅ NOTE & UPDATED BY logic
    let note = `Updated by Admin on ${new Date().toLocaleDateString()}`;
    let updatedBy = null;

    if (subAdminId && subAdminId !== 'null' && subAdminId !== 'undefined') {
      const subAdmin = await SubAdmin.findById(subAdminId);
      if (!subAdmin) {
        return res.status(404).json({
          success: false,
          message: "Sub-admin not found",
        });
      }

      note = `Updated by Sub-admin: ${subAdmin.name} on ${new Date().toLocaleDateString()}`;
      updatedBy = subAdminId;
    }

    restaurant.note = note;
    restaurant.updatedBy = updatedBy;

    await restaurant.save();

    // Populate categories before sending response
    await restaurant.populate('categories');

    return res.status(200).json({
      success: true,
      message: "Restaurant updated successfully ✅",
      data: restaurant,
    });

  } catch (err) {
    console.error("Update Restaurant Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// ✅ Delete Restaurant (NO CLOUDINARY)
exports.deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found"
      });
    }

    // ✅ Delete image if exists
    if (restaurant.image) {
      const imagePath = path.join(__dirname, '../uploads/restaurants/images', path.basename(restaurant.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // ✅ Delete restaurant from database
    await Restaurant.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Restaurant deleted successfully ✅"
    });

  } catch (err) {
    console.error("Delete Restaurant Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};



// ✅ Get Top Rated Restaurants Nearby (from already nearby)
exports.getTopRatedNearbyRestaurants = async (req, res) => {
  try {
    const { userId } = req.params; // Keep userId param
    const { maxDistance = 5000 } = req.query; // Default 5km

    // 1. Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // 2. Get user with location (currently commented out)
    /*
    const user = await User.findById(userId);
    if (!user || !user.location || !Array.isArray(user.location.coordinates)) {
      return res.status(404).json({ success: false, message: "User or location not found" });
    }

    const userCoords = user.location.coordinates;
    */

    // 3. Fetch all restaurants (ignoring location for now)
    const allRestaurants = await Restaurant.find().select("-__v");

    // 4. Filter top-rated (rating >= 4) and sort descending
    const topRated = allRestaurants
      .filter((r) => r.rating >= 4)
      .sort((a, b) => b.rating - a.rating);

    res.status(200).json({
      success: true,
      message: "Top-rated restaurants (location filter ignored)",
      count: topRated.length,
      data: topRated,
    });
  } catch (error) {
    console.error("Error fetching top-rated restaurants:", error);
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

    // 1️⃣ Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId"
      });
    }

    // 2️⃣ Get user location
    const user = await User.findById(userId);
    if (!user || !user.location || !Array.isArray(user.location.coordinates)) {
      return res.status(404).json({
        success: false,
        message: "User location not found"
      });
    }

    const [userLng, userLat] = user.location.coordinates;

const restaurants = await Restaurant.find({
  status: { $ne: "pending" } // exclude pending
}).select("-__v");


    // 4️⃣ Correct Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth radius in km
      const toRad = (deg) => deg * (Math.PI / 180);

      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // distance in km
    };

   // 5️⃣ Add distance field for each restaurant
const restaurantsWithDistance = restaurants.map((rest) => {
  if (rest.location && rest.location.coordinates?.length === 2) {
    const [restLng, restLat] = rest.location.coordinates;

    const distance = calculateDistance(userLat, userLng, restLat, restLng);

    return {
      ...rest.toObject(),
      distance: Number(distance.toFixed(2)) + " km"
    };
  }

  return {
    ...rest.toObject(),
    distance: null
  };
});

// ✅ ADD THIS SORTING
restaurantsWithDistance.sort((a, b) => {
  const distA = a.distance ? parseFloat(a.distance) : Infinity;
  const distB = b.distance ? parseFloat(b.distance) : Infinity;
  return distA - distB;
});

// 6️⃣ Send response
res.status(200).json({
  success: true,
  count: restaurantsWithDistance.length,
  data: restaurantsWithDistance
});

  } catch (error) {
    console.error("Error fetching nearby restaurants:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
// Helper function to calculate distance between two points (in meters)
function getDistance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

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
    const { userId } = req.params;          // userId path param se
    const { categoryId } = req.query;       // categoryId query param se

    // ---------------- Validation ----------------
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, message: "Valid categoryId is required" });
    }

    // ---------------- Fetch user ----------------
    const user = await User.findById(userId).select("location");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

const restaurants = await Restaurant.find({
  categories: { $in: [new mongoose.Types.ObjectId(categoryId)] },
  status: { $ne: "pending" }, // pending ko exclude kar diya
  isDeleted: false
}).select("-__v");

    if (!restaurants.length) {
      return res.status(404).json({ success: false, message: "No restaurants found for this category" });
    }

    // ---------------- Response ----------------
    res.status(200).json({
      success: true,
      message: `Nearby restaurants with products in this category`,
      count: restaurants.length,
      data: restaurants
    });

  } catch (error) {
    console.error("Error fetching restaurants by categoryId:", error);
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

    if (!accountDetails || !accountDetails.accountNumber || !accountDetails.bankName || !accountDetails.accountHolder) {
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

    // Check minimum withdrawal amount
    if (amountValue < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹100'
      });
    }

    // Calculate processing fee (2%)
    const processingFee = (amountValue * 2) / 100;
    const netAmount = amountValue - processingFee;

    // Check if sufficient balance exists (including fee)
    if ((restaurant.walletBalance || 0) < amountValue) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Deduct amount from wallet immediately
    restaurant.walletBalance -= amountValue;
    await restaurant.save();

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      restaurantId: restaurant._id,
      amount: amountValue,
      processingFee: processingFee,
      netAmount: netAmount,
      accountDetails,
      status: 'pending',
      requestedBy: restaurantId
    });

    await withdrawalRequest.save();

    // Create transaction record for deduction
    const transaction = new Transaction({
      restaurantId: restaurant._id,
      type: 'debit',
      amount: amountValue,
      description: `Withdrawal request #${withdrawalRequest._id.toString().slice(-8)}`,
      transactionType: 'withdrawal',
      balanceAfter: restaurant.walletBalance,
      status: 'pending',
      referenceId: withdrawalRequest._id
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawalRequest: {
          _id: withdrawalRequest._id,
          amount: withdrawalRequest.amount,
          processingFee: withdrawalRequest.processingFee,
          netAmount: withdrawalRequest.netAmount,
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
    const { withdrawalId } = req.params;
    const { status, subAdminId } = req.body; // 👈 subAdminId added

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'approved' or 'rejected'.",
      });
    }

    const withdrawalRequest = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found.",
      });
    }

    // Already processed?
    if (withdrawalRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This request has already been processed.",
      });
    }

    const restaurant = await Restaurant.findById(withdrawalRequest.restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Associated restaurant not found.",
      });
    }

    // ✅ NOTE & UPDATED BY logic
    let note = `Withdrawal ${status} by Admin`;
    let updatedBy = null;

    if (subAdminId) {
      const subAdmin = await SubAdmin.findById(subAdminId);
      if (!subAdmin) {
        return res.status(404).json({
          success: false,
          message: "Sub-admin not found",
        });
      }

      note = `Withdrawal ${status} by Sub-admin: ${subAdmin.name}`;
      updatedBy = subAdminId;
    }

    if (status === "rejected") {
      // Refund amount
      restaurant.walletBalance += withdrawalRequest.amount;
      await restaurant.save();
    }

    withdrawalRequest.status = status;
    withdrawalRequest.note = note;
    withdrawalRequest.updatedBy = updatedBy;

    await withdrawalRequest.save();

    return res.status(200).json({
      success: true,
      message: `Withdrawal request has been ${status} ✅`,
      data: withdrawalRequest,
    });

  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};



exports.deleteWithdrawalRequest = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { subAdminId } = req.body;

    const withdrawalRequest = await WithdrawalRequest.findById(withdrawalId);

    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found."
      });
    }

    // NOTE logic
    let note = "Withdrawal request deleted by Admin";

    if (subAdminId) {
      const subAdmin = await SubAdmin.findById(subAdminId);

      if (!subAdmin) {
        return res.status(404).json({
          success: false,
          message: "Sub-admin not found"
        });
      }

      note = `Withdrawal request deleted by Sub-admin: ${subAdmin.name}`;
    }

    // If pending -> refund amount
    if (withdrawalRequest.status === "pending") {
      restaurant.walletBalance += withdrawalRequest.amount;
      await restaurant.save();
    }

    await WithdrawalRequest.findByIdAndDelete(withdrawalId);

    return res.status(200).json({
      success: true,
      message: "Withdrawal request deleted successfully ✅",
      note
    });

  } catch (error) {
    console.error("Error deleting withdrawal request:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
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




// Upload directories
const DECLARATION_DIR = path.join(DOCUMENTS_DIR, 'declaration-forms');
const AGREEMENT_DIR = path.join(DOCUMENTS_DIR, 'vendor-agreements');

// Ensure directories exist
if (!fs.existsSync(DECLARATION_DIR)) {
  fs.mkdirSync(DECLARATION_DIR, { recursive: true });
}
if (!fs.existsSync(AGREEMENT_DIR)) {
  fs.mkdirSync(AGREEMENT_DIR, { recursive: true });
}

// Base URL



// ✅ Upload Restaurant Documents (NO CLOUDINARY)
exports.uploadRestaurantDocuments = async (req, res) => {
  try {
    const { vendorId } = req.params;

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

    const updateData = {};

    // Upload declaration form (LOCAL)
    if (req.files.declarationForm) {
      try {
        const fileUrl = await uploadLocalFile(req.files.declarationForm, DECLARATION_DIR);
        updateData.declarationForm = {
          url: fileUrl,
          uploadedAt: new Date()
        };
        console.log(`✅ Declaration form saved: ${fileUrl}`);
      } catch (uploadError) {
        console.error("Declaration form upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload declaration form'
        });
      }
    }

    // Upload vendor agreement (LOCAL)
    if (req.files.vendorAgreement) {
      try {
        const fileUrl = await uploadLocalFile(req.files.vendorAgreement, AGREEMENT_DIR);
        updateData.vendorAgreement = {
          url: fileUrl,
          uploadedAt: new Date()
        };
        console.log(`✅ Vendor agreement saved: ${fileUrl}`);
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
