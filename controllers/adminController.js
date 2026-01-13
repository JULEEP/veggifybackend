const bcrypt = require('bcrypt');
const Admin = require('../models/adminModel');
const mongoose = require('mongoose');
const Coupon = require('../models/couponModel');
const User = require('../models/userModel');
const { generateTempToken, verifyTempToken, generateAuthToken, generateCouponToken, couponAuthMiddleware } = require('../utils/adminJWT');
const restaurantModel = require('../models/restaurantModel');
const userModel = require('../models/userModel');
const {deliveryBoyModel} = require('../models/deliveryBoyModel');
const orderModel = require('../models/orderModel');
const restaurantProductModel = require('../models/restaurantProductModel');
const Banner = require('../models/banner');
const { Category } = require('../models/foodSystemModel');
const Staff = require('../models/Staff');
const cloudinary = require("../config/cloudinary");
const Amount = require('../models/Amount');
const AmbassadorPlan = require('../models/AmbassadorPlan');
const AmbassadorPayment = require('../models/AmbassadorPayment');
const Ambassador = require('../models/ambassadorModel');
const VendorPlan = require('../models/VendorPlan');
const Commission = require('../models/Commission');
const Charge = require('../models/Charge');


const nodemailer = require("nodemailer");


const dotenv = require("dotenv");
const ReferralReward = require('../models/ReferralReward');
const Credential = require('../models/Credential');

dotenv.config();




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



