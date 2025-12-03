const cloudinary = require("cloudinary");
const dotenv = require("dotenv");
const Ambassador = require("../models/ambassadorModel");
const userModel = require("../models/userModel");
const orderModel = require("../models/orderModel");
const AmbassadorWithdrawal = require("../models/AmbassadorWithdrawal");
const restaurantModel = require("../models/restaurantModel");
const Amount = require("../models/Amount");
const AmbassadorPayment = require("../models/AmbassadorPayment");
const Razorpay = require('razorpay'); // ✅ Import Razorpay
const AmbassadorPlan = require("../models/AmbassadorPlan");
dotenv.config();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.createAmbassador = async (req, res) => {
  try {
    const formData = req.body;

    console.log("Request body:", req.body);
    console.log("Uploaded files:", req.files);

    // ========================
    // Step 1: Generate referral code
    // ========================
    const ambassadorCount = await Ambassador.countDocuments();
    const referralCode = `VEGGYFYAMB${(ambassadorCount + 1).toString().padStart(2, '0')}`;

    // ========================
    // Step 2: Handle file uploads (Profile Image, Aadhar Card, PAN Card)
    // ========================
    let uploadedImageUrl = "";
    let uploadedAadharUrl = "";
    let uploadedPanUrl = "";

    // Handle Profile Image
    if (req.files && req.files.profileImage) {
      const profileImage = req.files.profileImage;

      if (profileImage.mimetype.startsWith('image')) {
        const result = await cloudinary.uploader.upload(profileImage.tempFilePath, {
          folder: "veggyfy/ambassadors/profile",
        });
        uploadedImageUrl = result.secure_url;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type for profile image. Only image files are allowed.",
        });
      }
    }

    // Handle Aadhar Card - REQUIRED
    if (req.files && req.files.aadharCard) {
      const aadharCard = req.files.aadharCard;

      // Check if file is image or PDF
      if (aadharCard.mimetype.startsWith('image') || aadharCard.mimetype === 'application/pdf') {
        const result = await cloudinary.uploader.upload(aadharCard.tempFilePath, {
          folder: "veggyfy/ambassadors/documents/aadhar",
          resource_type: aadharCard.mimetype === 'application/pdf' ? 'raw' : 'image'
        });
        uploadedAadharUrl = result.secure_url;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type for Aadhar Card. Only images and PDF are allowed.",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Aadhar Card is required for verification.",
      });
    }

    // Handle PAN Card - REQUIRED
    if (req.files && req.files.panCard) {
      const panCard = req.files.panCard;

      // Check if file is image or PDF
      if (panCard.mimetype.startsWith('image') || panCard.mimetype === 'application/pdf') {
        const result = await cloudinary.uploader.upload(panCard.tempFilePath, {
          folder: "veggyfy/ambassadors/documents/pan",
          resource_type: panCard.mimetype === 'application/pdf' ? 'raw' : 'image'
        });
        uploadedPanUrl = result.secure_url;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type for PAN Card. Only images and PDF are allowed.",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "PAN Card is required for verification.",
      });
    }

    // ========================
    // Step 3: Check if ambassador already exists with same email or mobile
    // ========================
    const existingAmbassador = await Ambassador.findOne({
      $or: [
        { email: formData.email },
        { mobileNumber: formData.mobileNumber }
      ]
    });

    if (existingAmbassador) {
      return res.status(400).json({
        success: false,
        message: "Ambassador with this email or mobile number already exists.",
      });
    }

    // ========================
    // Step 4: Create Ambassador document with KYC documents
    // ========================
    const newAmbassador = new Ambassador({
      // Personal Information
      fullName: formData.fullName,
      email: formData.email,
      mobileNumber: formData.mobileNumber,
      dateOfBirth: formData.dateOfBirth || "",
      gender: formData.gender || "",
      
      // Location Information
      city: formData.city,
      area: formData.area,
      pincode: formData.pincode || "",
      
      // Social Media
      instagram: formData.instagram || "",
      facebook: formData.facebook || "",
      twitter: formData.twitter || "",
      
      // Ambassador Specific
      whyVeggyfy: formData.whyVeggyfy,
      marketingIdeas: formData.marketingIdeas || "",
      targetAudience: formData.targetAudience || "",
      expectedCommission: formData.expectedCommission || "",
      
      // Referral & Status
      referralCode: referralCode,
      referredBy: formData.referredBy || null,
      status: formData.status || "pending",
      
      // Files
      profileImage: uploadedImageUrl || "",
      aadharCard: uploadedAadharUrl,
      panCard: uploadedPanUrl,
      
      // Wallet
      wallet: 0,
      
      // KYC Status
      kycStatus: "pending", // pending, approved, rejected
      kycSubmittedAt: new Date()
    });

    await newAmbassador.save();

    // ========================
    // Step 5: Referral Logic
    // ========================
    if (formData.referredBy && formData.referredBy.trim() !== "") {
      const code = formData.referredBy.trim();

      if (code.startsWith("VEGGYFYAMB")) {
        // Ambassador referred by another ambassador
        const refAmbassador = await Ambassador.findOne({ referralCode: code });
        if (refAmbassador) {
          const amountData = await Amount.findOne({ type: "Ambsaddor to Ambsaddor" });
          if (amountData) {
            refAmbassador.wallet = (refAmbassador.wallet || 0) + amountData.amount;
            await refAmbassador.save();

            // Create referral bonus record
            const referralBonus = new ReferralBonus({
              referrerId: refAmbassador._id,
              referredId: newAmbassador._id,
              referralCode: code,
              amount: amountData.amount,
              type: "ambassador_to_ambassador",
              status: "credited"
            });
            await referralBonus.save();
          }
        }
      }

      if (code.startsWith("VEGGYFYVENDOR")) {
        // Ambassador referred by vendor
        const refVendor = await Restaurant.findOne({ referralCode: code });
        if (refVendor) {
          const amountData = await Amount.findOne({ type: "Vendor to Ambassador" });
          if (amountData) {
            refVendor.walletBalance = (refVendor.walletBalance || 0) + amountData.amount;
            await refVendor.save();

            // Create referral bonus record
            const referralBonus = new ReferralBonus({
              referrerId: refVendor._id,
              referredId: newAmbassador._id,
              referralCode: code,
              amount: amountData.amount,
              type: "vendor_to_ambassador",
              status: "credited"
            });
            await referralBonus.save();
          }
        }
      }
    }

    // ========================
    // Step 6: Send confirmation email (optional)
    // ========================
    try {
      // You can add email sending logic here
      console.log(`Ambassador application received from: ${formData.email}`);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail the request if email fails
    }

    // ========================
    // Step 7: Response
    // ========================
    res.status(201).json({
      success: true,
      message: "Ambassador application submitted successfully! Your KYC documents are under verification.",
      data: {
        _id: newAmbassador._id,
        fullName: newAmbassador.fullName,
        email: newAmbassador.email,
        referralCode: newAmbassador.referralCode,
        status: newAmbassador.status,
        kycStatus: newAmbassador.kycStatus,
        appliedAt: newAmbassador.createdAt
      },
    });

  } catch (err) {
    console.error("❌ Error creating ambassador:", err);
    
    // Clean up uploaded files if error occurred
    try {
      // You can add cleanup logic for Cloudinary files if needed
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating ambassador",
      error: err.message,
    });
  }
};


