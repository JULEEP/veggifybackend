const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware,couponAuthMiddleware } = require('../utils/adminJWT');
const upload = require("../utils/uploadMiddleware");


router.post('/send-otp', adminController.sendOtp);
router.post('/verify-otp', adminController.verifyOtp);
router.post('/set-password', adminController.setPassword);
router.post('/login', adminController.login);
router.post('/register', adminController.register)
router.get('/getprofile/:adminId', adminController.getAdminByAdminId);


router.get('/getwallet/:adminId', adminController.getAdminWallet);


// Get Profile by adminId
router.get('/profile/:adminId', adminController.getProfile);

// Update Profile by adminId
router.put('/profile/:adminId', adminController.updateProfile);


// Example of protected route
router.get('/dashboard', authMiddleware, (req, res) => {
  res.json({ message: `Welcome Admin ${req.admin.phoneNumber}` });
});

// Endpoint to issue coupon token (POST, no auth required)
router.post('/token', adminController.getCouponToken);

// Create coupon
router.post('/coupons',couponAuthMiddleware, adminController.createCoupon);

// Get all coupons
router.get('/coupons',adminController.getAllCoupons);

// Get single coupon
router.get('/coupons/:couponId', adminController.getCouponById);

// Update coupon
router.put('/coupon/:couponId', adminController.updateCoupon);

// Delete coupon
router.delete('/coupon/:couponId', adminController.deleteCoupon);

// Toggle active/inactive
router.patch('/coupon/:couponId/toggle', adminController.toggleCouponStatus);
router.get('/users',adminController.getAllUsers);
router.delete('/deleteuser/:id', adminController.deleteUser);
router.get('/dashboarddata',adminController.getDashboardData);

router.post(
  "/addstaff",
  adminController.registerStaff
);
router.get('/allstaffs', adminController.getAllStaff);
router.put('/updatestaff/:id', adminController.updateStaff);
router.delete('/deletestaff/:staffId', adminController.deleteStaff);
router.post('/stafflogin', adminController.staffLogin);
router.put('/addsalary/:staffId', adminController.addSalaryToStaff);
router.post('/create', adminController.createAmount);
router.get('/get-all', adminController.getAllAmounts);
router.put('/update/:id', adminController.updateAmount);
router.delete('/delete/:id', adminController.deleteAmount);

router.get('/myprofile/:staffId', adminController.getStaffProfile);


// Create a new plan
router.post('/createplan', adminController.createPlan);
router.get('/allpnals', adminController.getAllPlans);
router.put('/updateplan/:id', adminController.updatePlan);
router.delete('/deleteplan/:id', adminController.deletePlan);
router.get('/allambsdorpayments', adminController.getAllAmbassadorPaymnet);
router.get('/getdashboard', adminController.getDashboardStats);
router.get('/getreffred', adminController.getReferredStats);


// Vendor Plan Routes
router.post('/vendorplans', adminController.createVendorPlan);
router.get('/vendorplans', adminController.getAllVendorPlans);
router.get('/vendorplans/:id', adminController.getVendorPlanById);
router.put('/vendorplans/:id', adminController.updateVendorPlan);
router.delete('/vendorplans/:id', adminController.deleteVendorPlan);


// //charges

// // Get all charges
router.get('/allcharge', adminController.getAllCharges);

// Get single charge
router.get('/:id', adminController.getCharge);

// Create new charge
router.post('/createcharge', adminController.createCharge);

// Update charge
router.put('/updatecharge/:id', adminController.updateCharge);

// Delete charge
router.delete('/deletecharge/:id', adminController.deleteCharge);


// ------------------- GET ALL -------------------

// ------------------- CREATE -------------------
// Create a new commission
router.post("/addCommission", adminController.createCommission);

// Update a commission by ID
router.put("/updateCommission/:id", adminController.updateCommission);

// Delete a commission by ID
router.delete("/deleteCommission/:id", adminController.deleteCommission);



router.post('/addReferralReward', adminController.addReferralReward);

router.get('/getReferralRewards', adminController.getReferralRewards);

// Update charge
router.put('/updateReferralReward/:id', adminController.updateReferralReward);

// Delete charge
router.delete('/deleteReferralReward/:id', adminController.deleteReferralReward);

router.post('/forgot-password', adminController.forgotPassword);
router.post('/reset-password', adminController.resetPassword);


// Add credential
router.post('/addcredential', adminController.addCredential);

// Get all credentials

// Update credential
router.put('/updatecredential/:credentialId', adminController.updateCredential);

// Delete credential
router.delete('/deletecredential/:credentialId', adminController.deleteCredential);


module.exports = router;
