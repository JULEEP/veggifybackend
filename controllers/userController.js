// ✅ User Controller with Complete Flow
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Banner = require('../models/banner');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateReferralCode } = require('../utils/refeeral');
const { generateTempToken, verifyTempToken } = require('../utils/jws');
const cloudinary = require('../config/cloudinary');
const {DeliveryBoy} = require('../models/deliveryBoyModel');
const Chat = require('../models/Chat');
const fs = require('fs'); 
const Ambassador = require('../models/ambassadorModel');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const dotenv = require("dotenv");
const WebsiteEnquiry = require('../models/WebsiteEnquiry');
const Maintenance = require('../models/Maintenance');
const twilio = require("twilio");

dotenv.config();


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);



let latestToken = null;
let tempForgotToken = null;
let verifiedForgotPhone = null;


const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit OTP
};


const formatPhoneNumber = (phoneNumber) => {
  // remove spaces, dashes, etc
  let phone = phoneNumber.replace(/\D/g, "");

  // if already has country code
  if (phone.length === 12 && phone.startsWith("91")) {
    return `+${phone}`;
  }

  // normal Indian number
  if (phone.length === 10) {
    return `+91${phone}`;
  }

  throw new Error("Invalid phone number format");
};



const register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, referralCode } = req.body;

    if (!firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const generatedReferralCode = `VEGUSER${generateReferralCode()}`;
    const otp = generateOTP();

    // ✅ FORMAT NUMBER INSIDE CONTROLLER
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // ✅ SET MESSAGE BODY IN EXACT REQUIRED FORMAT
    const messageBody = `Welcome to Vegiffy – Pure Vegetarian Food Delivery App
Your verification OTP is ${otp}.
Valid for 5 minutes. Do not share this code.`;

    await client.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE,
      to: formattedPhone,
    });

    const payload = {
      firstName,
      lastName,
      email,
      phoneNumber, // original saved
      referralCode: generatedReferralCode,
      referredBy: referralCode || null,
      otp,
      createdAt: new Date().toISOString(),
    };

    const tempToken = generateTempToken(payload);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully ✅",
      token: tempToken,
      referralCode: generatedReferralCode,
        otp: otp
    });

  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: err.message,
    });
  }
};



const updateUserSimply = async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, phoneNumber } = req.body;

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Valid userId is required" });
    }

    // Build dynamic update object
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true
    });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully ✅",
      user: updatedUser
    });

  } catch (error) {
    console.error("Update User Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};



const verifyOtp = async (req, res) => {
  try {
    const { otp, token } = req.body;
    if (!otp || !token)
      return res.status(400).json({ message: "OTP and token are required" });

    // Decode token to get user info
    const decoded = verifyTempToken(token);

    if (decoded.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP ❌" });
    }

    // Create user in DB after OTP verification
    const newUser = new User({
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      email: decoded.email,
      phoneNumber: decoded.phoneNumber,
      referralCode: decoded.referralCode,
      referredBy: decoded.referredBy,
      otp: null, // clear OTP
      isVerified: true
    });

    await newUser.save();

    // Add to ambassador if referred
    if (decoded.referredBy && decoded.referredBy.startsWith("VEGGYFYAMB")) {
      const ambassador = await Ambassador.findOne({ referralCode: decoded.referredBy });
      if (ambassador) {
        ambassador.users.push(newUser._id);
        await ambassador.save();
      }
    }

    res.status(200).json({
      message: "OTP verified ✅ User created",
      userId: newUser._id,
      referralCode: newUser.referralCode
    });

  } catch (err) {
    res.status(400).json({
      message: "OTP verification failed ❌",
      error: err.message
    });
  }
};


const resendOtp = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // 🔐 Decode existing token to get user info
    const decoded = verifyTempToken(token);
    if (!decoded) {
      return res.status(400).json({ message: "Invalid or expired token ❌" });
    }

    // 🔁 Generate same static OTP again
    const newOtp = "1234";

    // 🧩 Prepare new payload (same user info + updated OTP + new timestamp)
    const newPayload = {
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      email: decoded.email,
      phoneNumber: decoded.phoneNumber,
      referralCode: decoded.referralCode,
      referredBy: decoded.referredBy || null,
      otp: newOtp,
      createdAt: new Date().toISOString(),
    };

    // 🪙 Generate new temp token
    const newToken = generateTempToken(newPayload);

    // 📩 Response
    return res.status(200).json({
      message: "OTP resent successfully ✅",
      otp: newOtp, // static OTP (for testing)
      token: newToken,
    });

  } catch (err) {
    console.error("Resend OTP Error:", err);
    return res.status(500).json({
      message: "Failed to resend OTP ❌",
      error: err.message,
    });
  }
};


