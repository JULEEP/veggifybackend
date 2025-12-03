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
exports.verifyOtp = async (req, res) => {
    try {
        const { otp, token } = req.body;
        if (!otp || !token)
            return res.status(400).json({ message: 'OTP and token are required' });

        const decoded = verifyTempToken(token);
        if (!decoded) return res.status(400).json({ message: 'OTP expired or invalid token' });
        if (otp !== decoded.otp) return res.status(400).json({ message: 'Invalid OTP' });

        const admin = await Admin.findOne({ phoneNumber: decoded.phoneNumber });
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        admin.isOtpVerified = true;
        await admin.save();

        return res.status(200).json({ message: 'OTP verified successfully' });
    } catch (err) {
        console.error('Verify OTP Error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

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

// 4. Login with email and password
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate the required fields
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find the admin by email
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not registered' });
        }

        // Generate an authentication token for the logged-in admin
        const token = generateAuthToken({
            id: admin._id,
            email: admin.email,
        });

        // Send the response with the token and other details
        return res.status(200).json({
            message: 'Login successful',
            token,
            adminId: admin._id,
            name: admin.name,
            email: admin.email
        });
    } catch (err) {
        console.error('Login Error:', err);
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
    const { fullName, email, mobileNumber, role, gender, age, pagesAccess } = req.body;

    // ✅ express-fileupload → files are directly inside req.files
    const aadharCard = req.files?.aadharCard;
    const photo = req.files?.photo;

    if (!aadharCard || !photo) {
      return res.status(400).json({
        success: false,
        message: "Aadhar card and photo are required",
      });
    }

    // ✅ Check if staff already exists
    const existingStaff = await Staff.findOne({
      $or: [{ email }, { phone: mobileNumber }],
    });

    // ✅ Upload directly from temp file path
    const aadharUpload = await cloudinary.uploader.upload(aadharCard.tempFilePath, {
      folder: "staff/aadhar",
    });
    const photoUpload = await cloudinary.uploader.upload(photo.tempFilePath, {
      folder: "staff/photo",
    });

    // ✅ Parse pagesAccess if it's JSON string
    let parsedPagesAccess = [];
    if (pagesAccess) {
      try {
        parsedPagesAccess =
          typeof pagesAccess === "string" ? JSON.parse(pagesAccess) : pagesAccess;
      } catch (parseError) {
        console.error("Error parsing pagesAccess:", parseError);
        parsedPagesAccess = [];
      }
    }

    // ✅ Create staff data
    const staffData = {
      fullName,
      email,
      phone: mobileNumber,
      role,
      gender,
      age,
      aadharCard: aadharUpload.secure_url,
      photo: photoUpload.secure_url,
      pagesAccess: parsedPagesAccess,
      status: "pending",
    };

    const newStaff = new Staff(staffData);
    await newStaff.save();

    res.status(201).json({
      success: true,
      message: "Staff registered successfully!",
      staff: newStaff,
    });
  } catch (error) {
    console.error("Staff Registration Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
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



// Create a new plan
exports.createPlan = async (req, res) => {
  try {
    const { name, price, validity, benefits } = req.body;

    const newPlan = new AmbassadorPlan({
      name,
      price,
      validity,
      benefits,
    });

    await newPlan.save();

    res.status(201).json({
      success: true,
      message: "Ambassador Plan created successfully",
      data: newPlan,
    });
  } catch (err) {
    console.error("❌ Error creating plan:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
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
      { $match: { orderStatus: 'Delivered' } },  // Filter for completed orders
      { $group: { _id: null, totalRevenue: { $sum: '$totalPayable' } } }, // Sum totalPayable for revenue
    ]);

    // Get Counts and Revenue for each Order Status (Completed, Pending, Cancelled)
    const orderStatusCountsAndRevenue = await orderModel.aggregate([
      {
        $group: {
          _id: "$orderStatus",   // Grouping by orderStatus
          count: { $sum: 1 },     // Count of orders by status
          totalSales: { $sum: '$totalPayable' } // Sum of totalPayable for each status
        }
      }
    ]);

    // Initialize order stats with default values
    const orderStats = {
      completed: { count: 0, sales: 0 },
      pending: { count: 0, sales: 0 },
      cancelled: { count: 0, sales: 0 }
    };

    // Loop through the aggregation result and assign counts and sales
    orderStatusCountsAndRevenue.forEach(status => {
      if (status._id === 'Completed') {
        orderStats.completed.count = status.count;
        orderStats.completed.sales = status.totalSales;
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
      completedOrders: orderStats.completed.count,
      completedSales: orderStats.completed.sales,
      pendingOrders: orderStats.pending.count,
      pendingSales: orderStats.pending.sales,
      cancelledOrders: orderStats.cancelled.count,
      cancelledSales: orderStats.cancelled.sales,
      totalRevenue: totalRevenue[0]?.totalRevenue || 0
    };

    // Total Banners
    const totalBanners = await Banner.countDocuments();

    // Fetch Latest Orders (let's assume we want the latest 5 orders)
    const latestOrders = await orderModel.aggregate([
      { $sort: { createdAt: -1 } }, // Sort by creation date (newest first)
      { $limit: 5 }, // Limit to the latest 5 orders
      {
        $lookup: {
          from: 'users', // Assuming users are stored in the 'users' collection
          localField: 'userId',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } // Unwind the customer array
      },
      {
        $lookup: {
          from: 'restaurantproducts', // Assuming restaurant products are in 'restaurantproducts'
          localField: 'products.restaurantProductId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } // Unwind product details
      },
      {
        $project: {
          orderId: 1,
          customerName: { $concat: ["$customer.firstName", " ", "$customer.lastName"] },
          productName: { $arrayElemAt: ["$productDetails.name", 0] },
          category: { $arrayElemAt: ["$productDetails.category", 0] },
          price: { $arrayElemAt: ["$productDetails.basePrice", 0] },
          status: 1,
          createdAt: 1
        }
      },
      {
        $project: {
          orderId: 1,
          customerName: 1,
          productName: 1,
          category: 1,
          price: 1,
          status: 1,
          timeAgo: {
            $dateToString: { format: "%H:%M:%S", date: "$createdAt" }
          }
        }
      }
    ]);

    // Additional Metrics
    // 1. Orders Today
    const ordersToday = await orderModel.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    // 2. Revenue Today
    const revenueToday = await orderModel.aggregate([
      { $match: { orderStatus: 'Delivered', createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPayable' } } }
    ]);

    // 3. Success Rate (Completed Orders / Total Orders)
    const successRate = totalOrders > 0 ? (orderStats.completed.count / totalOrders) * 100 : 0;

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
        orderStats,  // Separate order stats (completed, pending, cancelled)
        salesOverview, // Separate sales overview (order count and sales)
        latestOrders, // Latest 5 orders with details
        ordersToday, // Orders Today
        revenueToday: revenueToday[0]?.totalRevenue || 0, // Revenue Today
        successRate, // Success Rate (Percentage)
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
    const { type, amount } = req.body;
    
    // Check if charge type already exists
    const existingCharge = await Charge.findOne({ type });
    if (existingCharge) {
      return res.status(400).json({
        success: false,
        message: 'Charge type already exists'
      });
    }
    
    // Auto-detect charge type based on the type field
    let chargeType = 'fixed';
    if (type === 'gst_charges' || type === 'gst_on_delivery' || type === 'platform_charge') {
      chargeType = 'percentage';
    }
    
    const newCharge = await Charge.create({
      type,
      amount,
      chargeType
    });
    
    res.status(201).json({
      success: true,
      data: newCharge,
      message: 'Charge created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update charge
exports.updateCharge = async (req, res) => {
  try {
    const { amount, chargeType } = req.body;
    const chargeId = req.params.id;
    
    const updatedCharge = await Charge.findByIdAndUpdate(
      chargeId,
      { 
        amount,
        chargeType,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedCharge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedCharge,
      message: 'Charge updated successfully'
    });
  } catch (error) {
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