const express = require("express");
const router = express.Router();
const { vendorLogin, getOrdersByVendorId, updateOrderById, deleteOrderById, getVendorProfile, getDashboardData} = require("../controllers/vendorController")

router.post("/vendorlogin", vendorLogin);
router.get("/restaurantorders/:vendorId", getOrdersByVendorId);
router.put("/orderstatus/:orderId", updateOrderById);
router.delete("/deleteorder/:orderId", deleteOrderById);
router.get("/vendorprofile/:vendorId", getVendorProfile);
router.get("/dashboard/:vendorId", getDashboardData);






module.exports = router;

