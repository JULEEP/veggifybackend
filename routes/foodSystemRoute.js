const express = require("express");
const router = express.Router();
const controller = require("../controllers/foodSystemController");
const upload = require("../utils/uploadMiddleware");
const auth = require("../utils/authMiddleware");

// ============= CATEGORY ROUTES =============
router.post("/category", controller.createCategory);
router.put("/category/:id", controller.updateCategory);
router.delete("/category/:id", controller.deleteCategory);
router.get("/category", controller.getAllCategories);

// ============= VEG FOOD ROUTES =============
router.post('/veg-food', upload.single('image'), controller.createVegFood);
router.get('/veg-foods', controller.getAllVegFoods);
router.get('/veg-food/:id', controller.getVegFoodById);
router.put('/veg-food/:id', upload.single('image'), controller.updateVegFood);
router.delete('/veg-food/:id', controller.deleteVegFood);

// ============= RESTAURANT ROUTES =============
// 🔥 SPECIFIC ROUTES FIRST (no :id parameters)
router.post('/restaurant', controller.createRestaurant);
router.get('/allrestaurant', controller.getAllRestaurantsforAdmin);
router.get('/allpendingresturant', controller.getAllPendingRestaurants);
router.get('/nearby/:userId', controller.getNearbyRestaurants);
router.get('/top-nearby/:userId', controller.getTopRatedNearbyRestaurants);
router.get("/resturentbycat/:userId", controller.getNearbyRestaurantsByCategoryV2);

// 🔥 PARAMETERIZED ROUTES (with :id) - MOVED DOWN
router.get('/restaurant/:id', controller.getRestaurantById);
router.put('/restaurant/:id', controller.updateRestaurant);
router.delete('/restaurant/:id', controller.deleteRestaurant);

// ============= WALLET & WITHDRAWAL ROUTES =============
router.post('/add-to-wallet/:restaurantId', controller.addToWallet);
router.get('/withdrawal-requests', controller.getAllWithdrawalRequests);
router.put('/withdrawal-requests/:requestId/process', controller.processWithdrawalRequest);

// Restaurant withdrawal routes
router.post('/:restaurantId/withdrawal-requests', controller.createWithdrawalRequest);
router.get('/:restaurantId/withdrawal-requests', controller.getRestaurantWithdrawalRequests);
router.get('/:restaurantId/wallet-transactions', controller.getWalletTransactions);
router.get('/:restaurantId/wallet-summary', controller.getWalletSummary);

router.get('/getwallet/:restaurantId', controller.getRestaurantWalletBalance);
router.post("/walletwithdraw/:restaurantId", controller.createWithdrawalRequest);
router.get("/allwithdrawrequest", controller.getAllWithdrawalRequests);
router.put("/withdrawalstatus/:withdrawalId", controller.updateWithdrawalStatus);
router.delete("/withdrawal/:withdrawalId", controller.deleteWithdrawalRequest);
router.get('/profile/:restaurantId', controller.getRestaurantProfile);

router.get('/allrestaurant/:categoryId', controller.getRestaurantsByCategory);
router.put('/documents/:vendorId', controller.uploadRestaurantDocuments);
router.get("/getCommissions", controller.getAllCommissions);

module.exports = router;