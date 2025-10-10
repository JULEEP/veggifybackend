// ✅ User Controller with Complete Flow
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Banner = require('../models/banner');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateReferralCode } = require('../utils/refeeral');
const { generateTempToken, verifyTempToken } = require('../utils/jws');
const cloudinary = require('../config/cloudinary');

let latestToken = null;
let tempForgotToken = null;
let verifiedForgotPhone = null;



const register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, referralCode } = req.body;

    // Validate required fields (referralCode is optional)
    if (!firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({
        message: 'firstName, lastName, email, and phoneNumber are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate new referral code for the user
    const generatedReferralCode = generateReferralCode();

    // Hardcoded OTP for now
    const otp = '1234';

    // Create payload for temp token
    const payload = {
      firstName,
      lastName,
      email,
      phoneNumber,
      referralCode: generatedReferralCode,       // this user's referral code
      referredBy: referralCode || null,          // who referred this user, if any
      otp,
      createdAt: new Date().toISOString()
    };

    // Generate temporary token
    latestToken = generateTempToken(payload);

    // Success response
    res.status(200).json({
      message: 'OTP sent successfully',
      otp,
      token: latestToken,
      referralCode: generatedReferralCode
    });
  } catch (err) {
    res.status(500).json({
      message: 'Registration failed',
      error: err.message
    });
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { otp, token } = req.body;
    if (!otp || !token) return res.status(400).json({ message: 'OTP and token are required' });

    const decoded = verifyTempToken(token);
    if (otp !== decoded.otp) return res.status(400).json({ message: 'Invalid OTP' });


    const user = await User.create({
      _id: new mongoose.Types.ObjectId(),
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      email: decoded.email,
      phoneNumber: decoded.phoneNumber,
      referralCode: decoded.referralCode,
      referredBy: decoded.referredBy,
      isVerified: true
    });

    res.status(200).json({
      message: 'OTP verified ✅',
      userId: user._id, referralCode: user.referralCode // return immediately too
    });
  } catch (err) {
    res.status(400).json({ message: 'OTP verification failed ❌', error: err.message });
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

    // Validate input
    if (!userId || !password) {
      return res.status(400).json({ message: 'UserId and password are required' });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId format' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password) {
      return res.status(400).json({ message: 'Password already set' });
    }

    // Hash and set password
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.status(200).json({ message: 'Password set successfully ✅' });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to set password',
      error: err.message
    });
  }
};

const login = async (req, res) => {
  const { phoneNumber, password } = req.body;
  if (!phoneNumber || !password)
    return res.status(400).json({ message: 'All fields required' });

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Incorrect password' });

    res.status(200).json({
      message: 'Login successful ✅',
      user: {
        userId: user._id,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phoneNumber: user.phoneNumber
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};
const sendForgotOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findOne({ phoneNumber });
    if (!user) return res.status(404).json({ message: "User not found" });
    const otp = '1234';
    tempForgotToken = generateTempToken({ phoneNumber, otp });
    return res.status(200).json({ message: "OTP sent ✅", otp });
  } catch (err) {
    return res.status(500).json({ message: "OTP send failed ❌", error: err.message });
  }
};

const verifyForgotOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    // Check for required conditions
    if (!otp || otp !== '1234' || !tempForgotToken) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Decode the temp token
    const decoded = verifyTempToken(tempForgotToken);

    // Extract phone and userId
    verifiedForgotPhone = decoded.phoneNumber;
    const userId = decoded.userId;

    // Clear the token after use
    tempForgotToken = null;

    // Send response with userId and success message
    return res.status(200).json({
      userId: userId,
      message: "OTP verified ✅"
    });

  } catch (err) {
    return res.status(400).json({
      message: "OTP verification failed ❌",
      error: err.message
    });
  }
};

const resetForgotPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!verifiedForgotPhone) {
      return res.status(400).json({ message: "OTP verification required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Find user by userId and check if phone matches verified one
    const user = await User.findById(userId);

    if (!user || user.phoneNumber !== verifiedForgotPhone) {
      return res.status(404).json({ message: "User not found or phone mismatch" });
    }

    // Hash and save the new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Clear temp variable
    verifiedForgotPhone = null;

    return res.status(200).json({ message: "Password reset successful ✅" });

  } catch (err) {
    return res.status(500).json({
      message: "Password reset failed ❌",
      error: err.message
    });
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
        coins: user.coins || 0
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Profile fetch failed', error: err.message });
  }
};

const uploadProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'profile_images',
      width: 400,
      height: 400,
      crop: 'fill'
    });


    // Update user image field with Cloudinary public_id
    const user = await User.findByIdAndUpdate(
      userId,
      { image: result.public_id },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      message: 'Profile image uploaded successfully ✅',
      imageUrl: cloudinary.url(result.public_id, { width: 200, height: 200, crop: 'fill' }),
      user
    });
  } catch (error) {
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
    const { street, city, state, postalCode, country, addressType } = req.body;

    // Validate required fields
    if (!street || !city || !state || !postalCode || !country) {
      return res.status(400).json({ message: 'All address fields are required ❌' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found ❌' });

    // Create the new address object
    const newAddress = {
      street,
      city,
      state,
      postalCode,
      country,
      addressType: addressType || 'Home', // Default is 'Home' if not provided
    };

    // If the user already has an address array, push the new address; otherwise, create a new array
    if (!Array.isArray(user.address)) {
      user.address = [];
    }
    user.address.push(newAddress);

    // Save the updated user document
    await user.save();

    res.status(200).json({
      message: 'Address added successfully ✅',
      address: newAddress // Return the newly added address
    });

  } catch (err) {
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
      addresses: user.address || []
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
    const { street, city, state, postalCode, country, addressType } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found ❌' });

    // Find the address by its ID
    const address = user.address.id(addressId);
    if (!address) return res.status(404).json({ message: 'Address not found ❌' });

    // Update only the fields present in the request body
    address.street = street || address.street;
    address.city = city || address.city;
    address.state = state || address.state;
    address.postalCode = postalCode || address.postalCode;
    address.country = country || address.country;
    address.addressType = addressType || address.addressType; // Defaults to 'Home' if not provided

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

    const address = user.address.id(addressId);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found ❌' });

    address.remove();
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
const createBanner = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const result = await cloudinary.uploader.upload(req.file.path);
    const newBanner = await Banner.create({ image: result.secure_url });

    fs.unlinkSync(req.file.path); // remove local file

    return res.status(201).json({ message: 'Banner created ✅', data: newBanner });
  } catch (err) {
    return res.status(500).json({ message: 'Create failed ❌', error: err.message });
  }
};

// ✅ READ ALL
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Banners fetched ✅', data: banners });
  } catch (err) {
    return res.status(500).json({ message: 'Fetch failed ❌', error: err.message });
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
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    let imageUrl = banner.image;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    banner.image = imageUrl;
    await banner.save();

    return res.status(200).json({ message: 'Banner updated ✅', data: banner });
  } catch (err) {
    return res.status(500).json({ message: 'Update failed ❌', error: err.message });
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
  deleteBanner
};
