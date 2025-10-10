const mongoose = require('mongoose');
const Cart = require('../models/cartModel');
const RestaurantProduct = require('../models/restaurantProductModel');
const Restaurant = require('../models/restaurantModel');
const User = require('../models/userModel'); // <-- make sure this is here
const Coupon = require('../models/couponModel'); // <-- ADD THIS
    
// Haversine formula to calculate distance in km (with meters in decimal)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const toRad = (val) => (val * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
// Add or update cart
exports.addToCart = async (req, res) => {
    try {
        const { userId } = req.params;
        const { products, couponId } = req.body;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId))
            return res.status(400).json({ success: false, message: "Valid userId is required." });
        if (!products || !Array.isArray(products))
            return res.status(400).json({ success: false, message: "Products array is required." });

        const user = await User.findById(userId);
        if (!user || !user.location || !user.location.coordinates)
            return res.status(400).json({ success: false, message: "User location not found." });
        const [userLon, userLat] = user.location.coordinates;

        // Load or create cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({
                userId,
                products: [],
                subTotal: 0,
                deliveryCharge: 0,
                finalAmount: 0,
                totalItems: 0,
                couponDiscount: 0,
                appliedCouponId: null
            });
        }

        let restaurantId = cart.restaurantId;

        for (const item of products) {
            const { restaurantProductId, recommendedId, addOn, quantity = 1 } = item;

            if (!mongoose.Types.ObjectId.isValid(restaurantProductId) || !mongoose.Types.ObjectId.isValid(recommendedId))
                return res.status(400).json({ success: false, message: "Invalid product IDs." });

            const restaurantProduct = await RestaurantProduct.findById(restaurantProductId);
            if (!restaurantProduct) return res.status(404).json({ success: false, message: "Restaurant product not found." });

            const recommendedItem = restaurantProduct.recommended.id(recommendedId);
            if (!recommendedItem) return res.status(404).json({ success: false, message: "Recommended item not found." });

            if (!restaurantId) restaurantId = restaurantProduct.restaurantId;

            // Base price
            let unitPrice = recommendedItem.price || 0;
            let platePrice = 0;
            const addOnClean = {};
            const hasAddons = recommendedItem.addons && (recommendedItem.addons.variation || recommendedItem.addons.plates);

            if (hasAddons && addOn) {
                if (recommendedItem.addons.variation && recommendedItem.addons.variation.type.includes("Half") && addOn.variation === "Half") {
                    addOnClean.variation = "Half";
                    unitPrice = recommendedItem.calculatedPrice?.half || Math.round(unitPrice * (recommendedItem.vendorHalfPercentage / 100));
                }
                if (recommendedItem.addons.plates && addOn.plateitems > 0) {
                    addOnClean.plateitems = addOn.plateitems;
                    platePrice = addOn.plateitems * (recommendedItem.vendor_Platecost || 0);
                }
            }

            const productData = {
                restaurantProductId,
                recommendedId,
                quantity: Math.abs(quantity),
                name: recommendedItem.name,
                basePrice: unitPrice,
                platePrice: platePrice,
                image: recommendedItem.image || ""
            };
            if (hasAddons && Object.keys(addOnClean).length > 0) productData.addOn = addOnClean;

            const existingIndex = cart.products.findIndex(
                p => p.restaurantProductId.toString() === restaurantProductId &&
                     p.recommendedId.toString() === recommendedId
            );

            if (existingIndex !== -1) {
                const newQuantity = cart.products[existingIndex].quantity + quantity;
                if (newQuantity <= 0) {
                    cart.products.splice(existingIndex, 1);
                } else {
                    cart.products[existingIndex].quantity = newQuantity;
                    cart.products[existingIndex].basePrice = unitPrice;
                    cart.products[existingIndex].platePrice = platePrice;
                    if (productData.addOn) cart.products[existingIndex].addOn = productData.addOn;
                }
            } else if (quantity > 0) {
                cart.products.push(productData);
            }
        }

        cart.restaurantId = restaurantId;

        // Recalculate totals
        let subTotal = 0;
        let totalItems = 0;
        let distanceKm = 0;

        for (const prod of cart.products) {
            subTotal += (prod.basePrice * prod.quantity) + (prod.platePrice || 0);
            totalItems += prod.quantity;
        }

        let deliveryCharge = 0;
        if (restaurantId && totalItems > 0) {
            const restaurant = await Restaurant.findById(restaurantId);
            if (restaurant && restaurant.location && restaurant.location.coordinates) {
                const [restLon, restLat] = restaurant.location.coordinates;
                distanceKm = calculateDistanceKm(userLat, userLon, restLat, restLon);
                deliveryCharge = distanceKm <= 5 ? 20 : 20 + 2 * Math.ceil(distanceKm - 5);
            } else {
                deliveryCharge = 20;
            }
        }

        // Apply coupon
