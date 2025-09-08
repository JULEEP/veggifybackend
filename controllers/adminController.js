const bcrypt = require('bcrypt');
const Admin = require('../models/adminModel');
const mongoose = require('mongoose');
const Coupon = require('../models/couponModel');
const User = require('../models/userModel');
const { generateTempToken, verifyTempToken, generateAuthToken, generateCouponToken, couponAuthMiddleware } = require('../utils/adminJWT');

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



// 4. Login with phone number only (no password)
exports.login = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber)
            return res.status(400).json({ message: 'Phone number is required' });

        const admin = await Admin.findOne({ phoneNumber });
        if (!admin)
            return res.status(404).json({ message: 'Admin not registered' });

        // No password check here anymore

        const token = generateAuthToken({ id: admin._id, phoneNumber: admin.phoneNumber });
        return res.status(200).json({ 
            message: 'Login successful', 
            token, 
            adminId: admin._id 
        });
    } catch (err) {
        console.error('Login Error:', err);
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

