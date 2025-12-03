const express = require("express");
const router = express.Router();
const controller = require("../controllers/foodSystemController");
const upload = require("../utils/uploadMiddleware");
const auth  = require("../utils/authMiddleware");

router.post("/category", controller.createCategory);
router.put("/category/:id", controller.updateCategory);
router.delete("/category/:id", controller.deleteCategory);
router.get("/category", controller.getAllCategories);


router.post('/veg-food', upload.single('image'), controller.createVegFood);
router.get('/veg-foods', controller.getAllVegFoods);
router.get('/veg-food/:id', controller.getVegFoodById);
router.put('/veg-food/:id', upload.single('image'), controller.updateVegFood);
router.delete('/veg-food/:id', controller.deleteVegFood);

// Public routes
// @route   POST /api/restaurants

// POST /api/restaurants - Create new restaurant
router.post('/restaurant', controller.createRestaurant);

// GET /api/restaurants - Get all restaurants
router.get('/restaurant', controller.getAllRestaurants);

// GET /api/restaurants/:id - Get single restaurant
router.get('/restaurant/:id', controller.getRestaurantById);

// PUT /api/restaurants/:id - Update restaurant (Admin only)
router.put('/restaurant/:id', controller.updateRestaurant);

// DELETE /api/restaurants/:id - Delete restaurant (Admin only)
router.delete('/restaurant/:id',controller.deleteRestaurant);

router.get('/top-nearby/:userId', controller.getTopRatedNearbyRestaurants); // ✅ Top-rated route

// GET /api/restaurants/nearby/:userId - Get nearby restaurants
router.get('/nearby/:userId',controller.getNearbyRestaurants);
router.get("/resturentbycat/:userId", controller.getNearbyRestaurantsByCategoryV2);

router.post('/add-to-wallet/:restaurantId', controller.addToWallet);
router.get('/withdrawal-requests', controller.getAllWithdrawalRequests);
router.put('/withdrawal-requests/:requestId/process', controller.processWithdrawalRequest);

// Restaurant routes
router.post('/:restaurantId/withdrawal-requests', controller.createWithdrawalRequest);
router.get('/:restaurantId/withdrawal-requests', controller.getRestaurantWithdrawalRequests);
router.get('/:restaurantId/wallet-transactions', controller.getWalletTransactions);
router.get('/:restaurantId/wallet-summary', controller.getWalletSummary);

router.get('/getwallet/:restaurantId', controller.getRestaurantWalletBalance);
router.post("/walletwithdraw/:restaurantId", controller.createWithdrawalRequest);
router.get("/allwithdrawrequest", controller.getAllWithdrawalRequests);
router.put("/withdrawalstatus/:withdrawalId", controller.updateWithdrawalStatus);
router.get('/profile/:restaurantId', controller.getRestaurantProfile);


router.get('/allrestaurant/:categoryId', controller.getRestaurantsByCategory);

router.put('/documents/:vendorId', controller.uploadRestaurantDocuments);
router.get("/getCommissions", controller.getAllCommissions);






module.exports = router;