let couponDiscount = 0;
let appliedCoupon = null;

if (couponId && mongoose.Types.ObjectId.isValid(couponId)) {
    const coupon = await Coupon.findById(couponId);

    if (coupon && coupon.isActive) {
        // Check if subtotal meets coupon minimum
        if (subTotal >= (coupon.minCartAmount || 0)) {
            couponDiscount = Math.floor((subTotal * coupon.discountPercentage) / 100);
            if (coupon.maxDiscountAmount) {
                couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
            }
            appliedCoupon = coupon;
        } else {
            // Cart does not meet minimum for coupon, so discount = 0
            couponDiscount = 0;
            appliedCoupon = null;
        }
    }
}

// Update cart totals
cart.subTotal = subTotal;
cart.totalItems = totalItems;
cart.deliveryCharge = totalItems === 0 ? 0 : deliveryCharge;
cart.couponDiscount = couponDiscount;
cart.appliedCouponId = appliedCoupon?._id || null;
cart.finalAmount = cart.subTotal + cart.deliveryCharge - couponDiscount;

await cart.save();

// Response
return res.status(200).json({
    success: true,
    message: "Cart updated successfully",
    distanceKm: parseFloat(distanceKm.toFixed(3)),
    cart,
    appliedCoupon: appliedCoupon
        ? {
              _id: appliedCoupon._id,
              code: appliedCoupon.code,
              discountPercentage: appliedCoupon.discountPercentage,
              maxDiscountAmount: appliedCoupon.maxDiscountAmount,
              minCartAmount: appliedCoupon.minCartAmount,
              expiresAt: appliedCoupon.expiresAt,
          }
        : null,
    couponDiscount
});

    } catch (err) {
        console.error("Cart Operation Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};
// Get all carts
exports.getAllCarts = async (req, res) => {
    try {
        const carts = await Cart.find().populate('userId', 'name email').populate('products.restaurantProductId');

        return res.status(200).json({
            success: true,
            count: carts.length,
            data: carts
        });
    } catch (err) {
        console.error("Get All Carts Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

// Get cart by user ID
exports.getCartByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Just fetch the cart without any population
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found for this user"
      });
    }

    return res.status(200).json({
      success: true,
      data: cart
    });

  } catch (err) {
    console.error("Get Cart By User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};




// Delete cart by user ID
exports.deleteCartByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const deletedCart = await Cart.findOneAndDelete({ userId });

        if (!deletedCart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found for this user"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cart deleted successfully",
            data: deletedCart
        });
    } catch (err) {
        console.error("Delete Cart By User Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

// Delete cart by cart ID
exports.deleteCartById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid cart ID"
            });
        }

        const deletedCart = await Cart.findByIdAndDelete(id);

        if (!deletedCart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cart deleted successfully",
            data: deletedCart
        });
    } catch (err) {
        console.error("Delete Cart By ID Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};




exports.updateCartItemQuantity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { restaurantProductId, recommendedId, action } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId." });
    }

    if (
      !restaurantProductId || 
      !mongoose.Types.ObjectId.isValid(restaurantProductId) || 
      !recommendedId || 
      !mongoose.Types.ObjectId.isValid(recommendedId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid product IDs." });
    }

    if (!["inc", "dec"].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be 'inc' or 'dec'." });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found." });
    }

    const index = cart.products.findIndex(
      (p) =>
        p.restaurantProductId.toString() === restaurantProductId &&
        p.recommendedId.toString() === recommendedId
    );

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Product not found in cart." });
    }

    // Update quantity
    if (action === "inc") {
      cart.products[index].quantity += 1;
    } else if (action === "dec") {
      cart.products[index].quantity -= 1;
      if (cart.products[index].quantity <= 0) {
        cart.products.splice(index, 1); // Remove item if quantity becomes 0
      }
    }

    // Recalculate totals
    let subTotal = 0;
    let totalItems = 0;
    for (const item of cart.products) {
      subTotal += (item.basePrice * item.quantity) + (item.platePrice || 0);
      totalItems += item.quantity;
    }

    cart.totalItems = totalItems;
    cart.subTotal = subTotal;

    // Recalculate delivery charge
    cart.deliveryCharge = totalItems === 0 ? 0 : 20; // Or your distance logic
    cart.finalAmount = cart.subTotal + cart.deliveryCharge - cart.couponDiscount;

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart updated successfully.",
      cart,
    });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};





