const express = require("express");
const router = express.Router();
const { vendorLogin, getOrdersByVendorId, updateOrderById, deleteOrderById, getVendorProfile, getDashboardData, getAllUsersByRestaurant, captureVendorPayment, getVendorPaymentDetails, getAllVendorPayments, getVendorStatus, updateVendorStatus, verifyOtp} = require("../controllers/vendorController");

router.post("/vendorlogin", vendorLogin);
router.post("/verify-otp", verifyOtp);
router.get("/restaurantorders/:vendorId", getOrdersByVendorId);
router.put("/orderstatus/:orderId", updateOrderById);
router.delete("/deleteorder/:orderId", deleteOrderById);
router.get("/vendorprofile/:vendorId", getVendorProfile);
router.get("/dashboard/:vendorId", getDashboardData);
router.get("/allusers/:restaurantId", getAllUsersByRestaurant);
router.post("/pay/:vendorId", captureVendorPayment);
router.get("/myplan/:vendorId", getVendorPaymentDetails);
router.get("/vendorpayments", getAllVendorPayments);
router.get("/vendorstatus/:vendorId", getVendorStatus);
router.put("/vendorstatus/:vendorId", updateVendorStatus);










module.exports = router;

