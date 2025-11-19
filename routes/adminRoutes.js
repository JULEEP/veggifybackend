const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware,couponAuthMiddleware } = require('../utils/adminJWT');
const upload = require("../utils/uploadMiddleware");


router.post('/send-otp', adminController.sendOtp);
router.post('/verify-otp', adminController.verifyOtp);
router.post('/set-password', adminController.setPassword);
router.post('/login', adminController.login);
router.get('/getprofile/:adminId', adminController.getAdminByAdminId);


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

// Create a new plan
router.post('/createplan', adminController.createPlan);
router.get('/allpnals', adminController.getAllPlans);
router.put('/updateplan/:id', adminController.updatePlan);
router.delete('/deleteplan/:id', adminController.deletePlan);
router.get('/allambsdorpayments', adminController.getAllAmbassadorPaymnet);
router.get('/getdashboard', adminController.getDashboardStats);
router.get('/getreffred', adminController.getReferredStats);




module.exports = router;
