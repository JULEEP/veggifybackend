const express = require("express");
const router = express.Router();
const controller = require('../controllers/restaurantProductController');
const multiUpload = require('../utils/multer2');  // your multer middleware

router.post('/restaurant-products', controller.createRestaurantProduct);
router.get("/restaurant-products", controller.getAllRestaurantProducts);
router.get("/restaurant-product/:Id", controller.getByrestaurantProductId);
router.get("/restaurant-products/user/:userId", controller.getCartByUserId);
router.get("/restaurant-product/:categoryId", controller.getRestaurantProductsByCategoryId);
router.get("/restaurant-products/:restaurantId", controller.getRecommendedByRestaurantId);

router.put("/restaurant-product/:productId", controller.updateRestaurantProduct );
router.delete("/restaurant-product/:productId", controller.deleteRestaurantProduct);
// Delete recommended item
router.delete("/restaurant-products/:productId/recommended/:recommendedId",controller.deleteRecommendedByProductId);



module.exports = router;