exports.loginAmbassador = async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    // Check if the mobile number was provided in the request body
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required.",
      });
    }

    // Find the ambassador by mobile number
    const ambassador = await Ambassador.findOne({ mobileNumber });

    // If the ambassador doesn't exist
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: "Ambassador not found with this mobile number.",
      });
    }

    // ✅ Step: Return ambassador details (excluding sensitive info like password)
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        ambassadorId: ambassador._id, // Adding ambassador ID
        fullName: ambassador.fullName,
        email: ambassador.email,
        mobileNumber: ambassador.mobileNumber,
        city: ambassador.city,
        area: ambassador.area,
        instagram: ambassador.instagram,
        facebook: ambassador.facebook,
        twitter: ambassador.twitter,
        profileImage: ambassador.profileImage,
        status: ambassador.status,
      },
    });
  } catch (err) {
    console.error("❌ Error logging in ambassador:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};




exports.getAllAmbassadors = async (req, res) => {
  try {
    // Fetch all ambassadors from the database
    const ambassadors = await Ambassador.find();

    if (!ambassadors || ambassadors.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No ambassadors found.",
      });
    }

    // Step 1: Get order count for each ambassador
    const ambassadorWithOrderCount = await Promise.all(
      ambassadors.map(async (ambassador) => {
        // Fetch the users associated with the ambassador
        const userIds = ambassador.users;

        // If no users, return the ambassador with 0 order count
        if (!userIds || userIds.length === 0) {
          return { ...ambassador.toObject(), orderCount: 0 };
        }

        // Step 2: Get all orders for the users associated with the ambassador
        const orders = await orderModel.find({ userId: { $in: userIds } });

        // Step 3: Return ambassador with order count
        return { ...ambassador.toObject(), orderCount: orders.length };
      })
    );

    res.status(200).json({
      success: true,
      message: "Ambassadors fetched successfully.",
      data: ambassadorWithOrderCount,
    });
  } catch (err) {
    console.error("❌ Error fetching ambassadors:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};



exports.updateAmbassador = async (req, res) => {
  try {
    console.log("🟢 Incoming request to update ambassador");
    console.log("📦 req.body:", req.body);
    console.log("📂 req.files:", req.files);

    const { ambassadorId } = req.params;
    const formData = req.body;

    // ✅ Step 1: Find Ambassador
    const ambassador = await Ambassador.findById(ambassadorId);
    if (!ambassador) {
      console.log("❌ Ambassador not found for ID:", ambassadorId);
      return res.status(404).json({
        success: false,
        message: "Ambassador not found.",
      });
    }

    // ✅ Step 2: Handle profile image upload (if provided)
    let uploadedImageUrl = ambassador.profileImage;

    if (req.files && req.files.profileImage) {
      console.log("📸 Profile image found, uploading to Cloudinary...");

      const profileImage = req.files.profileImage;

      // Safety check for express-fileupload
      if (!profileImage.tempFilePath) {
        console.log("❌ No tempFilePath found for uploaded file!");
        return res.status(400).json({
          success: false,
          message: "Invalid file upload — tempFilePath missing.",
        });
      }

      // Validate mimetype
      if (!profileImage.mimetype.startsWith("image")) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Only image files are allowed.",
        });
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(profileImage.tempFilePath, {
        folder: "veggyfy/ambassadors",
      });

      uploadedImageUrl = result.secure_url;
      console.log("✅ Image uploaded successfully:", uploadedImageUrl);
    } else {
      console.log("ℹ️ No new profile image uploaded. Keeping old image.");
    }

    // ✅ Step 3: Update all provided fields
    const updatableFields = [
      "fullName",
      "email",
      "mobileNumber",
      "dateOfBirth",
      "gender",
      "city",
      "area",
      "pincode",
      "instagram",
      "facebook",
      "twitter",
      "whyVeggyfy",
      "marketingIdeas",
      "targetAudience",
      "expectedCommission",
      "referralCode",
      "status",
    ];

    updatableFields.forEach((field) => {
      if (formData[field]) {
        ambassador[field] = formData[field];
        console.log(`✅ Updated field: ${field} → ${formData[field]}`);
      }
    });

    ambassador.profileImage = uploadedImageUrl;

    // ✅ Step 4: Save updated data
    await ambassador.save();
    console.log("💾 Ambassador saved successfully.");

    res.status(200).json({
      success: true,
      message: "Ambassador details updated successfully!",
      data: ambassador,
    });
  } catch (err) {
    console.error("❌ Error updating ambassador:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};



exports.deleteAmbassador = async (req, res) => {
  try {
    const { ambassadorId } = req.params;  // Get ambassadorId from URL params

    // Find the ambassador by ID and delete
    const ambassador = await Ambassador.findByIdAndDelete(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: "Ambassador not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Ambassador deleted successfully!",
    });
  } catch (err) {
    console.error("❌ Error deleting ambassador:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};



exports.getAmbassadorById = async (req, res) => {
  try {
    const { ambassadorId } = req.params;  // Get ambassadorId from URL params

    // Find the ambassador by ID
    const ambassador = await Ambassador.findById(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: "Ambassador not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Ambassador details fetched successfully!",
      data: ambassador,
    });
  } catch (err) {
    console.error("❌ Error fetching ambassador:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};



exports.getAllUsersByAmbassador = async (req, res) => {
  try {
    // Get the ambassador ID from the request params
    const { ambassadorId } = req.params;

    // Find the ambassador by their ID
    const ambassador = await Ambassador.findById(ambassadorId);
    
    if (!ambassador) {
      return res.status(404).json({
        message: 'Ambassador not found with this ID',
      });
    }

    // Check if the ambassador has any users associated with them
    const userIds = ambassador.users;
    
    if (!userIds || userIds.length === 0) {
      return res.status(200).json({
        message: 'No users found for this ambassador',
        data: [],
      });
    }

    // Fetch all users based on the userIds in the ambassador's 'users' array
    const users = await userModel.find({ '_id': { $in: userIds } });

    // If users are found, return their details
    return res.status(200).json({
      message: 'Users found successfully',
      data: users,
    });

  } catch (err) {
    console.error('❌ Error fetching users by ambassador:', err);
    return res.status(500).json({
      message: 'Error fetching users for this ambassador',
      error: err.message,
    });
  }
};


exports.getReferredAmbassadorsByAmbassador = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    // Step 1: Find the ambassador by ID
    const ambassador = await Ambassador.findById(ambassadorId);

    if (!ambassador) {
      return res.status(404).json({
        message: 'Ambassador not found with this ID',
      });
    }

    // Step 2: Find all ambassadors whose referredBy matches this ambassador's referralCode
    const referredAmbassadors = await Ambassador.find({ referredBy: ambassador.referralCode });

    if (referredAmbassadors.length === 0) {
      return res.status(200).json({
        message: 'No ambassadors referred by this ambassador',
        data: [],
      });
    }

    // Step 3: Return the result
    return res.status(200).json({
      message: 'Referred ambassadors fetched successfully',
      data: referredAmbassadors,
    });

  } catch (err) {
    console.error('❌ Error fetching referred ambassadors:', err);
    return res.status(500).json({
      message: 'Error fetching referred ambassadors',
      error: err.message,
    });
  }
};



exports.getAllVendorsByAmbassador = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    // 1️⃣ Validate Ambassador
    const ambassador = await Ambassador.findById(ambassadorId);

    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: "Ambassador not found",
      });
    }

    // 2️⃣ Ambassador referral code
    const referralCode = ambassador.referralCode;

    if (!referralCode) {
      return res.status(200).json({
        success: true,
        message: "This ambassador has no referral code",
        data: [],
      });
    }

    // 3️⃣ Find all Vendors(Restaurants) referred by this ambassador
    const vendors = await restaurantModel.find({ referredBy: referralCode });

    if (!vendors || vendors.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No vendors found for this ambassador",
        data: [],
      });
    }

    // 4️⃣ Return vendors
    return res.status(200).json({
      success: true,
      message: "Vendors fetched successfully",
      data: vendors,
    });

  } catch (err) {
    console.error("❌ Error fetching vendors by ambassador:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching vendors",
      error: err.message,
    });
  }
};



