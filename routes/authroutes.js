const express = require('express');
const router = express.Router();

const {
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
  
} = require('../controllers/userController');
const upload = require('../utils/multer');


// 🔐 Authentication Flow
router.post('/register', register);              // Step 1: Register with referralCode (optional)
router.post('/verify-otp', verifyOtp);          // Step 2: OTP verification (fixed OTP 1234)
router.get('/referral/:userId', getReferralCodeByUserId);
router.post('/set-password/:userId', setPassword);       // Step 3: Set password after OTP
router.post('/login', login);    
router.post('/forgot-password/send-otp', sendForgotOtp);
router.post('/forgot-password/verify-otp', verifyForgotOtp);
router.post('/forgot-password/reset/:userId', resetForgotPassword); // Example
// 👤 User Profile
// Route to get user profile by userId
router.get('/users/:userId/profile', getProfile);

router.put('/users/:userId/profile-image', upload.single('image'), uploadProfileImage);

// Delete profile image by userId
router.delete('/users/:userId/profile-image', deleteProfileImage);


// ➕ Add address
router.post("/addaddress/:userId", addAddress);
// Get all addresses for a user
router.get('/user/:userId/addresses', getAllAddresses);

// Get a single address by addressId for a user
router.get('/users/:userId/addresses/:addressId', getAddressById);

// Update an address by addressId for a user
router.put('/updateaddresses/:userId/:addressId', updateAddressById);

// Delete an address by addressId for a user
router.delete('/deleteaddresses/:userId/:addressId', deleteAddressById);


// POST location (only once)
router.post('/location/:userId', postLocation);

// PUT location (update)
router.put('/location/:userId', updateLocation);

// GET location
router.get('/location/:userId', getLocation);


// 🎁 Referral Info
router.get('/referral/:userId', getReferralByUserId)// Get referralCode & coins






// Create banner (image upload)
router.post('/banner', upload.single('image'), createBanner);

// Get all banners
router.get('/banners', getAllBanners);

// Get single banner by ID
router.get('/banners/:id', getBannerById);

// Update banner image
router.put('/banners/:id', upload.single('image'), updateBanner);

// Delete banner
router.delete('/banners/:id', deleteBanner);




module.exports = router;
