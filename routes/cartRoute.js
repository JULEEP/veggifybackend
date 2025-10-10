const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cartController'); // adjust path

// Add or update cart
router.post('/cart/:userId', cartController.addToCart);


// Get all carts (admin only)
router.get('/cart', cartController.getAllCarts);

// Get cart by user ID
router.get('/cart/user/:userId', cartController.getCartByUserId);

// Delete cart by user ID
router.delete('/cart/:userId', cartController.deleteCartByUserId);

// Delete cart by cart ID
router.delete('/cart/:id', cartController.deleteCartById);
// routes/cartRoutes.js
router.put("/update-quantity/:userId", cartController.updateCartItemQuantity);
router.delete('/deletecartproduct/:userId/:productId/:recommendedId', cartController.deleteProductFromCart);






module.exports = router;