// Delete product from cart
exports.deleteProductFromCart = async (req, res) => {
    try {
        const { userId, productId, recommendedId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(recommendedId)) {
            return res.status(400).json({ success: false, message: "Invalid product IDs" });
        }

        // Find the cart of user
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        // Find the index of product to remove
        const productIndex = cart.products.findIndex(p =>
            p.restaurantProductId.toString() === productId &&
            p.recommendedId.toString() === recommendedId
        );

        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not found in cart" });
        }

        // Remove the product
        cart.products.splice(productIndex, 1);

        // Recalculate totals after removal
        let subTotal = 0;
        let totalItems = 0;
        for (const prod of cart.products) {
            subTotal += (prod.basePrice * prod.quantity) + (prod.platePrice || 0);
            totalItems += prod.quantity;
        }

        // Reset restaurantId if cart is empty
        if (cart.products.length === 0) {
            cart.restaurantId = null;
            cart.deliveryCharge = 0;
            cart.couponDiscount = 0;
            cart.appliedCouponId = null;
            cart.finalAmount = 0;
            cart.subTotal = 0;
            cart.totalItems = 0;
        } else {
            // Calculate delivery charge based on restaurant location and user location
            const user = await User.findById(userId);
            if (!user || !user.location || !user.location.coordinates) {
                return res.status(400).json({ success: false, message: "User location not found." });
            }
            const [userLon, userLat] = user.location.coordinates;

            const restaurant = await Restaurant.findById(cart.restaurantId);
            let deliveryCharge = 0;
            let distanceKm = 0;

            if (restaurant && restaurant.location && restaurant.location.coordinates) {
                const [restLon, restLat] = restaurant.location.coordinates;
                distanceKm = calculateDistanceKm(userLat, userLon, restLat, restLon);
                deliveryCharge = distanceKm <= 5 ? 20 : 20 + 2 * Math.ceil(distanceKm - 5);
            } else {
                deliveryCharge = 20;
            }

            cart.subTotal = subTotal;
            cart.totalItems = totalItems;
            cart.deliveryCharge = deliveryCharge;
            cart.finalAmount = cart.subTotal + cart.deliveryCharge - (cart.couponDiscount || 0);
        }

        await cart.save();

        // Return updated cart
        return res.status(200).json({
            success: true,
            message: "Product removed from cart successfully",
            data: cart
        });

    } catch (err) {
        console.error("Delete Product From Cart Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};
