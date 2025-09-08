const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware,couponAuthMiddleware } = require('../utils/adminJWT');

router.post('/send-otp', adminController.sendOtp);
router.post('/verify-otp', adminController.verifyOtp);
router.post('/set-password', adminController.setPassword);
router.post('/login', adminController.login);

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


module.exports = router;
