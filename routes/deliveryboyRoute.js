const express = require("express");
const router = express.Router();
const DeliveryBoy  = require("../controllers/deliveryBoyController");
const multer = require("multer");

// Setup multer for file uploads
const storage = multer.diskStorage({});
const upload = multer({ storage });

router.post("/register", DeliveryBoy. registerDeliveryBoy);


router.post("/login", DeliveryBoy.requestLoginOTP); 
router.post("/resendotp", DeliveryBoy.resendLoginOTP); 
router.post("/verify-otp", DeliveryBoy.verifyLoginOTP);  
// Update delivery boy profile (email and/or image)
router.put(
  "/profile/:userId",
  upload.fields([{ name: "image", maxCount: 1 }]),
  DeliveryBoy.updateProfile
);

// Get full delivery boy profile
router.get("/profile/:userId", DeliveryBoy.getProfile);
router.put("/location/:deliveryBoyId", DeliveryBoy.updateLocation);
router.get("/location/:deliveryBoyId/:userId", DeliveryBoy.getLiveLocation);
router.put('/updateprofile/:deliveryBoyId', DeliveryBoy.updateDeliveryBoy);


// Assign order to nearby delivery boys (within 8 km)
router.post("/assign-order", DeliveryBoy.assignOrder);

// Delivery boy accepts order (cancels other assignments)
router.post("/accept-order", DeliveryBoy.acceptOrder);

// Assign delivery boy and track location (real-time)
router.put("/track-delivery", DeliveryBoy.assignDeliveryAndTrack);

// Update delivery status (Picked or Delivered)
router.post("/update-status", DeliveryBoy.updateDeliveryStatus);

// Get daily stats (orders, cancelled, completed)
router.get("/daily-stats", DeliveryBoy.getDailyStats);



router.get('/alldeliveryboy', DeliveryBoy.getAllDeliveryBoys);
router.get('/activealldeliveryboy', DeliveryBoy.getAllActiveDeliveryBoys);
router.delete('/deletedeliveryboy/:id', DeliveryBoy.deleteDeliveryBoy); // DELETE Delivery Boy by ID
router.get('/notification', DeliveryBoy.getAllNotifications); // GET All Delivery Boys
router.delete('/deletenotification/:notificationId', DeliveryBoy.deleteNotification);
// Add these to your delivery-boy routes
router.put('/set-base-delivery-charge', DeliveryBoy.setBaseDeliveryCharge);
router.put('/update-delivery-charge/:id', DeliveryBoy.updateDeliveryBoyCharge);
router.post('/add-account/:deliveryBoyId', DeliveryBoy.addAccountDetails);
router.get('/get-account/:deliveryBoyId', DeliveryBoy.getAccountDetails);

router.post('/withdraw/:deliveryBoyId', DeliveryBoy.withdrawAmount);

router.get('/allwithdrawals', DeliveryBoy.getAllWithdrawals); 
router.put('/withdrawalstatus/:withdrawalId', DeliveryBoy.updateWithdrawalStatus); 
router.get('/myprofile/:deliveryBoyId', DeliveryBoy.getDeliveryBoyProfile);
router.put('/updateProfileImage/:deliveryBoyId', DeliveryBoy.updateProfileImage);
router.get('/mydashboard/:deliveryBoyId', DeliveryBoy.getDeliveryBoyDashboard);
router.put('/deliveryboystatus/:deliveryBoyId', DeliveryBoy.updateDeliveryBoyStatus);
router.put('/updatedeliverybody/:deliveryBoyId', DeliveryBoy.updateDeliveryBoy);


router.delete('/deletemyaccount/:deliveryBoyId', DeliveryBoy.deleteDeliveryBoy);


router.post('/deleteaccount', DeliveryBoy.deleteDeliveryBoyRequest);

// Route: Confirm account deletion (via email link)
router.get('/confirm-delete-account/:token', DeliveryBoy.confirmDeleteDeliveryBoy);
module.exports = router;