exports.getAllOrdersByAmbassador = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    // Step 1: Find the ambassador by ID with transactionHistory
    const ambassador = await Ambassador.findById(ambassadorId);

    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found',
      });
    }

    console.log("Ambassador Transaction History:", ambassador.transactionHistory);

    // Step 2: Get all the users associated with the ambassador
    const userIds = ambassador.users;

    if (!userIds || userIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No users found for this ambassador.',
        data: [],
      });
    }

    // Step 3: Fetch orders for all users
    const orders = await orderModel.find({
      userId: { $in: userIds },
    })
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId")
      .populate({
        path: "cartId",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "restaurantId", select: "restaurantName locationName" },
          {
            path: "products.restaurantProductId",
            select: "name price image",
          },
          { path: "appliedCouponId", select: "code discountPercentage" },
        ],
      })
      .populate("deliveryBoyId", "fullName mobileNumber vehicleType email deliveryBoyStatus");

    // Step 4: Create a map for faster commission lookup
    const commissionMap = new Map();
    ambassador.transactionHistory.forEach(transaction => {
      // Convert both to string for comparison
      commissionMap.set(transaction.orderId.toString(), transaction.commission);
    });

    console.log("Commission Map:", commissionMap);

    // Step 5: Convert orders to plain objects and add commission
    const ordersWithCommission = orders.map(order => {
      const orderObj = order.toObject(); // Convert to plain JavaScript object
      
      const orderIdStr = order._id.toString();
      console.log(`Checking commission for Order ID: ${orderIdStr}`);
      
      const commission = commissionMap.get(orderIdStr) || 0;
      
      console.log(`Commission found: ${commission} for Order: ${orderIdStr}`);
      
      return {
        ...orderObj,
        commission: commission
      };
    });

    // Log final result
    console.log("Final Orders with Commission:", JSON.stringify(ordersWithCommission, null, 2));

    // Step 6: Return the modified orders with commission
    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully.",
      data: ordersWithCommission,
    });
  } catch (error) {
    console.error("getAllOrdersByAmbassador error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getTransactionHistoryAndWalletByAmbassador = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    // Step 1: Find the ambassador by ID with transactionHistory and wallet field
    const ambassador = await Ambassador.findById(ambassadorId)
      .populate({
        path: 'transactionHistory.orderId', // Populate the orderId field inside transactionHistory
        populate: [
          { path: 'userId', select: 'name email phone' }, // Populate user details if needed
          { path: 'restaurantId', select: 'restaurantName locationName' }, // Populate restaurant details if needed
        ]
      });

    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found',
      });
    }

    // Step 2: Fetch the wallet balance from ambassador's document
    const walletBalance = ambassador.wallet || 0;  // Assuming the wallet balance is a field in the ambassador model

    // Step 3: Map the transaction history to show the required fields
    const transactionHistory = ambassador.transactionHistory.map(transaction => {
      return {
        orderId: transaction.orderId, // Order ID of the transaction
        userId: transaction.orderId.userId, // User who placed the order (populated)
        restaurantId: transaction.orderId.restaurantId, // Restaurant from the order (populated)
        commission: transaction.commission, // The commission the ambassador received
        date: transaction.date, // The date of the transaction
      };
    });

    // Log the final transaction history and wallet balance
    console.log("Transaction History:", transactionHistory);
    console.log("Wallet Balance:", walletBalance);

    // Step 4: Return the transaction history and wallet balance
    return res.status(200).json({
      success: true,
      message: "Transaction history and wallet balance fetched successfully.",
      data: {
        transactionHistory: transactionHistory,  // Transaction history with full details
        walletBalance: walletBalance,  // Ambassador's wallet balance
      },
    });
  } catch (error) {
    console.error("getTransactionHistoryAndWalletByAmbassador error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.getTop10Ambassadors = async (req, res) => {
  try {
    const { ambassadorId } = req.params; // The ambassadorId to check from which ambassador to start
    
    // Step 1: Fetch the ambassador's data to use as the reference point for ranking
    const referenceAmbassador = await Ambassador.findById(ambassadorId);

    if (!referenceAmbassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found',
      });
    }

    // Step 2: Sort the ambassadors based on total commission or any other criteria
    const ambassadors = await Ambassador.aggregate([
      // Add total commission for each ambassador
      {
        $addFields: {
          totalCommission: { $sum: "$transactionHistory.commission" },  // Assuming commission is stored in transactionHistory
        }
      },
      // Sort the ambassadors by total commission (descending order)
      {
        $sort: { totalCommission: -1 }
      },
      // Limit the result to the top 10 ambassadors
      {
        $limit: 10
      }
    ]);

    // Step 3: Find the current ambassador's rank based on total commission
    let ambassadorRank = 0;
    for (let i = 0; i < ambassadors.length; i++) {
      if (ambassadors[i]._id.toString() === ambassadorId) {
        ambassadorRank = i + 1; // Rank is 1-based
        break;
      }
    }

    // Step 4: If no ambassador found in the result, default to 'Not Ranked'
    if (ambassadorRank === 0) {
      ambassadorRank = 'Not Ranked';
    }

    // Step 5: Return the top 10 ambassadors and the current ambassador's rank
    return res.status(200).json({
      success: true,
      message: "Top 10 ambassadors fetched successfully.",
      data: {
        topAmbassadors: ambassadors,
        currentAmbassadorRank: ambassadorRank, // Show where the given ambassador ranks
      },
    });
  } catch (error) {
    console.error("getTop10Ambassadors error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




// Request Withdrawal - Create a new withdrawal request
exports.requestAmbassadorWithdrawal = async (req, res) => {
  try {
    const { ambassadorId } = req.params;
    const { amount, accountDetails, upiId } = req.body; // Amount to withdraw, account details, UPI ID
    
    // Step 1: Find the ambassador by ID
    const ambassador = await Ambassador.findById(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found.',
      });
    }

    // Step 2: Check if the ambassador has sufficient balance
    if (ambassador.wallet < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in wallet.',
      });
    }

    // Step 3: Create a withdrawal request with detailed account information
    const withdrawalRequest = new AmbassadorWithdrawal({
      ambassadorId,
      amount,
      status: 'pending',
      accountDetails, // Add account details object
      upiId, // Add UPI ID
    });
    
    await withdrawalRequest.save();

    // Step 4: Return the created withdrawal request
    return res.status(200).json({
      success: true,
      message: 'Withdrawal request created successfully. Awaiting approval.',
      data: withdrawalRequest,
    });

  } catch (error) {
    console.error("requestAmbassadorWithdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



// Process Withdrawal (Accept or Reject)
exports.processAmbassadorWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, rejectionReason } = req.body; // status: 'accepted' or 'rejected'
    
    // Step 1: Find the withdrawal request
    const withdrawalRequest = await AmbassadorWithdrawal.findById(withdrawalId);
    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found.',
      });
    }

    // Step 2: Validate the status - it should be either 'accepted' or 'rejected'
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Please use either "accepted" or "rejected".',
      });
    }

    // Step 3: Handle the 'accepted' status
    if (status === 'accepted') {
      // Ensure the withdrawal request is still pending
      if (withdrawalRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'This withdrawal request has already been processed.',
        });
      }

      // Find the ambassador who requested the withdrawal
      const ambassador = await Ambassador.findById(withdrawalRequest.ambassadorId);
      if (!ambassador) {
        return res.status(404).json({
          success: false,
          message: 'Ambassador not found.',
        });
      }

      // Ensure the ambassador has enough balance
      if (ambassador.wallet < withdrawalRequest.amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient funds in ambassador wallet.',
        });
      }

      // Step 4: Deduct the amount from the ambassador's wallet
      ambassador.wallet -= withdrawalRequest.amount;
      await ambassador.save(); // Save the updated wallet balance

      // Step 5: Update the withdrawal request status to 'accepted'
      withdrawalRequest.status = 'accepted';
      withdrawalRequest.approvedAt = new Date();
      await withdrawalRequest.save();

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Withdrawal request accepted and processed.',
        data: withdrawalRequest,
      });
    }

    // Step 4: Handle the 'rejected' status
    if (status === 'rejected') {
      // Ensure the withdrawal request is still pending
      if (withdrawalRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'This withdrawal request has already been processed.',
        });
      }

      // Step 5: Update the withdrawal request status to 'rejected' and save the rejection reason
      withdrawalRequest.status = 'rejected';
      withdrawalRequest.rejectionReason = rejectionReason || 'No reason provided';
      withdrawalRequest.rejectedAt = new Date();
      await withdrawalRequest.save();

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Withdrawal request rejected.',
        data: withdrawalRequest,
      });
    }

  } catch (error) {
    console.error("processAmbassadorWithdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



// Get all withdrawal requests by Ambassador ID
exports.getAmbassadorWithdrawalRequests = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    // Step 1: Find all withdrawal requests for the specific ambassador
    const withdrawalRequests = await AmbassadorWithdrawal.find({ ambassadorId });

    if (!withdrawalRequests || withdrawalRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No withdrawal requests found for this ambassador.',
      });
    }

    // Step 2: Return the withdrawal requests
    return res.status(200).json({
      success: true,
      message: 'Withdrawal requests fetched successfully.',
      data: withdrawalRequests,
    });

  } catch (error) {
    console.error("getAmbassadorWithdrawalRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



// Get all withdrawal requests without Ambassador ID
exports.getAllWithdrawalRequests = async (req, res) => {
  try {
    // Optional: You can filter by status if needed
    const { status } = req.query; // Example query param for filtering

    let filter = {};
    if (status) {
      filter.status = status; // If a status is provided, filter by that
    }

    // Step 1: Fetch all withdrawal requests based on filter and populate the ambassadorId field
    const withdrawalRequests = await AmbassadorWithdrawal.find(filter)
      .populate('ambassadorId', 'fullName email mobileNumber'); // Populate ambassador details (you can add more fields here)

    if (!withdrawalRequests || withdrawalRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No withdrawal requests found.',
      });
    }

    // Step 2: Return all the withdrawal requests
    return res.status(200).json({
      success: true,
      message: 'Withdrawal requests fetched successfully.',
      data: withdrawalRequests,
    });

  } catch (error) {
    console.error("getAllWithdrawalRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



const razorpay = new Razorpay({
 key_id: 'rzp_test_BxtRNvflG06PTV',
 key_secret: 'RecEtdcenmR7Lm4AIEwo4KFr',
});


exports.capturePayment = async (req, res) => {
  try {
    const { ambassadorId } = req.params; // ambassadorId from URL params
    const { planId, transactionId } = req.body; // Only planId and transactionId from body

    if (!planId || !transactionId) {
      return res.status(400).json({ message: "planId and transactionId are required" });
    }

    // 1️⃣ Fetch the plan
    const plan = await AmbassadorPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // 2️⃣ Capture the payment manually with Razorpay
    const capturedPayment = await razorpay.payments.capture(transactionId, plan.price * 100, "INR");
    if (!capturedPayment || capturedPayment.status !== "captured") {
      return res.status(400).json({ message: "Payment capture failed" });
    }

    // 3️⃣ Find existing payment or create a new one
    let payment = await AmbassadorPayment.findOne({ ambassadorId, planId });

    const purchaseDate = new Date();
    const expiryDate = new Date(purchaseDate.getTime() + plan.validity * 365 * 24 * 60 * 60 * 1000); // validity in years

    if (!payment) {
      // Create new payment record
      payment = new AmbassadorPayment({
        ambassadorId,
        planId,
        transactionId,
        isPurchased: true,
        planPurchaseDate: purchaseDate,
        expiryDate,
      });
    } else {
      // Update existing payment record
      payment.transactionId = transactionId;
      payment.isPurchased = true;
      payment.planPurchaseDate = purchaseDate;
      payment.expiryDate = expiryDate;
    }

    await payment.save();

    res.status(200).json({
      success: true,
      message: "Payment captured successfully, plan activated",
      data: payment,
    });

  } catch (err) {
    console.error('❌ Error capturing payment:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};



exports.getMyPlans = async (req, res) => {
  try {
    const { ambassadorId } = req.params; // Get ambassadorId from URL params

    if (!ambassadorId) {
      return res.status(400).json({ message: "Ambassador ID is required" });
    }

    // Fetch all payments for this ambassador and populate the plan
    const payments = await AmbassadorPayment.find({ ambassadorId })
      .populate('planId'); // Populate the plan details

    if (!payments || payments.length === 0) {
      return res.status(404).json({ message: "No plans found for this ambassador" });
    }

    res.status(200).json({
      success: true,
      message: "Ambassador plans fetched successfully",
      data: payments,
    });

  } catch (err) {
    console.error('❌ Error fetching ambassador plans:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};




exports.getAmbassadorDashboard = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    // 1. Get Ambassador Details
    const ambassador = await Ambassador.findById(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found',
      });
    }

    // 2. Get Total Users Count
    const totalUsers = ambassador.users?.length || 0;

    // 3. Get Total Vendors Count
    const referralCode = ambassador.referralCode;
    const totalVendors = await restaurantModel.countDocuments({ referredBy: referralCode });

    // 4. Get Total Orders Count and Earnings
    const userIds = ambassador.users || [];
    let totalOrders = 0;
    let totalEarnings = 0;

    if (userIds.length > 0) {
      const orders = await orderModel.find({ userId: { $in: userIds } });
      totalOrders = orders.length;
      
      // Calculate total earnings from transaction history
      totalEarnings = ambassador.transactionHistory?.reduce((sum, transaction) => {
        return sum + (transaction.commission || 0);
      }, 0) || 0;
    }

    // 5. Get Total Ambassadors Count (referred by this ambassador)
    const totalAmbassadors = await Ambassador.countDocuments({ referredBy: referralCode });

    // 6. Get Recent Orders (last 5)
    const recentOrders = await orderModel.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'fullName email')
      .populate('restaurantId', 'restaurantName')
      .select('orderId totalAmount orderStatus createdAt');

    // 7. Get Monthly Earnings Data (last 6 months)
    const monthlyEarnings = await getMonthlyEarnings(ambassador);

    // 8. Format Recent Orders for UI
    const formattedOrders = recentOrders.map(order => ({
      id: order.orderId,
      customer: order.userId?.fullName || 'Unknown Customer',
      amount: `₹${order.totalAmount?.toLocaleString() || '0'}`,
      status: order.orderStatus,
      date: formatTimeAgo(order.createdAt)
    }));

    // 9. Prepare Dashboard Data
    const dashboardData = {
      stats: {
        totalUsers,
        totalVendors,
        totalOrders,
        totalEarnings: `₹${totalEarnings.toLocaleString()}`,
        totalAmbassadors
      },
      chartData: {
        labels: monthlyEarnings.labels,
        earnings: monthlyEarnings.amounts,
        referrals: monthlyEarnings.referrals
      },
      recentOrders: formattedOrders,
      achievements: getAchievements(totalEarnings, totalUsers, totalOrders),
      ambassadorInfo: {
        fullName: ambassador.fullName,
        referralCode: ambassador.referralCode,
        wallet: ambassador.wallet || 0
      }
    };

    return res.status(200).json({
      success: true,
      message: 'Dashboard data fetched successfully',
      data: dashboardData,
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data',
      error: error.message,
    });
  }
};

// Helper function to get monthly earnings
async function getMonthlyEarnings(ambassador) {
  const months = [];
  const earnings = [];
  const referrals = [];
  
  // Get last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    
    const monthName = date.toLocaleString('en-IN', { month: 'short' });
    months.push(monthName);
    
    // Calculate monthly earnings (simplified - you might want to implement actual calculation)
    const monthlyEarning = Math.floor(Math.random() * 5000) + 1000;
    earnings.push(monthlyEarning);
    
    // Calculate monthly referrals (simplified)
    const monthlyReferrals = Math.floor(Math.random() * 10) + 5;
    referrals.push(monthlyReferrals);
  }
  
  return {
    labels: months,
    amounts: earnings,
    referrals: referrals
  };
}

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Helper function to get achievements
function getAchievements(earnings, users, orders) {
  const achievements = [];
  
  if (earnings > 10000) {
    achievements.push({
      icon: '🏆',
      title: 'Top Earner',
      desc: 'Earned over ₹10,000'
    });
  }
  
  if (users > 50) {
    achievements.push({
      icon: '🚀',
      title: 'Network Builder',
      desc: 'Referred 50+ users'
    });
  }
  
  if (orders > 100) {
    achievements.push({
      icon: '⭐',
      title: 'Sales Champion',
      desc: '100+ successful orders'
    });
  }
  
  // Default achievements if none met
  if (achievements.length === 0) {
    achievements.push(
      {
        icon: '🌟',
        title: 'Rising Star',
        desc: 'Keep going!'
      },
      {
        icon: '💫',
        title: 'Newcomer',
        desc: 'Start your journey'
      }
    );
  }
  
  return achievements;
}