// ✅ Get Referral Code by User ID
// ✅ Get Referral Code by User ID
const getReferralCodeByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const user = await User.findById(userId).select('referralCode');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert Mongoose document to plain JS object
    const userObj = user.toObject();

    console.log('User object:', userObj);

    res.status(200).json({
      message: 'Referral code fetched successfully ✅',
      referralCode: userObj.referralCode
    });

  } catch (error) {
    res.status(500).json({
      message: 'Failed to get referral code ❌',
      error: error.message
    });
  }
};

module.exports = { getReferralCodeByUserId };



const setPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ message: 'UserId and password are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId format' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.password) return res.status(400).json({ message: 'Password already set' });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.status(200).json({ message: 'Password set successfully ✅' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to set password', error: err.message });
  }
};


 const login = async (req, res) => {
  const { phoneNumber, password } = req.body;
  if (!phoneNumber || !password)
    return res.status(400).json({ message: "All fields required" });

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user || !user.password)
      return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Incorrect password" });

    const payload = {
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      referralCode: user.referralCode,
      createdAt: new Date().toISOString(),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      message: "Login successful ✅",
      token,
      user: {
        userId: user._id,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

 const sendForgotOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: false,
        message: "Phone number required ❌",
      });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found ❌",
      });
    }

    // ✅ Generate random 4-digit OTP
    const otp = generateOTP();

    // ✅ FORMAT PHONE NUMBER
    const formattedPhone = `+91${phoneNumber}`; // ya agar formatPhoneNumber function hai use kar sakte ho

    // ✅ SET MESSAGE BODY IN SAME FORMAT AS REGISTRATION
    const messageBody = `Welcome to Vegiffy – Pure Vegetarian Food Delivery App
Your verification OTP is ${otp}.
Valid for 5 minutes. Do not share this code.`;

    // ✅ Send OTP via Twilio
    await client.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE,
      to: formattedPhone,
    });

    // ✅ Short-lived JWT token for OTP verification
    const tempToken = jwt.sign(
      {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        otp,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.status(200).json({
      status: true,
      message: "OTP sent successfully ✅",
      token: tempToken,
    });

  } catch (err) {
    console.error("Forgot OTP Error:", err);
    return res.status(500).json({
      status: false,
      message: "OTP send failed ❌",
      error: err.message,
    });
  }
};


const verifyForgotOtp = async (req, res) => {
  try {
    const { otp, token } = req.body;

    if (!otp || !token) {
      return res.status(400).json({ status: false, message: "OTP or token missing ❌" });
    }

    // ✅ Decode the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ status: false, message: "Invalid or expired token ❌" });
    }

    // ✅ Compare OTP
    if (decoded.otp !== otp) {
      return res.status(400).json({ status: false, message: "Invalid OTP ❌" });
    }

    // ✅ OTP verified
    return res.status(200).json({
      status: true,
      message: "OTP verified successfully ✅",
      userId: decoded.userId,
      phoneNumber: decoded.phoneNumber
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: "OTP verification failed ❌",
      error: err.message
    });
  }
};



const resetForgotPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) return res.status(400).json({ status: false, message: "Passwords required ❌" });
    if (newPassword !== confirmPassword) return res.status(400).json({ status: false, message: "Passwords do not match ❌" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, message: "User not found ❌" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ status: true, message: "Password reset successful ✅" });

  } catch (err) {
    return res.status(500).json({ status: false, message: "Password reset failed ❌", error: err.message });
  }
};



const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      message: 'Profile fetched ✅',
      user: {
        userId: user._id,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phoneNumber: user.phoneNumber,
        referralCode: user.referralCode,
        coins: user.coins || 0,
        profileImg: user.profileImg
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Profile fetch failed', error: err.message });
  }
};

const uploadProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ express-fileupload gives files in req.files
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const file = req.files.image; // key must be "image" in Postman

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'profile_images',
      width: 400,
      height: 400,
      crop: 'fill'
    });

    const profileImgUrl = result.secure_url;

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImg: profileImgUrl },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      message: 'Profile image uploaded successfully ✅',
      profileImg: profileImgUrl,
      user
    });
  } catch (error) {
    console.error("Upload profile image error:", error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};


const deleteProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.image) {
      return res.status(400).json({ message: 'No profile image to delete' });
    }

    // Optionally delete image from Cloudinary
    await cloudinary.uploader.destroy(user.image);

    // Remove image field from user document
    user.image = undefined;
    await user.save();

    res.status(200).json({ message: 'Profile image deleted successfully ✅' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete profile image ❌', error: error.message });
  }
};


 const addAddress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { street, city, state, postalCode, country, addressType, latitude, longitude } = req.body;

    // Validate required fields
    if (!street || !city || !state || !postalCode || !country) {
      return res.status(400).json({ message: 'All address fields are required ❌' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found ❌' });

    // Create the new address object with proper GeoJSON format
    const newAddress = {
      street,
      city,
      state,
      postalCode,
      country,
      addressType: addressType || 'Home',
      location: {
        type: "Point",
        coordinates: [
          Number(longitude) || 0, // longitude first
          Number(latitude) || 0   // latitude second
        ]
      }
    };

    // Initialize addresses array if it doesn't exist
    if (!Array.isArray(user.addresses)) {
      user.addresses = [];
    }

    // Push the new address
    user.addresses.push(newAddress);

    // Save user
    await user.save();

    res.status(200).json({
      message: 'Address added successfully ✅',
      address: newAddress // Return the newly added address
    });

  } catch (err) {
    console.error("Error adding address:", err);
    res.status(500).json({ message: 'Failed to add address ❌', error: err.message });
  }
};

// 📌 Get All Addresses of a User
const getAllAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found ❌' });

    res.status(200).json({
      success: true,
      message: "All addresses fetched ✅",
      addresses: user.addresses || []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch addresses ❌", error: err.message });
  }
};

// 📌 Get Single Address by Address ID
const getAddressById = async (req, res) => {
  try {
    const { userId, addressId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found ❌' });

    const address = user.address.id(addressId);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found ❌' });

    res.status(200).json({
      success: true,
      message: "Address fetched ✅",
      address
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch address ❌", error: err.message });
  }
};

// 📌 Update Address by Address ID
const updateAddressById = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const { street, city, state, postalCode, country, addressType, latitude, longitude } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found ❌' });

    // Find the address by its ID
    const address = user.addresses.id(addressId);
    if (!address) return res.status(404).json({ message: 'Address not found ❌' });

    // Update only the fields present in the request body
    address.street = street || address.street;
    address.city = city || address.city;
    address.state = state || address.state;
    address.postalCode = postalCode || address.postalCode;
    address.country = country || address.country;
    address.addressType = addressType || address.addressType;

    // Update location if latitude or longitude provided
    if (latitude !== undefined || longitude !== undefined) {
      address.location = {
        type: "Point",
        coordinates: [
          longitude !== undefined ? longitude : (address.location?.coordinates[0] || 0),
          latitude !== undefined ? latitude : (address.location?.coordinates[1] || 0)
        ]
      };
    }

    // Save the updated user document
    await user.save();

    res.status(200).json({
      message: 'Address updated successfully ✅',
      address: address // Return the updated address
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to update address ❌', error: err.message });
  }
};

// 📌 Delete Address by Address ID
const deleteAddressById = async (req, res) => {
  try {
    const { userId, addressId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found ❌' });

    // Check if user has addresses
    if (!user.addresses || user.addresses.length === 0) {
      return res.status(404).json({ success: false, message: 'No addresses found ❌' });
    }

    // Find index of the address
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: 'Address not found ❌' });
    }

    // Remove the address
    user.addresses.splice(addressIndex, 1);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully ✅"
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete address ❌", error: err.message });
  }
};

// ✅ POST Location (Only if location not already present)
const postLocation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.body;

    // Validate coordinates
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "Both latitude and longitude are required"
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: "Coordinates must be valid numbers"
      });
    }

    // Update user location
    const user = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: 'Point',
          coordinates: [lng, lat] // [longitude, latitude]
        }
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      location: user.location
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update location",
      error: error.message
    });
  }
};

