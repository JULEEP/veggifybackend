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
const AmbassadorAccount = require("../models/AmbassadorAccount");
const nodemailer = require("nodemailer");
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
    // Step 1: Validate required fields including password
    // ========================
    if (!formData.password) {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    if (formData.password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // ========================
    // Step 2: Validate other required fields
    // ========================
    if (!formData.fullName || !formData.email || !formData.mobileNumber || 
        !formData.city || !formData.area || !formData.whyVeggyfy) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields: Full Name, Email, Mobile Number, City, Area, and Why Veggyfy.",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // Validate mobile number format
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(formData.mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number starting with 6-9.",
      });
    }

    // ========================
    // Step 3: Validate required documents
    // ========================
    if (!req.files || !req.files.aadharCardFront || !req.files.panCard) {
      return res.status(400).json({
        success: false,
        message: "Aadhar Card Front and PAN Card are required for verification.",
      });
    }

    // ========================
    // Step 4: Check if ambassador already exists
    // ========================
    const existingAmbassador = await Ambassador.findOne({
      $or: [
        { email: formData.email.toLowerCase() },
        { mobileNumber: formData.mobileNumber }
      ]
    });

    if (existingAmbassador) {
      const field = existingAmbassador.email === formData.email.toLowerCase() ? 'email' : 'mobile number';
      return res.status(400).json({
        success: false,
        message: `Ambassador with this ${field} already exists.`,
      });
    }

    // ========================
    // Step 5: Generate referral code
    // ========================
    const ambassadorCount = await Ambassador.countDocuments();
    const referralCode = `VEGGYFYAMB${(ambassadorCount + 1).toString().padStart(2, '0')}`;

    // ========================
    // Step 6: Hash the password
    // ========================
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(formData.password, saltRounds);

    // ========================
    // Step 7: Handle file uploads
    // ========================
    let uploadedImageUrl = "";
    let uploadedAadharFrontUrl = "";
    let uploadedAadharBackUrl = "";
    let uploadedPanUrl = "";

    // Handle Profile Image (Optional)
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

    // Handle Aadhar Card Front - REQUIRED
    const aadharCardFront = req.files.aadharCardFront;
    if (aadharCardFront.mimetype.startsWith('image') || aadharCardFront.mimetype === 'application/pdf') {
      const result = await cloudinary.uploader.upload(aadharCardFront.tempFilePath, {
        folder: "veggyfy/ambassadors/documents/aadhar/front",
        resource_type: aadharCardFront.mimetype === 'application/pdf' ? 'raw' : 'image'
      });
      uploadedAadharFrontUrl = result.secure_url;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid file type for Aadhar Card Front. Only images and PDF are allowed.",
      });
    }

    // Handle Aadhar Card Back - OPTIONAL
    if (req.files && req.files.aadharCardBack) {
      const aadharCardBack = req.files.aadharCardBack;
      if (aadharCardBack.mimetype.startsWith('image') || aadharCardBack.mimetype === 'application/pdf') {
        const result = await cloudinary.uploader.upload(aadharCardBack.tempFilePath, {
          folder: "veggyfy/ambassadors/documents/aadhar/back",
          resource_type: aadharCardBack.mimetype === 'application/pdf' ? 'raw' : 'image'
        });
        uploadedAadharBackUrl = result.secure_url;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type for Aadhar Card Back. Only images and PDF are allowed.",
        });
      }
    }

    // Handle PAN Card - REQUIRED
    const panCard = req.files.panCard;
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

    // ========================
    // Step 8: Validate Commission Percentage
    // ========================
    if (formData.commissionPercentage) {
      const commission = parseFloat(formData.commissionPercentage);
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return res.status(400).json({
          success: false,
          message: "Commission percentage must be a number between 0 and 100.",
        });
      }
    }

    // ========================
    // Step 9: Create Ambassador document with password
    // ========================
    const newAmbassador = new Ambassador({
      // Personal Information
      fullName: formData.fullName.trim(),
      email: formData.email.toLowerCase().trim(),
      mobileNumber: formData.mobileNumber.trim(),
      dateOfBirth: formData.dateOfBirth || null,
      gender: formData.gender || null,
      
      // Account Credentials
      password: hashedPassword,
      
      // Location Information
      city: formData.city.trim(),
      area: formData.area.trim(),
      pincode: formData.pincode || "",
      
      // Social Media
      instagram: formData.instagram || "",
      facebook: formData.facebook || "",
      twitter: formData.twitter || "",
      
      // Ambassador Specific
      whyVeggyfy: formData.whyVeggyfy.trim(),
      marketingIdeas: formData.marketingIdeas || "",
      targetAudience: formData.targetAudience || "",
      expectedCommission: formData.expectedCommission || "",
      commissionPercentage: formData.commissionPercentage ? parseFloat(formData.commissionPercentage) : null,
      
      // Referral & Status
      referralCode: referralCode,
      referredBy: formData.referredBy ? formData.referredBy.trim() : null,
      status: "pending",
      
      // Files
      profileImage: uploadedImageUrl || "",
      aadharCardFront: uploadedAadharFrontUrl,
      aadharCardBack: uploadedAadharBackUrl || null,
      panCard: uploadedPanUrl,
      
      // Wallet
      wallet: 0,
      
      // KYC Status
      kycStatus: "pending",
      kycSubmittedAt: new Date(),
      
      // Account Status
      isActive: true,
      lastLogin: null
    });

    await newAmbassador.save();

    // ========================
    // Step 10: Referral Logic
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
    // Step 11: Response
    // ========================
    res.status(201).json({
      success: true,
      message: "Ambassador application submitted successfully! Your KYC documents are under verification.",
      data: {
        _id: newAmbassador._id,
        fullName: newAmbassador.fullName,
        email: newAmbassador.email,
        referralCode: newAmbassador.referralCode,
        commissionPercentage: newAmbassador.commissionPercentage,
        status: newAmbassador.status,
        kycStatus: newAmbassador.kycStatus,
        appliedAt: newAmbassador.createdAt
      },
    });

  } catch (err) {
    console.error("❌ Error creating ambassador:", err);
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const message = field === 'email' 
        ? 'Email already registered' 
        : field === 'mobileNumber' 
          ? 'Mobile number already registered'
          : 'Referral code already exists';
      
      return res.status(400).json({ 
        success: false, 
        message 
      });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating ambassador",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};


const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `VEGIFFY! <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    return true;
  } catch (error) {
    console.log("Email Send Error:", error);
    return false;
  }
};

exports.loginAmbassador = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const ambassador = await Ambassador.findOne({
      email: email.toLowerCase(),
    });

    if (!ambassador) {
      return res.status(401).json({
        success: false,
        message: "Account not found",
      });
    }

    if (ambassador.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account not approved yet",
        status: ambassador.status,
      });
    }

    // 🔐 Generate 4-digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 💾 Save OTP
    ambassador.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
    };
    await ambassador.save();

    // 📧 Email HTML
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>VEGIFFY Ambassador Login OTP</h2>
        <p>Your login OTP is:</p>
        <h1 style="letter-spacing:5px;">${otpCode}</h1>
        <p>This OTP is valid for 5 minutes.</p>
        <p>If you did not request this, please ignore.</p>
      </div>
    `;

    // 📤 Send Email using existing helper
    const emailSent = await sendEmail(
      ambassador.email,
      "VEGIFFY - Login OTP",
      html
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
      ambassadorId: ambassador._id,
      otp: otpCode, // ⚠️ remove in production
    });

  } catch (error) {
    console.error("Ambassador login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



exports.verifyAmbassadorOtp = async (req, res) => {
  try {
    const { ambassadorId, otp } = req.body;

    if (!ambassadorId || !otp) {
      return res.status(400).json({
        success: false,
        message: "ambassadorId and otp are required",
      });
    }

    const ambassador = await Ambassador.findById(ambassadorId);

    if (!ambassador || !ambassador.otp) {
      return res.status(404).json({
        success: false,
        message: "OTP not found",
      });
    }

    if (ambassador.otp.code !== otp) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > ambassador.otp.expiresAt) {
      return res.status(401).json({
        success: false,
        message: "OTP expired",
      });
    }

    // ✅ Clear OTP after verification
    ambassador.otp = null;
    await ambassador.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. Login complete.",
      ambassador: {
        id: ambassador._id,
        fullName: ambassador.fullName,
        email: ambassador.email,
        mobileNumber: ambassador.mobileNumber,
        city: ambassador.city,
        area: ambassador.area,
        status: ambassador.status,
      },
    });
  } catch (error) {
    console.error("Verify ambassador OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
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

    // ✅ Step 2: Validate Commission Percentage (NEW)
    if (formData.commissionPercentage !== undefined) {
      const commission = parseFloat(formData.commissionPercentage);
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return res.status(400).json({
          success: false,
          message: "Commission percentage must be a number between 0 and 100.",
        });
      }
    }

    // ✅ Step 3: Handle profile image upload (if provided)
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

    // ✅ Step 4: Handle Aadhar Card upload (if provided)
    if (req.files && req.files.aadharCard) {
      console.log("📄 Aadhar Card found, uploading to Cloudinary...");

      const aadharCard = req.files.aadharCard;

      // Check if file is image or PDF
      if (aadharCard.mimetype.startsWith('image') || aadharCard.mimetype === 'application/pdf') {
        const result = await cloudinary.uploader.upload(aadharCard.tempFilePath, {
          folder: "veggyfy/ambassadors/documents/aadhar",
          resource_type: aadharCard.mimetype === 'application/pdf' ? 'raw' : 'image'
        });
        
        ambassador.aadharCard = result.secure_url;
        ambassador.kycStatus = "under_review"; // Set to under review when new document uploaded
        console.log("✅ Aadhar Card uploaded successfully");
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type for Aadhar Card. Only images and PDF are allowed.",
        });
      }
    }

    // ✅ Step 5: Handle PAN Card upload (if provided)
    if (req.files && req.files.panCard) {
      console.log("📄 PAN Card found, uploading to Cloudinary...");

      const panCard = req.files.panCard;

      // Check if file is image or PDF
      if (panCard.mimetype.startsWith('image') || panCard.mimetype === 'application/pdf') {
        const result = await cloudinary.uploader.upload(panCard.tempFilePath, {
          folder: "veggyfy/ambassadors/documents/pan",
          resource_type: panCard.mimetype === 'application/pdf' ? 'raw' : 'image'
        });
        
        ambassador.panCard = result.secure_url;
        ambassador.kycStatus = "under_review"; // Set to under review when new document uploaded
        console.log("✅ PAN Card uploaded successfully");
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type for PAN Card. Only images and PDF are allowed.",
        });
      }
    }

    // ✅ Step 6: Update all provided fields
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
      "commissionPercentage", // NEW: Added commission field
      "referralCode",
      "status",
      "kycStatus", // Allow updating KYC status
      "kycRejectionReason" // Allow updating rejection reason
    ];

    updatableFields.forEach((field) => {
      if (formData[field] !== undefined) {
        ambassador[field] = formData[field];
        console.log(`✅ Updated field: ${field} → ${formData[field]}`);
      }
    });

    // ✅ Step 7: Extra logic for status and KYC updates
    if (formData.status && formData.status.toLowerCase() === "active") {
      ambassador.kycStatus = "verified";
      ambassador.kycVerifiedAt = new Date();
      console.log("✅ Status is 'active', kycStatus set to 'verified'");
    }

    if (formData.kycStatus === "verified") {
      ambassador.kycVerifiedAt = new Date();
      console.log("✅ KYC verified, timestamp updated");
    }

    if (formData.kycStatus === "rejected" && formData.kycRejectionReason) {
      ambassador.kycRejectionReason = formData.kycRejectionReason;
      console.log("✅ KYC rejected with reason:", formData.kycRejectionReason);
    }

    // ✅ Step 8: Update profile image
    ambassador.profileImage = uploadedImageUrl;

    // ✅ Step 9: Save updated data
    await ambassador.save();
    console.log("💾 Ambassador saved successfully.");

    // ✅ Step 10: Prepare response data
    const responseData = {
      _id: ambassador._id,
      fullName: ambassador.fullName,
      email: ambassador.email,
      mobileNumber: ambassador.mobileNumber,
      commissionPercentage: ambassador.commissionPercentage, // NEW: Include in response
      status: ambassador.status,
      kycStatus: ambassador.kycStatus,
      referralCode: ambassador.referralCode,
      profileImage: ambassador.profileImage,
      updatedAt: ambassador.updatedAt
    };

    res.status(200).json({
      success: true,
      message: "Ambassador details updated successfully!",
      data: responseData,
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
    const { ambassadorId } = req.params; // fetch from URL

    // Step 1: Find the current ambassador
    const currentAmbassador = await Ambassador.findById(ambassadorId);

    if (!currentAmbassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found',
      });
    }

    // Step 2: Aggregate ambassadors with user count
    const ambassadors = await Ambassador.aggregate([
      {
        $addFields: {
          userCount: { $size: { $ifNull: ["$users", []] } } // count number of users
        }
      },
      {
        $sort: { userCount: -1 } // descending
      }
    ]);

    // Step 3: Find current ambassador's rank
    let currentRank = 0;
    for (let i = 0; i < ambassadors.length; i++) {
      if (ambassadors[i]._id.toString() === ambassadorId) {
        currentRank = i + 1; // 1-based rank
        break;
      }
    }

    if (currentRank === 0) currentRank = "Not Ranked";

    // Step 4: Return top 10 ambassadors + current rank
    return res.status(200).json({
      success: true,
      message: "Top 10 ambassadors fetched based on user count.",
      data: {
        topAmbassadors: ambassadors.slice(0, 10),
        currentAmbassadorRank: currentRank,
      },
    });

  } catch (error) {
    console.error("getTop10AmbassadorsByUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




// Request Withdrawal - Create a new withdrawal request with 2% fee
exports.requestAmbassadorWithdrawal = async (req, res) => {
  try {
    const { ambassadorId } = req.params;
    const { amount, accountDetails, upiId } = req.body;
    
    // Validate input
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid positive amount'
      });
    }

    const amountValue = parseFloat(amount);

    // Check minimum withdrawal
    if (amountValue < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹100'
      });
    }

    // Validate account details
    if (!accountDetails || !accountDetails.accountNumber || 
        !accountDetails.bankName || !accountDetails.accountHolderName || 
        !accountDetails.ifscCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete account details'
      });
    }

    // Step 1: Find the ambassador by ID
    const ambassador = await Ambassador.findById(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found.',
      });
    }

    // Step 2: Check if the ambassador has sufficient balance
    if (ambassador.wallet < amountValue) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in wallet.',
      });
    }

    // Calculate processing fee (2%)
    const processingFee = (amountValue * 2) / 100;
    const netAmount = amountValue - processingFee;

    // Step 3: Deduct amount from wallet immediately
    ambassador.wallet -= amountValue;
    await ambassador.save();

    // Step 4: Create a withdrawal request with detailed account information
    const withdrawalRequest = new AmbassadorWithdrawal({
      ambassadorId,
      amount: amountValue,
      processingFee: processingFee,
      netAmount: netAmount,
      status: 'pending',
      accountDetails,
      upiId,
      requestedAt: new Date()
    });
    
    await withdrawalRequest.save();

    // Step 5: Create wallet transaction record
    const transaction = new AmbassadorTransaction({
      ambassadorId,
      type: 'debit',
      amount: amountValue,
      description: `Withdrawal request #${withdrawalRequest._id.toString().slice(-8)}`,
      transactionType: 'withdrawal',
      balanceAfter: ambassador.wallet,
      status: 'pending',
      referenceId: withdrawalRequest._id
    });

    await transaction.save();

    // Step 6: Return the created withdrawal request
    return res.status(200).json({
      success: true,
      message: 'Withdrawal request created successfully. Awaiting approval.',
      data: {
        withdrawalRequest: {
          _id: withdrawalRequest._id,
          amount: withdrawalRequest.amount,
          processingFee: withdrawalRequest.processingFee,
          netAmount: withdrawalRequest.netAmount,
          status: withdrawalRequest.status,
          accountDetails: withdrawalRequest.accountDetails,
          requestedAt: withdrawalRequest.requestedAt
        },
        ambassador: {
          _id: ambassador._id,
          wallet: ambassador.wallet
        }
      },
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



// const razorpay = new Razorpay({
//  key_id: 'rzp_test_BxtRNvflG06PTV',
//  key_secret: 'RecEtdcenmR7Lm4AIEwo4KFr',
// });

const razorpay = new Razorpay({
 key_id: 'rzp_live_RppTI8LWcKMPyz',
 key_secret: 'K4LC6Csyw5CAYNF1fibZiLsB',
});


// assuming you already updated AmbassadorPayment schema to include baseAmount, gstAmount, totalAmount

exports.capturePayment = async (req, res) => {
  try {
    console.log("🔔 [Ambassador Payment Capture]");

    const { ambassadorId } = req.params;
    const {
      planId,
      transactionId,
      paymentMethod = "razorpay",
      bankDetails,
      discount = 0
    } = req.body;

    // 1️⃣ Basic validation
    if (!ambassadorId || !planId) {
      return res.status(400).json({
        success: false,
        message: "ambassadorId and planId are required",
      });
    }

    // 2️⃣ Fetch ambassador
    const ambassador = await Ambassador.findById(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: "Ambassador not found",
      });
    }

    // 3️⃣ Check active plan
    const now = new Date();
    const activePlan = ambassador.purchasedPlans.find(
      (p) => p.isActive && new Date(p.expiryDate) > now
    );

    if (activePlan) {
      return res.status(400).json({
        success: false,
        message: "You already have an active plan",
      });
    }

    // 4️⃣ Fetch plan
    const plan = await AmbassadorPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // 5️⃣ Price calculation
    const baseAmount = plan.price;
    const discountAmount = discount ? (baseAmount * discount) / 100 : 0;
    const discountedPrice = baseAmount - discountAmount;
    const gstAmount = (discountedPrice * 18) / 100;
    const totalAmount = discountedPrice + gstAmount;

    const purchaseDate = new Date();
    const expiryDate = new Date(
      purchaseDate.getTime() + plan.validity * 365 * 24 * 60 * 60 * 1000
    );

    /* ===========================
       🏦 BANK TRANSFER FLOW
    ============================ */
    if (paymentMethod === "bank_transfer" || paymentMethod === "bank") {
      if (!bankDetails) {
        return res.status(400).json({
          success: false,
          message: "Bank details are required for bank transfer",
        });
      }

const bankTransactionId = `BANK_${Date.now()}_${ambassador.fullName.replace(/\s+/g, "_")}`;

      const payment = new AmbassadorPayment({
        ambassadorId,
        planId,
        transactionId: bankTransactionId,
        paymentMethod: "bank_transfer",
        isPurchased: true,
        isActive: false,
        planPurchaseDate: purchaseDate,
        expiryDate,
        baseAmount,
        discount,
        discountAmount,
        discountedPrice,
        gstAmount,
        totalAmount,
        paymentStatus: "pending_verification",
        status: "pending",                     // ✅ new field
        bankDetails,
        submittedAt: purchaseDate,
        verifiedAt: null,
        verifiedBy: null,
      });

      await payment.save();

      ambassador.purchasedPlans.push({
        planId,
        purchaseDate,
        expiryDate,
        transactionId: bankTransactionId,
        baseAmount,
        discount,
        discountAmount,
        discountedPrice,
        gstAmount,
        totalAmount,
        isActive: false,
        isPurchased: true,
        paymentStatus: "pending_verification",
         status: "pending",                     // ✅ new field
        planName: plan.name,
        planValidity: plan.validity,
        planBenefits: plan.benefits,
        bankDetails,
      });

      ambassador.isPlanActive = false;
      await ambassador.save();

      return res.status(200).json({
        success: true,
        message: "Bank payment submitted. Plan will activate after verification.",
        data: {
          paymentId: payment._id,
          status: "pending_verification",
        },
      });
    }

    /* ===========================
       💳 RAZORPAY FLOW
    ============================ */
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "transactionId is required for Razorpay",
      });
    }

    const paymentDetails = await razorpay.payments.fetch(transactionId);

    if (paymentDetails.captured) {
      return res.status(400).json({
        success: false,
        message: "Payment already captured",
      });
    }

    const capturedPayment = await razorpay.payments.capture(
      transactionId,
      totalAmount * 100,
      "INR"
    );

    // Save payment
    const payment = new AmbassadorPayment({
      ambassadorId,
      planId,
      transactionId,
      razorpayPaymentId: capturedPayment.id,
      paymentMethod: paymentDetails.method || "razorpay",
      isPurchased: true,
      isActive: true,
      planPurchaseDate: purchaseDate,
      expiryDate,
      baseAmount,
      discount,
      discountAmount,
      discountedPrice,
      gstAmount,
      totalAmount,
      paymentStatus: "completed",
       status: "completed",                     // ✅ new field
      verifiedAt: purchaseDate,
      verifiedBy: "system",
    });

    await payment.save();

    ambassador.purchasedPlans.push({
      planId,
      purchaseDate,
      expiryDate,
      transactionId,
      razorpayPaymentId: capturedPayment.id,
      baseAmount,
      discount,
      discountAmount,
      discountedPrice,
      gstAmount,
      totalAmount,
      isActive: true,
      isPurchased: true,
      paymentStatus: "completed",
      planName: plan.name,
      planValidity: plan.validity,
      planBenefits: plan.benefits,
    });

    ambassador.isPlanActive = true;
    ambassador.currentPlanId = planId;
    ambassador.currentPlanExpiry = expiryDate;
    ambassador.lastPaymentDate = purchaseDate;

    await ambassador.save();

    return res.status(200).json({
      success: true,
      message: "Payment captured successfully, plan activated",
    });

  } catch (err) {
    console.error("❌ Ambassador payment error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


exports.updateAmbassadorPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) return res.status(400).json({ success: false, message: "Payment id is required" });
    if (!status) return res.status(400).json({ success: false, message: "Status is required" });

    const payment = await AmbassadorPayment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    payment.status = status;

    // ✅ Admin verification logic
    let emailToSend = false;
    if (status === "completed" || status === "verified") {
      payment.verifiedAt = new Date();
      payment.verifiedBy = "admin";
      payment.isActive = true;
      payment.paymentStatus = "completed";
      emailToSend = true;
    }

    await payment.save();

    // Update ambassador plan if needed
    const ambassador = await Ambassador.findById(payment.ambassadorId);
    if (ambassador) {
      const planIndex = ambassador.purchasedPlans.findIndex(p => p._id.toString() === id);
      if (planIndex !== -1) {
        ambassador.purchasedPlans[planIndex].status = status;
        ambassador.purchasedPlans[planIndex].isActive = status === "completed" || status === "verified";
        ambassador.purchasedPlans[planIndex].paymentStatus = status === "completed" ? "completed" : ambassador.purchasedPlans[planIndex].paymentStatus;
        ambassador.isPlanActive = ambassador.purchasedPlans[planIndex].isActive;
      }
      await ambassador.save();
    }

    // ✅ Send Email to Ambassador if payment verified
    if (emailToSend && ambassador?.email) {
      const subject = `Ambassador Payment Status Update - ${status.toUpperCase()}`;
      const html = `
      <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; padding:25px; border-radius:8px;">
          <h2 style="color:#2e7d32; text-align:center;">🎉 Hello ${ambassador.fullName}!</h2>
          <p style="font-size:15px; color:#333;">
            Your payment for plan <strong>${payment.planId?.name || ""}</strong> has been <strong>verified</strong>.
          </p>
          <p style="font-size:15px; color:#333;">
            ✅ Your plan is now <strong>ACTIVE</strong> and you can access all benefits.
          </p>
          <div style="background:#f1f8e9; padding:15px; border-radius:6px; margin:20px 0;">
            <p style="margin:0; font-size:14px;"><strong>Plan Status:</strong> Active</p>
            <p style="margin:6px 0 0; font-size:14px;"><strong>Access:</strong> Ambassador Dashboard Enabled</p>
          </div>
          <p style="font-size:14px; color:#555;">If you need assistance, contact our support team.</p>
          <p style="margin-top:30px; font-size:14px; color:#333;">Regards,<br/><strong>Team</strong></p>
        </div>
      </div>
      `;
      await sendEmail(ambassador.email, subject, html);
    }

    return res.status(200).json({ success: true, message: "Payment status updated and email sent if verified", data: payment });

  } catch (err) {
    console.error("❌ Error updating ambassador payment status:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


exports.deleteAmbassadorPayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Payment id is required" });

    const payment = await AmbassadorPayment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    const ambassador = await Ambassador.findById(payment.ambassadorId);

    await AmbassadorPayment.findByIdAndDelete(id);

    if (ambassador) {
      ambassador.purchasedPlans = ambassador.purchasedPlans.filter(p => p._id.toString() !== id);
      ambassador.isPlanActive = ambassador.purchasedPlans.some(p => p.isActive);
      await ambassador.save();
    }

    return res.status(200).json({ success: true, message: "Ambassador payment deleted successfully", data: payment });
  } catch (err) {
    console.error("❌ Error deleting ambassador payment:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


exports.getMyPlans = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    if (!ambassadorId) {
      return res.status(400).json({
        success: false,
        message: "Ambassador ID is required",
      });
    }

    // ✅ Sirf completed payments lao
    const payments = await AmbassadorPayment.find({
      ambassadorId,
      paymentStatus: "completed",
    }).populate("planId");

    if (!payments || payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active/completed plans found for this ambassador",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ambassador completed plans fetched successfully",
      data: payments,
    });

  } catch (err) {
    console.error("❌ Error fetching ambassador plans:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
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



exports.createAccount = async (req, res) => {
  try {
    const { ambassadorId, ...accountData } = req.body;

    // Validate ambassador exists
    const ambassador = await Ambassador.findById(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador not found'
      });
    }

    // Create new account
    const account = new AmbassadorAccount({
      ambassadorId,
      ...accountData
    });

    await account.save();

    res.status(201).json({
      success: true,
      message: 'Account added successfully',
      data: account
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAllAccounts = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    const accounts = await AmbassadorAccount.find({ ambassadorId })
      .sort({ isPrimary: -1, createdAt: -1 });

    res.json({
      success: true,
      message: 'Accounts fetched successfully',
      data: accounts
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const updateData = req.body;

    const account = await AmbassadorAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Update account
    Object.assign(account, updateData);
    await account.save();

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: account
    });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await AmbassadorAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Check if it's the primary account
    if (account.isPrimary) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete primary account. Please set another account as primary first.'
      });
    }

    await account.deleteOne();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const ambassador = await Ambassador.findOne({
      email: email.toLowerCase(),
    });

    if (!ambassador) {
      return res.status(400).json({
        success: false,
        message: "Account not found with this email",
      });
    }

    // 🔐 Generate 4-digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 💾 Save OTP
    ambassador.resetOTP = otpCode;
    ambassador.resetOTPExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await ambassador.save();

    // 📧 Email HTML
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>VEGIFFY Password Reset OTP</h2>
        <p>Your password reset OTP is:</p>
        <h1 style="letter-spacing:5px;">${otpCode}</h1>
        <p>This OTP is valid for 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    // 📤 Send email using existing helper
    const emailSent = await sendEmail(
      ambassador.email,
      "VEGIFFY - Password Reset OTP",
      html
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email",
      email: ambassador.email,
      otp: otpCode, // ⚠️ testing only, production me hata dena
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const admin = await Ambassador.findOne({
      email,
      resetOTP: otp,
      resetOTPExpires: { $gt: Date.now() }
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Direct password save (no hash)
    admin.password = newPassword;
    admin.resetOTP = undefined;
    admin.resetOTPExpires = undefined;

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
