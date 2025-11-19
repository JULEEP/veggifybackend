const express = require('express');
const router = express.Router();
const {savePrivacyPolicy,getPrivacyPolicy} = require('../controllers/privacyPolicyController');
const {upsertAboutUs,getAboutUs} = require('../controllers/aboutUsController');
const { submitHelpUs, getAllHelpUs } = require('../controllers/helpUsControler');
const {createNotification,getAllNotifications,markAsRead,deleteNotification} = require('../controllers/notificationController');
const controller = require('../controllers/orderControler');
const enquiryController = require("../controllers/enquirycontroller");

const upload = require("../utils/up2");


// ---------- PRODUCT ROUTES ----------
router.post('/product',upload, controller.createProduct);
router.get('/products', controller.getAllProducts);
router.get('/product/:id', controller.getProductById);
router.put('/product/:id', upload, controller.updateProductById);
router.delete('/product/:id', controller.deleteProductById);


// Wishlist
router.post('/wishlist/:userId', controller.addToWishlist);
router.get('/wishlist/:userId', controller.getWishlist);
router.delete('/wishlist/:userId/:productId', controller.removeFromWishlist);


// ---------- ORDER ROUTES ----------
router.post('/createorder', controller.createOrder);
router.get('/orders', controller.getAllOrders);
router.get('/userorders/:userId', controller.getOrdersByUserId);
router.get('/userpreviousorders/:userId', controller.getPreviousOrdersByUserId);
router.get("/acceptedorders/:userId", controller.getAcceptedOrdersByUserId);
router.put('/orders/:orderId', controller.updateOrderByUserId);
router.delete('/orders/user/:userId/:orderId', controller.deleteOrderByUserId);

// Vendor accepts order
router.put('/acceptorder/:orderId/:vendorId', controller.vendorAcceptOrder);

// For Restaurant to accept an order
router.put("/restaurantaccept-order", controller.acceptOrderByRestaurant);

// For Rider to get accepted orders
router.get("/myorders/:deliveryBoyId", controller.getAcceptedOrdersForRider);

// For Rider to accept an order
router.put("/accept-order/:orderId/:deliveryBoyId", controller.acceptOrderForRider);
router.get("/myacceptedorders/:deliveryBoyId", controller.getOrdersForRider);
router.get("/mydeliveredorders/:deliveryBoyId", controller.getDeliveredOrdersForRider);
router.put('/accept-pickup/:orderId/:deliveryBoyId', controller.acceptPickupForRider);
router.get('/riderpicked-orders/:deliveryBoyId', controller.getRiderPickedOrders);
router.put('/markorder-delivered', controller.markOrderAsDelivered);
router.get('/generateupiqr', controller.generateUPIQRCode);
router.get('/mywallet/:deliveryBoyId', controller.getWalletBalanceForDeliveryBoy);
// Assign delivery partner
router.put('/order/:orderId/assign-delivery', controller.assignDeliveryAndTrack);

// Get today's bookings
router.get('/orders/today/:userId', controller.getTodaysBookingsByUserId);

// Get orders by status
router.get('/orders/:userId/:status', controller.getOrdersByStatus);
router.get('/delivered-orders/:deliveryBoyId', controller.getAllDeliveredOrders);



router.post('/help/:userId', submitHelpUs);
router.get('/help', getAllHelpUs); // Optional: only if admin needs to see the list



//privacy policy
router.post('/privacy-policy', savePrivacyPolicy);
router.get('/privacy-policy', getPrivacyPolicy);




//aboutUs
router.post('/about-us', upsertAboutUs);  
router.get('/about-us', getAboutUs); 




 //notification route
router.post('/notification', createNotification);
router.get('/notification', getAllNotifications);
router.put('/notification/read/:id', markAsRead);
router.delete('/notification/:id', deleteNotification);

router.post("/enquiries", enquiryController.createEnquiry);
router.get("/enquiries", enquiryController.getAllEnquiries);
router.get("/enquiries/:id", enquiryController.getEnquiryById);
router.put("/enquiries/:id", enquiryController.updateEnquiry);
router.delete("/enquiries/:id", enquiryController.deleteEnquiry);


// Update orderStatus by ID
router.put("/updateorders/:id", controller.updateOrderStatus);

// Delete order by ID
router.delete("/deleteorders/:id", controller.deleteOrder);



module.exports = router;