// ✅ PUT Location (Update existing)
const updateLocation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { latitude, longitude },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found ❌' });

    res.status(200).json({
      message: 'Location updated successfully ✅',
      location: {
        latitude: user.latitude,
        longitude: user.longitude
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update location ❌', error: err.message });
  }
};

// ✅ GET Location
const getLocation = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('latitude longitude');
    if (!user) return res.status(404).json({ message: 'User not found ❌' });

    res.status(200).json({
      message: 'Location fetched ✅',
      location: {
        latitude: user.latitude,
        longitude: user.longitude
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch location ❌', error: err.message });
  }
};


const getReferralByUserId = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('referralCode coins');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ referralCode: user.referralCode, coins: user.coins });
  } catch (err) {
    res.status(500).json({ message: 'Get referral failed', error: err.message });
  }
};


/// ✅ CREATE
// Controller
const createBanner = async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const imageFile = req.files.image;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(imageFile.tempFilePath, {
      folder: "banners"
    });

    const newBanner = await Banner.create({
      image: result.secure_url,
      status: 'pending'
    });

    return res.status(201).json({ message: 'Banner created ✅', data: newBanner });
  } catch (err) {
    return res.status(500).json({ message: 'Create failed ❌', error: err.message });
  }
};
// ✅ READ ALL
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ status: "active" })
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ message: "Active banners fetched ✅", data: banners });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Fetch failed ❌", error: err.message });
  }
};


const getPendingBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ status: "pending" })
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ message: "Pending banners fetched ✅", data: banners });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Fetch failed ❌", error: err.message });
  }
};



// ✅ READ BY ID
const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    return res.status(200).json({ data: banner });
  } catch (err) {
    return res.status(500).json({ message: 'Fetch by ID failed ❌', error: err.message });
  }
};

// ✅ UPDATE
const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    let imageUrl = banner.image;

    // ✅ If a new file is uploaded, upload to Cloudinary
    if (req.files && req.files.image) {
      const result = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: "banners",
      });
      imageUrl = result.secure_url;
    }

    // ✅ Update status if provided
    if (req.body.status) {
      banner.status = req.body.status;
    }

    // ✅ Update image URL
    banner.image = imageUrl;

    await banner.save();

    return res.status(200).json({
      success: true,
      message: 'Banner updated successfully ✅',
      data: banner,
    });
  } catch (err) {
    console.error('Banner update error:', err);
    return res.status(500).json({
      success: false,
      message: 'Update failed ❌',
      error: err.message,
    });
  }
};


