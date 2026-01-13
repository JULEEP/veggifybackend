const express = require("express");
const router = express.Router();
const { vendorLogin, getOrdersByVendorId, updateOrderById, deleteOrderById, getVendorProfile, getDashboardData, getAllUsersByRestaurant, captureVendorPayment, getVendorPaymentDetails, getAllVendorPayments, getVendorStatus, updateVendorStatus, verifyOtp, forgotPassword, resetPasswordWithOtp, addAccount, getVendorAccounts, updateAccount, deleteAccount, getRestaurantNotifications, getAllOrdersByRestaurant, updateVendorPaymentStatus, deleteVendorPayment, deleteRestaurantAccount, confirmDeleteRestaurantAccount, deleteRestaurantByAdmin} = require("../controllers/vendorController");

router.post("/vendorlogin", vendorLogin);
router.post("/verify-otp", verifyOtp);
router.get("/restaurantorders/:vendorId", getOrdersByVendorId);
router.put("/orderstatus/:orderId", updateOrderById);
router.delete("/deleteorder/:orderId", deleteOrderById);
router.get("/vendorprofile/:vendorId", getVendorProfile);
router.get("/dashboard/:vendorId", getDashboardData);
router.get("/allusers/:restaurantId", getAllUsersByRestaurant);
router.get("/alluserorders/:restaurantId", getAllOrdersByRestaurant);
router.post("/pay/:vendorId", captureVendorPayment);
router.get("/myplan/:vendorId", getVendorPaymentDetails);
router.get("/vendorpayments", getAllVendorPayments);
router.get("/vendorstatus/:vendorId", getVendorStatus);
router.put("/vendorstatus/:vendorId", updateVendorStatus);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPasswordWithOtp);


router.post('/createaccounts', addAccount);
router.get('/allaccounts/:vendorId', getVendorAccounts);
router.put('/updateaccount/:id', updateAccount);
router.delete('/deleteaccount/:id', deleteAccount);
router.get('/notification/:vendorId', getRestaurantNotifications);
router.put('/vendorpayments/:id', updateVendorPaymentStatus);
router.delete('/deletevendorpayment/:id', deleteVendorPayment);



router.post('/deleteaccount', deleteRestaurantAccount);

// Route: Confirm account deletion (via email link)
router.get('/confirm-delete-account/:token', confirmDeleteRestaurantAccount);

// Route: Delete user by ID (admin)
router.delete('/delete-vendor/:userId', deleteRestaurantByAdmin);









module.exports = router;