// 1. Send OTP (hardcoded for now as 1234)
exports.sendOtp = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber)
            return res.status(400).json({ message: 'Phone number required' });

        let admin = await Admin.findOne({ phoneNumber });
        if (!admin) {
            admin = new Admin({ phoneNumber }); // no password at registration time
        }

        const otp = '1234'; // hardcoded for now
        admin.otp = otp;
        admin.isOtpVerified = false;
        await admin.save();

        const token = generateTempToken({ phoneNumber, otp });
        return res.status(200).json({ message: 'OTP sent successfully', otp, token });
    } catch (err) {
        console.error('Send OTP Error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// 2. Verify OTP
// exports.verifyOtp = async (req, res) => {
//     try {
//         const { otp, token } = req.body;
//         if (!otp || !token)
//             return res.status(400).json({ message: 'OTP and token are required' });

//         const decoded = verifyTempToken(token);
//         if (!decoded) return res.status(400).json({ message: 'OTP expired or invalid token' });
//         if (otp !== decoded.otp) return res.status(400).json({ message: 'Invalid OTP' });

//         const admin = await Admin.findOne({ phoneNumber: decoded.phoneNumber });
//         if (!admin) return res.status(404).json({ message: 'Admin not found' });

//         admin.isOtpVerified = true;
//         await admin.save();

//         return res.status(200).json({ message: 'OTP verified successfully' });
//     } catch (err) {
//         console.error('Verify OTP Error:', err);
//         return res.status(500).json({ message: 'Server error', error: err.message });
//     }
// };

// 3. Set Password (first time or reset password)
exports.setPassword = async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;
        if (!phoneNumber || !password)
            return res.status(400).json({ message: 'Phone number and password required' });

        const admin = await Admin.findOne({ phoneNumber });
        if (!admin || !admin.isOtpVerified)
            return res.status(400).json({ message: 'OTP not verified or admin not found' });

        const hashedPassword = await bcrypt.hash(password, 10);
        admin.password = hashedPassword;
        admin.isOtpVerified = false; // reset flag
        admin.otp = null;
        await admin.save();

        return res.status(200).json({ message: 'Password set successfully' });
    } catch (err) {
        console.error('Set Password Error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};




exports.register = async (req, res) => {
    try {
        const { name, email, phoneNumber, password } = req.body;

        // Validate the required fields
        if (!name || !email || !phoneNumber || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if the admin already exists (either by email or phoneNumber)
        const existingAdminByEmail = await Admin.findOne({ email });
        if (existingAdminByEmail) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        const existingAdminByPhone = await Admin.findOne({ phoneNumber });
        if (existingAdminByPhone) {
            return res.status(400).json({ message: 'Admin with this phone number already exists' });
        }

        // Create the new admin (no password hashing)
        const newAdmin = new Admin({
            name,
            email,
            phoneNumber,
            password, // Save the password as it is (plain text)
        });

        // Save the admin in the database
        await newAdmin.save();

        // Generate an authentication token for the new admin
        const token = generateAuthToken({
            id: newAdmin._id,
            phoneNumber: newAdmin.phoneNumber,
        });

        // Send the response
        return res.status(201).json({
            message: 'Registration successful',
            token,
            adminId: newAdmin._id,
        });

    } catch (err) {
        console.error('Registration Error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not registered" });
    }

    if (admin.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    admin.otp = otp;
    admin.otpExpiry = otpExpiry;
    await admin.save();

    const subject = "🔒 Your Login OTP — MyApp";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
        <h2 style="color: #1e88e5;">Your One-Time Password (OTP)</h2>
        <p>Hello,</p>
        <p>You requested to login. Use the OTP given below to complete your login:</p>
        <p style="font-size: 28px; font-weight: bold; margin: 20px 0; letter-spacing: 4px;">${otp}</p>
        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
        <hr style="margin: 30px 0;" />
        <p>If you did not request this, please ignore this email or contact our support.</p>
        <p style="margin-top: 20px;">Need help? Contact us at <a href="mailto:support@myapp.com">support@myapp.com</a></p>
      </div>
    `;

    const emailSent = await sendEmail(admin.email, subject, html);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: "Failed to send OTP email" });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      adminId: admin._id,     // ✅ Admin ID included
      email: admin.email,
      otpSent: true,
      otp // (Remove in production)
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// 5. Verify OTP
exports.verifyOtp = async (req, res) => {
    try {
        const { adminId, otp } = req.body;

        if (!adminId || !otp) {
            return res.status(400).json({ message: 'Admin ID and OTP are required' });
        }

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Check if OTP exists and is not expired
        if (!admin.otp || !admin.otpExpiry) {
            return res.status(400).json({ message: 'OTP not requested or expired' });
        }

        if (admin.otpExpiry < new Date()) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        if (admin.otp !== otp) {
            return res.status(401).json({ message: 'Invalid OTP' });
        }

        // Clear OTP after successful verification
        admin.otp = undefined;
        admin.otpExpiry = undefined;
        await admin.save();

        // Generate final authentication token
        const token = generateAuthToken({
            id: admin._id,
            email: admin.email,
        });

        return res.status(200).json({
            message: 'OTP verified successfully',
            token,
            adminId: admin._id,
            name: admin.name,
            email: admin.email
        });
    } catch (err) {
        console.error('OTP Verification Error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};


// 1. Get Profile (by adminId)
exports.getProfile = async (req, res) => {
    try {
        const { adminId } = req.params; // Get adminId from request params

        // Find the admin by adminId
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Return the profile data
        return res.status(200).json({
            message: 'Profile fetched successfully',
            adminId: admin._id,
            name: admin.name,
            email: admin.email,
            phoneNumber: admin.phoneNumber,
            password: admin.password
        });

    } catch (err) {
        console.error('Get Profile Error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// 2. Update Profile (by adminId)
exports.updateProfile = async (req, res) => {
    try {
        const { adminId } = req.params; // Get adminId from request params
        const { name, email, phoneNumber, password } = req.body; // Get the fields to update

        // Find the admin by adminId
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Update the admin details
        if (name) admin.name = name;
        if (email) admin.email = email;
        if (phoneNumber) admin.phoneNumber = phoneNumber;
        if (password) admin.password = password; // You may want to hash the password if updating it (optional)

        // Save the updated admin profile
        await admin.save();

        // Generate a new authentication token (optional)
        const token = generateAuthToken({
            id: admin._id,
            phoneNumber: admin.phoneNumber,
        });

        // Send the response
        return res.status(200).json({
            message: 'Profile updated successfully',
            token,
            adminId: admin._id,
            name: admin.name,
            email: admin.email,
            phoneNumber: admin.phoneNumber,
        });

    } catch (err) {
        console.error('Update Profile Error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// 5. Get Admin Details by Admin ID
exports.getAdminByAdminId = async (req, res) => {
    try {
        const { adminId } = req.params;  // Get adminId from URL params

        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        const admin = await Admin.findById(adminId);  // Use findById instead of findOne for _id

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // If name is missing, use 'Not Provided' as the fallback
        const adminName = admin.name || 'Not Provided';

        return res.status(200).json({
            message: 'Admin fetched successfully',
            admin: {
                id: admin._id,
                phoneNumber: admin.phoneNumber,
                name: adminName,  // Fallback to 'Not Provided' if name is empty
                email: admin.email,
                createdAt: admin.createdAt,
            },
        });
    } catch (err) {
        console.error('Error fetching admin details:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};


// Generate coupon token (POST /api/admin/token)
exports.getCouponToken = async (req, res) => {
    try {
        const token = generateCouponToken();
        return res.status(200).json({
            success: true,
            message: "Coupon token generated successfully",
            token
        });
    } catch (err) {
        console.error("Get Coupon Token Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// CREATE coupon (POST /api/admin/coupons)
exports.createCoupon = async (req, res) => {
    try {
        if (!req.coupon || req.coupon.role !== 'coupon') {
            return res.status(403).json({ success: false, message: "Unauthorized. Valid coupon token required." });
        }

        const { code, discountPercentage, maxDiscountAmount, minCartAmount, expiresAt } = req.body;

        if (!code || !discountPercentage) {
            return res.status(400).json({ success: false, message: "Code and discountPercentage are required." });
        }

        const existing = await Coupon.findOne({ code });
        if (existing) return res.status(400).json({ success: false, message: "Coupon code already exists." });

        const coupon = new Coupon({
            code,
            discountPercentage,
            maxDiscountAmount,
            minCartAmount,
            expiresAt,
            
        });
        await coupon.save();

        return res.status(201).json({ success: true, message: "Coupon created successfully.", coupon });

    } catch (err) {
        console.error("Create Coupon Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// ---------------------- GET ALL COUPONS ----------------------
exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        return res.status(200).json({ success: true, coupons });
    } catch (err) {
        console.error("Get All Coupons Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};


// ---------------------- GET SINGLE COUPON ----------------------
exports.getCouponById = async (req, res) => {
     try {
        const { couponId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(couponId))
            return res.status(400).json({ success: false, message: "Invalid Coupon ID." });

        const coupon = await Coupon.findById(couponId);
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found." });

        return res.status(200).json({ success: true, coupon });
    } catch (err) {
        console.error("Get Coupon By ID Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// ---------------------- UPDATE COUPON ----------------------
exports.updateCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(couponId))
            return res.status(400).json({ success: false, message: "Invalid Coupon ID." });

        const coupon = await Coupon.findByIdAndUpdate(couponId, updateData, { new: true });
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found." });

        return res.status(200).json({ success: true, message: "Coupon updated successfully.", coupon });
    } catch (err) {
        console.error("Update Coupon Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};
// ---------------------- DELETE COUPON ----------------------
exports.deleteCoupon = async (req, res) => {
   try {
        const { couponId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(couponId))
            return res.status(400).json({ success: false, message: "Invalid Coupon ID." });

        const coupon = await Coupon.findByIdAndDelete(couponId);
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found." });

        return res.status(200).json({ success: true, message: "Coupon deleted successfully." });
    } catch (err) {
        console.error("Delete Coupon Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// ---------------------- TOGGLE COUPON STATUS ----------------------
exports.toggleCouponStatus = async (req, res) => {
    try {
        const { couponId } = req.params;

        // Validate coupon ID
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(400).json({ success: false, message: "Invalid Coupon ID." });
        }

        // Find coupon
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found." });
        }

        // Toggle isActive
        coupon.isActive = !coupon.isActive;
        await coupon.save();

        return res.status(200).json({
            success: true,
            message: `Coupon is now ${coupon.isActive ? "active" : "inactive"}.`,
            coupon
        });
    } catch (err) {
        console.error("Toggle Coupon Status Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};



exports.getAllUsers = async (req, res) => {
  try {
    // Optional: pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Optional: add filters from query params here if needed
    const filters = {}; // For example, { isVerified: true }

    const totalUsers = await User.countDocuments(filters);
    const users = await User.find(filters)
      .skip(skip)
      .limit(limit)
      .select('-password -otp')  // exclude sensitive fields
      .lean();

    res.json({
      success: true,
      total: totalUsers,
      page,
      limit,
      users,
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};



exports.getDashboardData = async (req, res) => {
  try {
    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // All database queries in parallel - CORRECTED MODEL NAMES
    const [
      totalUsers,
      totalRestaurants,
      activeRestaurants,
      totalRiders,
      activeRiders,
      totalOrders,
      todayOrders,
      totalProducts,
      totalBannersCount, // Changed variable name to indicate it's a count
      totalCategoriesCount, // Changed variable name to indicate it's a count
      todayRevenue,
      totalRevenue,
      orderStatusStats,
      weeklySales,
      monthlySales,
      latestOrders
    ] = await Promise.all([
      // Users count
      userModel.countDocuments(),
      
      // Restaurants count
      restaurantModel.countDocuments(),
      restaurantModel.countDocuments({ status: 'active' }),
      
      // Orders count
      orderModel.countDocuments(),
      orderModel.countDocuments({ createdAt: { $gte: today } }),
      
      // Products count
      restaurantProductModel.countDocuments(),
      
      // Banners count (only count)
      Banner.countDocuments(),
      
      // Categories count (only count)
      Category.countDocuments(),
      
      // Today's revenue
      orderModel.aggregate([
        { 
          $match: { 
            status: 'completed',
            createdAt: { $gte: today } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$totalAmount' } 
          } 
        }
      ]),
      
      // Total revenue
      orderModel.aggregate([
        { 
          $match: { 
            status: 'completed'
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$totalAmount' } 
          } 
        }
      ]),
      
      // Order status counts
      orderModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Weekly sales data
      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfWeek },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            sales: { $sum: '$totalAmount' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]),
      
      // Monthly sales data
      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfMonth },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            sales: { $sum: '$totalAmount' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]),
      
      // Latest 10 orders
      orderModel.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderId totalAmount status createdAt user restaurant')
    ]);

    // Process the data
    const todayRevenueAmount = todayRevenue.length > 0 ? todayRevenue[0].total : 0;
    const totalRevenueAmount = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Format order status data
    const orderStatusData = orderStatusStats.map(item => ({
      name: item._id,
      value: item.count
    }));

    // Format sales data for charts - FIXED: Use actual data
    const salesData = {
      today: [{ name: "Today", sales: todayRevenueAmount }],
      thisWeek: formatChartData(weeklySales, "This Week"),
      thisMonth: formatChartData(monthlySales, "This Month")
    };

    // Send response
    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalRestaurants,
          activeRestaurants,
          totalRiders,
          activeRiders,
          totalOrders,
          todayOrders,
          totalProducts,
          totalBannersCount, // Displaying banner count
          totalCategoriesCount, // Displaying category count
          totalIncome: totalRevenueAmount,
          todayIncome: todayRevenueAmount
        },
        charts: {
          salesData,
          orderStatusData
        },
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to format chart data - FIXED: Use actual data
function formatChartData(data, timeframe) {
  if (!data || data.length === 0) {
    // Return default data if no data found
    if (timeframe === "This Week") {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days.map(day => ({
        name: day,
        sales: 0
      }));
    }
    
    if (timeframe === "This Month") {
      return [
        { name: "Week 1", sales: 0 },
        { name: "Week 2", sales: 0 },
        { name: "Week 3", sales: 0 },
        { name: "Week 4", sales: 0 }
      ];
    }
  }

  // Use actual data from database
  return data.map(item => ({
    name: item._id,
    sales: item.sales
  }));
}

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffInMinutes = Math.floor((now - new Date(date)) / (1000 * 60));
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  } else if (diffInMinutes < 1440) {
    return `${Math.floor(diffInMinutes / 60)} hours ago`;
  } else {
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  }
}



exports.registerStaff = async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      mobileNumber, 
      role, 
      gender, 
      age, 
      department,
      employeeId,
      joiningDate,
      address,
      salary,
      emergencyContact,
      pagesAccess 
    } = req.body;

    // ✅ express-fileupload → files are directly inside req.files
    const aadharCardFront = req.files?.aadharCardFront;
    const aadharCardBack = req.files?.aadharCardBack;
    const photo = req.files?.photo;

    // Validate required documents
    if (!aadharCardFront || !photo) {
      return res.status(400).json({
        success: false,
        message: "Aadhar Card Front and Photo are required",
      });
    }

    // ✅ Check if staff already exists by email or phone
    const existingStaff = await Staff.findOne({
      $or: [
        { email: email.toLowerCase() }, 
        { phone: mobileNumber }
      ],
    });

    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: existingStaff.email === email.toLowerCase() 
          ? "Email already registered" 
          : "Phone number already registered",
      });
    }

    // ✅ Upload Aadhar Card Front to Cloudinary
    const aadharFrontUpload = await cloudinary.uploader.upload(aadharCardFront.tempFilePath, {
      folder: "staff/aadhar/front",
      resource_type: "auto"
    });

    // ✅ Upload Photo to Cloudinary
    const photoUpload = await cloudinary.uploader.upload(photo.tempFilePath, {
      folder: "staff/photo",
      resource_type: "image"
    });

    // ✅ Upload Aadhar Card Back to Cloudinary (if provided)
    let aadharBackUpload = null;
    if (aadharCardBack) {
      aadharBackUpload = await cloudinary.uploader.upload(aadharCardBack.tempFilePath, {
        folder: "staff/aadhar/back",
        resource_type: "auto"
      });
    }

    // ✅ Parse pagesAccess if it's JSON string
    let parsedPagesAccess = [];
    if (pagesAccess) {
      try {
        parsedPagesAccess = typeof pagesAccess === "string" 
          ? JSON.parse(pagesAccess) 
          : pagesAccess;
      } catch (parseError) {
        console.error("Error parsing pagesAccess:", parseError);
        parsedPagesAccess = [];
      }
    }

    // ✅ Create staff data
    const staffData = {
      fullName,
      email: email.toLowerCase(),
      phone: mobileNumber,
      role,
      gender,
      age: age || null,
      department: department || null,
      employeeId: employeeId || null,
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      address: address || null,
      salary: salary || null,
      emergencyContact: emergencyContact || null,
      aadharCardFront: aadharFrontUpload.secure_url,
      aadharCardBack: aadharBackUpload ? aadharBackUpload.secure_url : null,
      photo: photoUpload.secure_url,
      pagesAccess: parsedPagesAccess,
      status: "pending",
      isActive: true
    };

    const newStaff = new Staff(staffData);
    await newStaff.save();

    res.status(201).json({
      success: true,
      message: "Staff registered successfully!",
      staff: {
        id: newStaff._id,
        fullName: newStaff.fullName,
        email: newStaff.email,
        phone: newStaff.phone,
        role: newStaff.role,
        status: newStaff.status
      },
    });
  } catch (error) {
    console.error("Staff Registration Error:", error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message = field === 'email' 
        ? 'Email already exists' 
        : field === 'phone' 
          ? 'Phone number already exists'
          : 'Employee ID already exists';
      
      return res.status(400).json({ 
        success: false, 
        message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server Error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};

exports.addSalaryToStaff = async (req, res) => {
  try {
    const { staffId } = req.params; // Get staffId from URL params
    const { amount, month, status } = req.body; // Get salary data from request body

    // Find the staff member by ID
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        message: "Staff member not found"
      });
    }

    // Create the new salary entry with a date field
    const newSalary = {
      amount,
      month,
      status,
      date: new Date() // Set the current date
    };

    // Add the new salary entry to the mySalary[] array
    staff.mySalary.push(newSalary);

    // Save the updated staff document
    await staff.save();

    return res.status(200).json({
      message: "Salary added successfully",
      staff: staff
    });
  } catch (error) {
    console.error("Error adding salary:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


// Get all Staff
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find().select('-__v'); // Exclude version key
    res.status(200).json({
      message: "Staff fetched successfully.",
      data: staff,
    });
  } catch (error) {
    console.error("Error fetching staff:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get staff by ID
exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findById(id);
    
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    res.status(200).json({
      message: "Staff fetched successfully",
      data: staff,
    });
  } catch (error) {
    console.error("Error fetching staff by ID:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Update staff
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      email,
      mobileNumber,
      role,
      gender,
      age,
      pagesAccess,
      status, // ✅ status included in destructuring
    } = req.body;

    // ✅ Check if staff exists
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    // ✅ Prepare update data - INCLUDING STATUS
    let updateData = {
      fullName,
      email,
      phone: mobileNumber,
      role,
      gender,
      age,
      status, // ✅ ADD THIS LINE - Status included in update data
    };

    // ✅ Parse pagesAccess if provided
    if (pagesAccess) {
      try {
        updateData.pagesAccess =
          typeof pagesAccess === "string" ? JSON.parse(pagesAccess) : pagesAccess;
      } catch (parseError) {
        console.error("Error parsing pagesAccess:", parseError);
      }
    }

    // ✅ If new Aadhar card uploaded
    if (req.files?.aadharCard) {
      const aadharCard = req.files.aadharCard;
      const aadharUpload = await cloudinary.uploader.upload(aadharCard.tempFilePath, {
        folder: "staff/aadhar",
      });
      updateData.aadharCard = aadharUpload.secure_url;
    }

    // ✅ If new photo uploaded
    if (req.files?.photo) {
      const photo = req.files.photo;
      const photoUpload = await cloudinary.uploader.upload(photo.tempFilePath, {
        folder: "staff/photo",
      });
      updateData.photo = photoUpload.secure_url;
    }

    // ✅ Update staff data
    const updatedStaff = await Staff.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      data: updatedStaff,
    });
  } catch (error) {
    console.error("Error updating staff:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};


// Update Staff
// exports.updateStaff = async (req, res) => {
//   try {
//     const { staffId } = req.params;
//     const { fullName, email, phone, role, gender, age, status } = req.body;

//     // Find staff by ID
//     const staff = await Staff.findById(staffId);
//     if (!staff) {
//       return res.status(404).json({ message: "Staff not found." });
//     }

//     // Update the fields if provided
//     if (fullName) staff.fullName = fullName;
//     if (email) staff.email = email;
//     if (phone) staff.phone = phone;
//     if (role) staff.role = role;
//     if (gender) staff.gender = gender;
//     if (age) staff.age = age;
//     if (status) staff.status = status; // Allow status update

//     // Update Aadhar Card & Photo if new files are uploaded
//     if (req.files) {
//       if (req.files.aadharCard) {
//         const aadharUpload = await cloudinary.uploader.upload(req.files.aadharCard[0].path);
//         staff.aadharCard = aadharUpload.secure_url;
//       }
//       if (req.files.photo) {
//         const photoUpload = await cloudinary.uploader.upload(req.files.photo[0].path);
//         staff.photo = photoUpload.secure_url;
//       }
//     }

//     // Save the updated staff member
//     await staff.save();

//     res.status(200).json({
//       message: "Staff updated successfully!",
//       staff: staff,
//     });

//   } catch (error) {
//     console.error("Error updating staff:", error);
//     res.status(500).json({ message: "Server Error", error: error.message });
//   }
// };

// Delete Staff
exports.deleteStaff = async (req, res) => {
  try {
    const { staffId } = req.params;

    // Find and delete staff
    const staff = await Staff.findByIdAndDelete(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found." });
    }

    res.status(200).json({
      message: "Staff deleted successfully.",
      staffId: staffId,
    });

  } catch (error) {
    console.error("Error deleting staff:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



// Staff Login Route
exports.staffLogin = async (req, res) => {
  try {
    const { phone } = req.body;

    const staff = await Staff.findOne({ phone });
    if (!staff) {
      return res.status(400).json({ message: "Staff not found" });
    }

    if (staff.status !== 'active') {
      return res.status(400).json({ message: "Staff account is not active" });
    }

    // ✅ Ensure pagesAccess is returned properly
    res.status(200).json({
      message: "Login successful",
      staff: {
        _id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        pagesAccess: staff.pagesAccess || [], // ✅ Important: include pagesAccess
        status: staff.status
      }
    });
  } catch (error) {
    console.error("Staff login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




// Staff Profile Route
exports.getStaffProfile = async (req, res) => {
  try {
    const { staffId } = req.params;

    // Find the staff by the provided staffId
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // Return staff profile information
    res.status(200).json({
      message: "Staff profile fetched successfully",
      staff: {
        _id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        gender: staff.gender,  // Added gender
        age: staff.age,        // Added age
        aadharCard: staff.aadharCard,  // Added Aadhar Card link
        photo: staff.photo,    // Added photo link
        pagesAccess: staff.pagesAccess || [], // Include pagesAccess if exists
        status: staff.status,
        mySalary: staff.mySalary || [], // Added salary information
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt
      }
    });
  } catch (error) {
    console.error("Staff profile fetch error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.createAmount = async (req, res) => {
  try {
    const { type, amount } = req.body;

    // Validation
    if (!type || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Type and amount are required'
      });
    }

    // Check if amount already exists for this type
    const existingAmount = await Amount.findOne({ type });
    if (existingAmount) {
      return res.status(400).json({
        success: false,
        message: 'Amount for this type already exists'
      });
    }

    // Create new amount
    const newAmount = new Amount({
      type,
      amount: parseFloat(amount)
    });

    const savedAmount = await newAmount.save();

    res.status(201).json({
      success: true,
      message: 'Amount created successfully',
      data: savedAmount
    });
  } catch (error) {
    console.error('Error creating amount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


exports.getAllAmounts = async (req, res) => {
  try {
    const amounts = await Amount.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: amounts.length,
      data: amounts
    });
  } catch (error) {
    console.error('Error fetching amounts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


exports.getAmountById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount ID'
      });
    }

    const amount = await Amount.findById(id);

    if (!amount) {
      return res.status(404).json({
        success: false,
        message: 'Amount not found'
      });
    }

    res.status(200).json({
      success: true,
      data: amount
    });
  } catch (error) {
    console.error('Error fetching amount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


exports.updateAmount = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount } = req.body;

    // Validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount ID'
      });
    }

    // Check if amount exists
    const existingAmount = await Amount.findById(id);
    if (!existingAmount) {
      return res.status(404).json({
        success: false,
        message: 'Amount not found'
      });
    }

    // Check if type already exists for other amounts
    const duplicateAmount = await Amount.findOne({ 
      type, 
      _id: { $ne: id } 
    });
    
    if (duplicateAmount) {
      return res.status(400).json({
        success: false,
        message: 'Amount for this type already exists'
      });
    }

    // Update amount
    const updatedAmount = await Amount.findByIdAndUpdate(
      id,
      {
        type,
        amount: parseFloat(amount)
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Amount updated successfully',
      data: updatedAmount
    });
  } catch (error) {
    console.error('Error updating amount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


exports.deleteAmount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount ID'
      });
    }

    const amount = await Amount.findByIdAndDelete(id);

    if (!amount) {
      return res.status(404).json({
        success: false,
        message: 'Amount not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Amount deleted successfully',
      data: amount
    });
  } catch (error) {
    console.error('Error deleting amount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



exports.createPlan = async (req, res) => {
  try {
    const { name, price, discount = 0, validity, benefits } = req.body;

    const newPlan = new AmbassadorPlan({
      name,
      price,
      discount,
      validity,
      benefits
    });

    await newPlan.save();

    res.status(201).json({
      success: true,
      message: "Ambassador Plan created successfully",
      data: newPlan
    });
  } catch (err) {
    console.error("Error creating plan:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


// Get all plans
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await AmbassadorPlan.find();
    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    console.error("❌ Error fetching plans:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// Get a single plan by ID
exports.getPlanById = async (req, res) => {
  try {
    const plan = await AmbassadorPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    res.status(200).json({ success: true, data: plan });
  } catch (err) {
    console.error("❌ Error fetching plan:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update a plan
exports.updatePlan = async (req, res) => {
  try {
    const updatedPlan = await AmbassadorPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedPlan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    res.status(200).json({ success: true, message: "Plan updated", data: updatedPlan });
  } catch (err) {
    console.error("❌ Error updating plan:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete a plan
exports.deletePlan = async (req, res) => {
  try {
    const deletedPlan = await AmbassadorPlan.findByIdAndDelete(req.params.id);
    if (!deletedPlan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    res.status(200).json({ success: true, message: "Plan deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting plan:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getAllAmbassadorPaymnet = async (req, res) => {
  try {
    // Fetch all payments and populate both plan and ambassador details
    const payments = await AmbassadorPayment.find()
      .populate('planId')        // Populate plan details
      .populate('ambassadorId'); // Populate ambassador details

    if (!payments || payments.length === 0) {
      return res.status(404).json({ message: "No plans found" });
    }

    res.status(200).json({
      success: true,
      message: "All ambassador plans fetched successfully",
      data: payments,
    });

  } catch (err) {
    console.error('❌ Error fetching all ambassador plans:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};





// Controller to fetch all stats
// Controller to fetch all stats
exports.getDashboardStats = async (req, res) => {
  try {
    // Total Users
    const totalUsers = await userModel.countDocuments();

    // Total Restaurants (Vendors)
    const totalVendors = await restaurantModel.countDocuments();

    // Total Products
    const totalProducts = await restaurantProductModel.countDocuments();

    // Total Orders
    const totalOrders = await orderModel.countDocuments();

    // Active Users: Assuming we have an `isVerified` flag or similar
    const activeUsers = await userModel.countDocuments({ isVerified: true });

    // Total Revenue: Summing order totalPayable amounts (assuming each order has this field)
    const totalRevenue = await orderModel.aggregate([
      { $match: { orderStatus: 'Delivered' } },  // Filter for delivered orders
      { $group: { _id: null, totalRevenue: { $sum: '$totalPayable' } } }, // Sum totalPayable for revenue
    ]);

    // Get Counts and Revenue for each Order Status (Delivered, Pending, Cancelled)
    const orderStatusCountsAndRevenue = await orderModel.aggregate([
      {
        $group: {
          _id: "$orderStatus",   // Grouping by orderStatus
          count: { $sum: 1 },     // Count of orders by status
          totalSales: { $sum: '$totalPayable' } // Sum of totalPayable for each status
        }
      }
    ]);

    console.log("Order Status Aggregation Result:", orderStatusCountsAndRevenue); // Debug log

    // Initialize order stats with default values
    const orderStats = {
      delivered: { count: 0, sales: 0 },  // Changed from 'completed' to 'delivered'
      pending: { count: 0, sales: 0 },
      cancelled: { count: 0, sales: 0 }
    };

    // Loop through the aggregation result and assign counts and sales
    orderStatusCountsAndRevenue.forEach(status => {
      if (status._id === 'Delivered') {  // Changed from 'Completed' to 'Delivered'
        orderStats.delivered.count = status.count;
        orderStats.delivered.sales = status.totalSales;
      }
      if (status._id === 'Pending') {
        orderStats.pending.count = status.count;
        orderStats.pending.sales = status.totalSales;
      }
      if (status._id === 'Cancelled') {
        orderStats.cancelled.count = status.count;
        orderStats.cancelled.sales = status.totalSales;
      }
    });

    // Sales Overview (simplified)
    const salesOverview = {
      deliveredOrders: orderStats.delivered.count,  // Changed from 'completedOrders'
      deliveredSales: orderStats.delivered.sales,   // Changed from 'completedSales'
      pendingOrders: orderStats.pending.count,
      pendingSales: orderStats.pending.sales,
      cancelledOrders: orderStats.cancelled.count,
      cancelledSales: orderStats.cancelled.sales,
      totalRevenue: totalRevenue[0]?.totalRevenue || 0
    };

    // Total Banners
    const totalBanners = await Banner.countDocuments();

    // Fetch Latest Orders (latest 5 orders)
    const latestOrders = await orderModel.aggregate([
      { $sort: { createdAt: -1 } }, // Sort by creation date (newest first)
      { $limit: 5 }, // Limit to the latest 5 orders
      
      // Lookup customer details
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true
        }
      },
      
      // Process products array to get first product's details
      {
        $addFields: {
          firstProduct: {
            $arrayElemAt: ["$products", 0] // Get first product from array
          }
        }
      },
      
      // Project the required fields
      {
        $project: {
          orderId: "$_id",
          customerName: {
            $concat: [
              { $ifNull: ["$customer.firstName", ""] },
              " ",
              { $ifNull: ["$customer.lastName", ""] }
            ]
          },
          productName: "$firstProduct.name", // Get product name from products array
          price: "$firstProduct.price", // Get price from products array
          quantity: "$firstProduct.quantity", // Get quantity if needed
          orderStatus: 1,
          totalPayable: 1,
          createdAt: 1,
          timeAgo: {
            $dateToString: {
              format: "%H:%M:%S",
              date: "$createdAt"
            }
          }
        }
      }
    ]);

    // Additional Metrics
    // 1. Orders Today
    const ordersToday = await orderModel.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    // 2. Revenue Today (Delivered orders only)
    const revenueToday = await orderModel.aggregate([
      { $match: { orderStatus: 'Delivered', createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPayable' } } }
    ]);

    // 3. Success Rate (Delivered Orders / Total Orders)
    const successRate = totalOrders > 0 ? (orderStats.delivered.count / totalOrders) * 100 : 0;  // Changed from 'completed' to 'delivered'

    // 4. Pending Actions (Pending Orders + Cancelled Orders)
    const pendingActions = orderStats.pending.count + orderStats.cancelled.count;

    // Constructing the response
    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalVendors,
        totalProducts,
        totalOrders,
        activeUsers,
        totalRevenue: totalRevenue[0]?.totalRevenue || 0, // Default to 0 if no revenue found
        totalBanners,
        orderStats,  // Separate order stats (delivered, pending, cancelled)
        salesOverview, // Separate sales overview (order count and sales)
        latestOrders, // Latest 5 orders with details
        ordersToday, // Orders Today
        revenueToday: revenueToday[0]?.totalRevenue || 0, // Revenue Today
        successRate: parseFloat(successRate.toFixed(2)), // Success Rate (Percentage) formatted to 2 decimal places
        pendingActions // Pending Actions (Pending + Cancelled)
      },
    });
  } catch (err) {
    console.error('❌ Error fetching stats:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};


exports.getReferredStats = async (req, res) => {
  try {
    // Get the count of referred users (users who have 'referredBy' field)
    const referredUsersCount = await userModel.countDocuments({ referredBy: { $ne: null } });

    // Get the count of referred restaurants (restaurants who have 'referredBy' field)
    const referredRestaurantsCount = await restaurantModel.countDocuments({ referredBy: { $ne: null } });

    // Get the count of referred ambassadors (ambassadors who have 'referredBy' field)
    const referredAmbassadorsCount = await Ambassador.countDocuments({ referredBy: { $ne: null } });

    // Respond with the counts of referred users, restaurants, and ambassadors
    res.status(200).json({
      success: true,
      data: {
        referredUsersCount,       // Total referred users
        referredRestaurantsCount, // Total referred restaurants
        referredAmbassadorsCount, // Total referred ambassadors
      },
    });
  } catch (err) {
    console.error('❌ Error fetching referred stats:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};



// Create a new vendor plan
exports.createVendorPlan = async (req, res) => {
  try {
    const { name, price, validity, benefits } = req.body;

    const newPlan = new VendorPlan({
      name,
      price,
      validity,
      benefits,
    });

    await newPlan.save();

    res.status(201).json({
      success: true,
      message: "Vendor Plan created successfully",
      data: newPlan,
    });
  } catch (err) {
    console.error("❌ Error creating vendor plan:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// Get all vendor plans
exports.getAllVendorPlans = async (req, res) => {
  try {
    const plans = await VendorPlan.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    console.error("❌ Error fetching vendor plans:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// Get a single vendor plan by ID
exports.getVendorPlanById = async (req, res) => {
  try {
    const plan = await VendorPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Vendor plan not found" });
    }
    res.status(200).json({ success: true, data: plan });
  } catch (err) {
    console.error("❌ Error fetching vendor plan:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update a vendor plan
exports.updateVendorPlan = async (req, res) => {
  try {
    const updatedPlan = await VendorPlan.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!updatedPlan) {
      return res.status(404).json({ success: false, message: "Vendor plan not found" });
    }
    res.status(200).json({ 
      success: true, 
      message: "Vendor plan updated successfully", 
      data: updatedPlan 
    });
  } catch (err) {
    console.error("❌ Error updating vendor plan:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete a vendor plan
exports.deleteVendorPlan = async (req, res) => {
  try {
    const deletedPlan = await VendorPlan.findByIdAndDelete(req.params.id);
    if (!deletedPlan) {
      return res.status(404).json({ success: false, message: "Vendor plan not found" });
    }
    res.status(200).json({ 
      success: true, 
      message: "Vendor plan deleted successfully" 
    });
  } catch (err) {
    console.error("❌ Error deleting vendor plan:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



// Get all charges
exports.getAllCharges = async (req, res) => {
  try {
    const charges = await Charge.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: charges,
      message: 'Charges fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single charge
exports.getCharge = async (req, res) => {
  try {
    const charge = await Charge.findById(req.params.id);
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: charge
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create new charge
exports.createCharge = async (req, res) => {
  try {
    const { 
      type, 
      amount, 
      chargeType,
      distance,
      deliveryMethod,
      minDistance,
      maxDistance,
      perKmRate,
      freeDeliveryThreshold  // ✅ Added new field
    } = req.body;
    
    // Validate required fields
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Type is required field'
      });
    }
    
    // For free delivery threshold, amount is optional
    if (type !== 'free_delivery_threshold' && amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required for this charge type'
      });
    }
    
    // Additional validation for delivery charges
    if (type === 'delivery_charge') {
      if (!deliveryMethod) {
        return res.status(400).json({
          success: false,
          message: 'Delivery method is required for delivery charges'
        });
      }
      
      switch(deliveryMethod) {
        case 'flat_rate':
        
          break;
        case 'per_km':
          break;
        case 'slab_based':
          if (!minDistance || !maxDistance || !perKmRate) {
            return res.status(400).json({
              success: false,
              message: 'Min distance, max distance and per km rate are required for slab based delivery'
            });
          }
          if (minDistance >= maxDistance) {
            return res.status(400).json({
              success: false,
              message: 'Min distance must be less than max distance'
            });
          }
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid delivery method'
          });
      }
    }
    
    // Validation for free delivery threshold
    if (type === 'free_delivery_threshold') {
      if (!freeDeliveryThreshold || freeDeliveryThreshold <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Free delivery threshold amount is required'
        });
      }
    }
    
    // Use the chargeType sent from frontend, or default to 'fixed'
    const finalChargeType = chargeType || 'fixed';
    const finalAmount = type === 'free_delivery_threshold' ? 0 : amount;
    
    const newCharge = await Charge.create({
      type,
      amount: finalAmount,
      chargeType: finalChargeType,
      distance: type === 'delivery_charge' ? distance : null,
      deliveryMethod: type === 'delivery_charge' ? deliveryMethod : null,
      minDistance: type === 'delivery_charge' ? minDistance : null,
      maxDistance: type === 'delivery_charge' ? maxDistance : null,
      perKmRate: type === 'delivery_charge' ? perKmRate : null,
      freeDeliveryThreshold: type === 'free_delivery_threshold' ? freeDeliveryThreshold : null
    });
    
    res.status(201).json({
      success: true,
      data: newCharge,
      message: 'Charge created successfully'
    });
  } catch (error) {
    // Handle validation errors from mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    // Handle duplicate key errors
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update charge
exports.updateCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      amount, 
      chargeType,
      distance,
      deliveryMethod,
      minDistance,
      maxDistance,
      perKmRate,
      freeDeliveryThreshold  // ✅ Added new field
    } = req.body;
    
    // Find existing charge
    const existingCharge = await Charge.findById(id);
    if (!existingCharge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found'
      });
    }
    
    // For free delivery threshold, amount is optional
    if (existingCharge.type !== 'free_delivery_threshold' && amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required for this charge type'
      });
    }
    
    // If updating delivery charge, validate delivery-specific fields
    if (existingCharge.type === 'delivery_charge') {
      // If updating delivery method, validate the required fields
      const methodToUse = deliveryMethod || existingCharge.deliveryMethod;
      
      switch(methodToUse) {
        case 'flat_rate':
          const newDistance = distance !== undefined ? distance : existingCharge.distance;
          break;
        case 'per_km':
          const newPerKmRate = perKmRate !== undefined ? perKmRate : existingCharge.perKmRate;
          if (!newPerKmRate || newPerKmRate <= 0) {
            return res.status(400).json({
              success: false,
              message: 'Per km rate is required for per kilometer delivery'
            });
          }
          break;
        case 'slab_based':
          const newMinDistance = minDistance !== undefined ? minDistance : existingCharge.minDistance;
          const newMaxDistance = maxDistance !== undefined ? maxDistance : existingCharge.maxDistance;
          const newSlabPerKmRate = perKmRate !== undefined ? perKmRate : existingCharge.perKmRate;
          
          if (!newMinDistance || !newMaxDistance || !newSlabPerKmRate) {
            return res.status(400).json({
              success: false,
              message: 'Min distance, max distance and per km rate are required for slab based delivery'
            });
          }
          if (newMinDistance >= newMaxDistance) {
            return res.status(400).json({
              success: false,
              message: 'Min distance must be less than max distance'
            });
          }
          break;
      }
    }
    
    // Validation for free delivery threshold
    if (existingCharge.type === 'free_delivery_threshold') {
      const newThreshold = freeDeliveryThreshold !== undefined ? freeDeliveryThreshold : existingCharge.freeDeliveryThreshold;
      if (!newThreshold || newThreshold <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Free delivery threshold amount is required'
        });
      }
    }
    
    // Prepare update data
    const updateData = {};
    if (amount !== undefined) updateData.amount = amount;
    if (chargeType) updateData.chargeType = chargeType;
    
    // Add type-specific fields
    if (existingCharge.type === 'delivery_charge') {
      if (distance !== undefined) updateData.distance = distance;
      if (deliveryMethod) updateData.deliveryMethod = deliveryMethod;
      if (minDistance !== undefined) updateData.minDistance = minDistance;
      if (maxDistance !== undefined) updateData.maxDistance = maxDistance;
      if (perKmRate !== undefined) updateData.perKmRate = perKmRate;
      updateData.freeDeliveryThreshold = null; // Clear free delivery threshold
    } 
    else if (existingCharge.type === 'free_delivery_threshold') {
      if (freeDeliveryThreshold !== undefined) updateData.freeDeliveryThreshold = freeDeliveryThreshold;
      // Clear delivery-related fields
      updateData.distance = null;
      updateData.deliveryMethod = null;
      updateData.minDistance = null;
      updateData.maxDistance = null;
      updateData.perKmRate = null;
    }
    else {
      // Clear delivery-related fields for other non-delivery charges
      updateData.distance = null;
      updateData.deliveryMethod = null;
      updateData.minDistance = null;
      updateData.maxDistance = null;
      updateData.perKmRate = null;
      updateData.freeDeliveryThreshold = null;
    }
    
    const updatedCharge = await Charge.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: updatedCharge,
      message: 'Charge updated successfully'
    });
  } catch (error) {
    // Handle validation errors from mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete charge
exports.deleteCharge = async (req, res) => {
  try {
    const chargeId = req.params.id;
    
    const deletedCharge = await Charge.findByIdAndDelete(chargeId);
    
    if (!deletedCharge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Charge deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};





// Create Commission
exports.createCommission = async (req, res) => {
  const { type, userId, commission } = req.body;
  if (!userId || commission == null) return res.status(400).json({ success: false, message: "userId and commission are required" });

  try {
    const exists = await Commission.findOne(type === "vendor" ? { type, vendorId: userId } : { type, ambassadorId: userId });

    const newComm = await Commission.create({
      type,
      commission,
      ...(type === "vendor" ? { vendorId: userId } : { ambassadorId: userId })
    });

    res.status(201).json({ success: true, data: newComm });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update Commission
exports.updateCommission = async (req, res) => {
  const { id } = req.params;
  const { commission } = req.body;
  if (commission == null) return res.status(400).json({ success: false, message: "commission is required" });

  try {
    const updated = await Commission.findByIdAndUpdate(id, { commission }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Commission not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete Commission
exports.deleteCommission = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Commission.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Commission not found" });
    res.status(200).json({ success: true, message: "Commission deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// Get Admin Wallet Balance
exports.getAdminWallet = async (req, res) => {
    try {
        const { adminId } = req.params;

        // Find the admin by adminId
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // Return wallet balance
        return res.status(200).json({
            success: true,
            message: 'Admin wallet fetched successfully',
            data: {
                adminId: admin._id,
                name: admin.name,
                walletBalance: admin.walletBalance || 0
            }
        });

    } catch (err) {
        console.error('Get Admin Wallet Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
};



exports.addReferralReward = async (req, res) => {
  try {
    const { userType, rewardType, rewardValue, minOrderValue, maxReward } = req.body;

    // Validate required fields
    if (!userType || !rewardType || rewardValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User type, reward type and reward value are required'
      });
    }

    // Validate percentage range
    if (rewardType === 'percentage' && (rewardValue < 0 || rewardValue > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage must be between 0 and 100'
      });
    }

    // Check if already exists
    const existing = await ReferralReward.findOne({ userType });
    
    if (existing) {
      // Update existing
      existing.rewardType = rewardType;
      existing.rewardValue = rewardValue;
      existing.minOrderValue = minOrderValue || 0;
      existing.maxReward = maxReward || 0;
      
      const updated = await existing.save();
      
      return res.status(200).json({
        success: true,
        message: 'Referral reward updated',
        data: updated
      });
    }

    // Create new
    const reward = await ReferralReward.create({
      userType,
      rewardType,
      rewardValue,
      minOrderValue: minOrderValue || 0,
      maxReward: maxReward || 0
    });

    res.status(201).json({
      success: true,
      message: 'Referral reward created',
      data: reward
    });

  } catch (error) {
    console.error('Error creating reward:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Reward for this user type already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// GET ALL - Get all referral rewards
exports.getReferralRewards = async (req, res) => {
  try {
    const rewards = await ReferralReward.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: rewards.length,
      data: rewards
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// UPDATE - Update referral reward
exports.updateReferralReward = async (req, res) => {
  try {
    const { rewardType, rewardValue, minOrderValue, maxReward } = req.body;
    
    const reward = await ReferralReward.findById(req.params.id);
    
    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    // Validate percentage range
    if (rewardType === 'percentage' && (rewardValue < 0 || rewardValue > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage must be between 0 and 100'
      });
    }

    // Update fields
    if (rewardType) reward.rewardType = rewardType;
    if (rewardValue !== undefined) reward.rewardValue = rewardValue;
    if (minOrderValue !== undefined) reward.minOrderValue = minOrderValue;
    if (maxReward !== undefined) reward.maxReward = maxReward;

    const updated = await reward.save();

    res.status(200).json({
      success: true,
      message: 'Reward updated',
      data: updated
    });

  } catch (error) {
    console.error('Error updating reward:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// DELETE - Delete referral reward
exports.deleteReferralReward = async (req, res) => {
  try {
    const reward = await ReferralReward.findById(req.params.id);
    
    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    await reward.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Reward deleted'
    });

  } catch (error) {
    console.error('Error deleting reward:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};



// Helper function to generate 4-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000); // 1000-9999
};



// Forgot Password Controller
// Forgot Password Controller
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'No admin found with this email'
      });
    }

    // Generate 4-digit reset OTP
    const resetOTP = generateOTP();
    const resetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save reset OTP
    admin.resetOTP = resetOTP;
    admin.resetOTPExpires = resetOTPExpires;
    await admin.save();

    // Prepare email HTML
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #8B5CF6;">VEGIFFY Admin Portal</h2>
          <h3 style="color: #333;">Password Reset Request</h3>
        </div>
        <div style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
          <h1 style="font-size: 48px; margin: 0; letter-spacing: 10px;">${resetOTP}</h1>
          <p style="margin-top: 10px; font-size: 14px;">(Valid for 10 minutes)</p>
        </div>
        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
          Hello ${admin.name || 'Admin'},
        </p>
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
          We received a request to reset your admin account password. Use the OTP above to proceed with resetting your password.
        </p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Important:</strong> 
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This OTP is valid for 10 minutes only</li>
              <li>Do not share this OTP with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </p>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
          <a href="${process.env.FRONTEND_URL}/login" 
             style="display: inline-block; background: linear-gradient(135deg, #8B5CF6, #EC4899); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Go to Login Page
          </a>
        </div>
        <div style="color: #666; font-size: 12px; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          <p>© ${new Date().getFullYear()} VEGIFFY Admin Portal. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send OTP email using sendEmail helper
    const emailSent = await sendEmail(email, 'VEGIFFY Admin - Password Reset OTP', html);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    // Return response with OTP (for dev/testing)
    res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email',
      resetOTP, // 4-digit OTP included
      email: admin.email
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Reset Password Controller
// Reset Password Controller
exports.resetPassword = async (req, res) => {
  try {
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'OTP and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find admin using OTP
    const admin = await Admin.findOne({
      resetOTP: otp,
      resetOTPExpires: { $gt: Date.now() }
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Direct password save (NO hash)
    admin.password = newPassword;
    admin.resetOTP = undefined;
    admin.resetOTPExpires = undefined;
    admin.lastPasswordChange = Date.now();

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



exports.addCredential = async (req, res) => {
  try {
    const { type, email, mobile, whatsappNumber } = req.body;

    if (!type || !email || !mobile || !whatsappNumber) {
      return res.status(400).json({
        message: 'Type, email, mobile, and whatsappNumber are required'
      });
    }

    const newCredential = new Credential({
      type,
      email,
      mobile,
      whatsappNumber
    });

    await newCredential.save();

    return res.status(201).json({
      message: 'Credential added successfully',
      credential: newCredential
    });

  } catch (error) {
    console.error('Error adding credential:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};


// Get all credentials
exports.getAllCredentials = async (req, res) => {
  try {
    const credentials = await Credential.find();
    return res.status(200).json({ credentials });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a credential
exports.updateCredential = async (req, res) => {
  try {
    const { credentialId } = req.params;
    const { type, email, mobile, whatsappNumber } = req.body;

    const updateData = {};

    if (type) updateData.type = type;
    if (email) updateData.email = email;
    if (mobile) updateData.mobile = mobile;
    if (whatsappNumber) updateData.whatsappNumber = whatsappNumber;

    const updatedCredential = await Credential.findByIdAndUpdate(
      credentialId,
      updateData,
      { new: true }
    );

    if (!updatedCredential) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    return res.status(200).json({
      message: 'Credential updated successfully',
      credential: updatedCredential
    });

  } catch (error) {
    console.error('Error updating credential:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};


// Delete a credential
exports.deleteCredential = async (req, res) => {
  try {
    const { credentialId } = req.params;

    const deletedCredential = await Credential.findByIdAndDelete(credentialId);

    if (!deletedCredential) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    return res.status(200).json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Error deleting credential:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};