// ✅ DELETE
const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    return res.status(200).json({ message: 'Banner deleted ✅' });
  } catch (err) {
    return res.status(500).json({ message: 'Delete failed ❌', error: err.message });
  }
};



 const getNotificationsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid userId is required." });
    }

    // Find user and get notifications
    const user = await User.findById(userId, "notifications");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Return notifications
    return res.status(200).json({
      success: true,
      notifications: user.notifications || []
    });
  } catch (error) {
    console.error("getNotificationsForUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};



 // Send message
// Send message
const sendMessage = async (req, res) => {
  try {
    const { userId, deliveryBoyId } = req.params;
    const { message, senderType } = req.body;

    console.log('💬 Send Message Function Called');
    console.log('📝 Params:', { userId, deliveryBoyId });
    console.log('📦 Body:', { message, senderType });

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Message must be provided." });
    }

    // Validation of IDs
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(deliveryBoyId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid userId or deliveryBoyId." });
    }

    // Check if the user and delivery boy exist
    const dboyExists = await DeliveryBoy.exists({ _id: deliveryBoyId });
    const userExists = await User.exists({ _id: userId });
    if (!dboyExists || !userExists) {
      return res.status(404).json({ success: false, message: "User or DeliveryBoy not found." });
    }

    // Create new chat message
    const newChat = new Chat({
      deliveryBoyId,
      userId,
      senderType,
      message: message.trim(),
      timestamp: new Date(),
    });

    const savedMessage = await newChat.save();
    console.log('💾 Message saved to DB:', savedMessage._id);

    // Emit message via Socket.IO to the relevant room
    const roomId = `${deliveryBoyId}_${userId}`;
    console.log(`🎯 Attempting to emit to room: ${roomId}`);
    
    // Get io from global
    const io = global.io;
    
    if (io) {
      console.log('✅ Socket.io instance found');
      console.log('🔍 Checking rooms...');
      
      // Log all rooms and their sockets
      const rooms = io.sockets.adapter.rooms;
      console.log('🏠 All rooms:', Array.from(rooms.keys()));
      
      const targetRoom = rooms.get(roomId);
      if (targetRoom) {
        console.log(`👥 Room ${roomId} has ${targetRoom.size} members`);
      } else {
        console.log(`❌ Room ${roomId} not found or empty`);
      }
      
      // Emit the message
      io.to(roomId).emit('receiveMessage', savedMessage);
      console.log(`📤 Message emitted to room: ${roomId}`);
      
      // Also emit to a test event to verify
      io.to(roomId).emit('testEvent', { 
        message: 'Test from server', 
        roomId,
        timestamp: new Date() 
      });
    } else {
      console.log('❌ Socket.io instance NOT found');
      console.log('global.io:', global.io);
    }

    return res.status(201).json({ success: true, message: savedMessage });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
};

// Get chat history
const getChatHistory = async (req, res) => {
  try {
    const { userId, deliveryBoyId } = req.params;

    console.log('📚 Get Chat History Function Called');
    console.log('📝 Params:', { userId, deliveryBoyId });

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(deliveryBoyId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid userId and deliveryBoyId required."
      });
    }

    // Check if the user and delivery boy exist
    const dboyExists = await DeliveryBoy.exists({ _id: deliveryBoyId });
    const userExists = await User.exists({ _id: userId });
    if (!dboyExists || !userExists) {
      return res.status(404).json({
        success: false,
        message: "DeliveryBoy or User not found."
      });
    }

    // Fetch chat history
    const messages = await Chat.find({
      deliveryBoyId,
      userId,
    }).sort({ timestamp: 1 });

    console.log(`📨 Found ${messages.length} messages`);

    // Format and send chat history
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      deliveryBoyId: msg.deliveryBoyId,
      userId: msg.userId,
      senderType: msg.senderType,
      message: msg.message,
      timestamp: msg.timestamp.toISOString(),
    }));

    // Emit chat history to the room
    const roomId = `${deliveryBoyId}_${userId}`;
    const io = global.io;
    
    if (io) {
      io.to(roomId).emit('chatHistory', formattedMessages);
      console.log(`📤 Chat history emitted to room: ${roomId}`);
    }

    return res.status(200).json({
      success: true,
      messages: formattedMessages,
    });
  } catch (error) {
    console.error("❌ Error fetching chat history:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching chat history",
      error: error.message,
    });
  }
};



// Setup Nodemailer transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pms226803@gmail.com',
    pass: 'nrasbifqxsxzurrm',
  },
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});

// Account deletion request
const deleteAccount = async (req, res) => {
  const { email, reason } = req.body;

  if (!email || !reason) {
    return res.status(400).json({ message: 'Email and reason are required' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const deleteLink = `${process.env.BASE_URL}/confirm-delete-account/${token}`;

    user.deleteToken = token;
    user.deleteTokenExpiration = Date.now() + 3600000;

    console.log('User before saving:', user);
    await user.save();
    console.log('User after saving:', user);

    const mailOptions = {
      from: 'pms226803@gmail.com',
      to: email,
      subject: 'Account Deletion Request Received',
      text: `Hi ${user.name},\n\nWe have received your account deletion request. To confirm the deletion of your account, please click the link below:\n\n${deleteLink}\n\nReason: ${reason}\n\nIf you have any questions, contact us at support@vegiffyy.com.\n\nBest regards,\nYour Team`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: 'Account deletion request has been processed. Please check your email to confirm.',
      token: token
    });
  } catch (err) {
    console.error('Error in deleteAccount:', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// Confirm account deletion
const confirmDeleteAccount = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      deleteToken: token,
      deleteTokenExpiration: { $gt: Date.now() },
    });

    if (user) {
      await User.deleteOne({ _id: user._id });
    }

    return res.status(200).json({
      message: 'Your account has been successfully deleted.',
    });
  } catch (err) {
    console.error('Error in confirmDeleteAccount:', err);

    return res.status(200).json({
      message: 'Your account has been successfully deleted.',
    });
  }
};

// Delete user by ID (admin)
const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(userId);

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};




// Submit Website Enquiry (Already Provided)
const submitWebsiteEnquiry = async (req, res) => {
  try {
    const { name, phoneNumber, email, partnerType } = req.body;

    // Check if all fields are provided
    if (!name || !phoneNumber || !email || !partnerType) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, phone number, email, partner type) are required",
      });
    }

    // Create a new enquiry record
    const newEnquiry = new WebsiteEnquiry({
      name,
      phoneNumber,
      email,
      partnerType,
    });

    // Save the enquiry to the database
    await newEnquiry.save();

    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully! We will get in touch with you soon.",
      data: newEnquiry,
    });
  } catch (error) {
    console.error("Error submitting website enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Server error while submitting the enquiry",
      error: error.message,
    });
  }
};

// Get All Website Enquiries
const getAllWebsiteEnquiries = async (req, res) => {
  try {
    // Fetch all website enquiries from the database
    const enquiries = await WebsiteEnquiry.find().sort({ createdAt: -1 }); // Sorting by creation date (most recent first)

    if (enquiries.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No enquiries found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Enquiries fetched successfully",
      data: enquiries,
    });
  } catch (error) {
    console.error("Error fetching website enquiries:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching enquiries",
      error: error.message,
    });
  }
};




// Update enquiry status
const updateEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    const enquiry = await WebsiteEnquiry.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Enquiry updated successfully",
      data: enquiry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// Delete enquiry
const deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Delete request for ID:", id);

    // First check if enquiry exists
    const existingEnquiry = await WebsiteEnquiry.findById(id);
    if (!existingEnquiry) {
      console.log("Enquiry not found for ID:", id);
      return res.status(404).json({
        success: false,
        message: "Enquiry not found"
      });
    }

    const enquiry = await WebsiteEnquiry.findByIdAndDelete(id);

    console.log("Deleted enquiry:", enquiry);

    res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting enquiry",
      error: error.message,
    });
  }
};


// Set maintenance mode
const setMaintenance = async (req, res) => {
  try {
    const { status, message } = req.body;

    let maintenance = await Maintenance.findOne();
    if (!maintenance) {
      maintenance = new Maintenance({ status, message });
    } else {
      maintenance.status = status;
      maintenance.message = message;
    }

    await maintenance.save();

    res.status(200).json({
      message: "Maintenance status updated",
      isSuccessfull: true,
      maintenance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      isSuccessfull: false,
      error: error.message,
    });
  }
};


const getMaintenanceStatus = async (req, res) => {
  try {
    let maintenance = await Maintenance.findOne();

    // Default values if no document exists
    const response = {
      maintenance: maintenance ? maintenance.status : false,
      message: maintenance ? maintenance.message : "OK",
    };

    res.status(200).json({
      ...response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      isSuccessfull: false,
      maintenance: false,
      message: "Error fetching maintenance status",
      error: error.message,
    });
  }
};



const getUserWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Invalid userId",
        isSuccessfull: false
      });
    }

    // Fetch User Wallet
    const user = await User.findById(userId).select("wallet firstName lastName");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        isSuccessfull: false
      });
    }

    // Calculate Total Balance
    const totalBalance =
      user.wallet?.reduce((sum, txn) => sum + (txn.netAmount || txn.amount || 0), 0) || 0;

    return res.status(200).json({
      message: "Wallet fetched successfully",
      isSuccessfull: true,
      userName: `${user.firstName} ${user.lastName}`,
      totalBalance,
      transactions: user.wallet || []
    });

  } catch (error) {
    console.error("Get Wallet Error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
      isSuccessfull: false
    });
  }
};

module.exports = {
  register,
  verifyOtp,
  getReferralCodeByUserId,
  setPassword,
  login,
  sendForgotOtp,
  verifyForgotOtp,
  resetForgotPassword,
  getProfile,
  uploadProfileImage,
  deleteProfileImage,
  addAddress,
  getAllAddresses,
  getAddressById,
  updateAddressById,
  deleteAddressById,
  postLocation,
  updateLocation,
  getLocation,
  getReferralByUserId,
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
  getNotificationsForUser,
  sendMessage,
  getChatHistory,
  resendOtp,
  updateUserSimply,
   deleteAccount,
  confirmDeleteAccount,
  deleteUser,
  submitWebsiteEnquiry,
  getAllWebsiteEnquiries,
  updateEnquiry,
  deleteEnquiry,
  setMaintenance,
  getMaintenanceStatus,
  getUserWallet,
  getPendingBanners
};
