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
// exports.addToCart = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { products, couponId } = req.body;

//         if (!userId || !mongoose.Types.ObjectId.isValid(userId))
//             return res.status(400).json({ success: false, message: "Valid userId is required." });
//         if (!products || !Array.isArray(products))
//             return res.status(400).json({ success: false, message: "Products array is required." });

//         const user = await User.findById(userId);
//         if (!user || !user.location || !user.location.coordinates)
//             return res.status(400).json({ success: false, message: "User location not found." });
//         const [userLon, userLat] = user.location.coordinates;

//         // Load or create cart
//         let cart = await Cart.findOne({ userId });
//         if (!cart) {
//             cart = new Cart({
//                 userId,
//                 products: [],
//                 subTotal: 0,
//                 deliveryCharge: 0,
//                 finalAmount: 0,
//                 totalItems: 0,
//                 couponDiscount: 0,
//                 appliedCouponId: null
//             });
//         }

//         let restaurantId = cart.restaurantId;

//         for (const item of products) {
//             const { restaurantProductId, recommendedId, addOn, quantity = 1 } = item;

//             if (!mongoose.Types.ObjectId.isValid(restaurantProductId) || !mongoose.Types.ObjectId.isValid(recommendedId))
//                 return res.status(400).json({ success: false, message: "Invalid product IDs." });

//             const restaurantProduct = await RestaurantProduct.findById(restaurantProductId);
//             if (!restaurantProduct) return res.status(404).json({ success: false, message: "Restaurant product not found." });

//             const recommendedItem = restaurantProduct.recommended.id(recommendedId);
//             if (!recommendedItem) return res.status(404).json({ success: false, message: "Recommended item not found." });

//             if (!restaurantId) restaurantId = restaurantProduct.restaurantId;

//             // Base price
//             let unitPrice = recommendedItem.price || 0;
//             let platePrice = 0;
//             const addOnClean = {};
//             const hasAddons = recommendedItem.addons && (recommendedItem.addons.variation || recommendedItem.addons.plates);

//             if (hasAddons && addOn) {
//                 if (recommendedItem.addons.variation && recommendedItem.addons.variation.type.includes("Half") && addOn.variation === "Half") {
//                     addOnClean.variation = "Half";
//                     unitPrice = recommendedItem.calculatedPrice?.half || Math.round(unitPrice * (recommendedItem.vendorHalfPercentage / 100));
//                 }
//                 if (recommendedItem.addons.plates && addOn.plateitems > 0) {
//                     addOnClean.plateitems = addOn.plateitems;
//                     platePrice = addOn.plateitems * (recommendedItem.vendor_Platecost || 0);
//                 }
//             }

//             const productData = {
//                 restaurantProductId,
//                 recommendedId,
//                 quantity: Math.abs(quantity),
//                 name: recommendedItem.name,
//                 basePrice: unitPrice,
//                 platePrice: platePrice,
//                 image: recommendedItem.image || ""
//             };
//             if (hasAddons && Object.keys(addOnClean).length > 0) productData.addOn = addOnClean;

//             const existingIndex = cart.products.findIndex(
//                 p => p.restaurantProductId.toString() === restaurantProductId &&
//                      p.recommendedId.toString() === recommendedId
//             );

//             if (existingIndex !== -1) {
//                 const newQuantity = cart.products[existingIndex].quantity + quantity;
//                 if (newQuantity <= 0) {
//                     cart.products.splice(existingIndex, 1);
//                 } else {
//                     cart.products[existingIndex].quantity = newQuantity;
//                     cart.products[existingIndex].basePrice = unitPrice;
//                     cart.products[existingIndex].platePrice = platePrice;
//                     if (productData.addOn) cart.products[existingIndex].addOn = productData.addOn;
//                 }
//             } else if (quantity > 0) {
//                 cart.products.push(productData);
//             }
//         }

//         cart.restaurantId = restaurantId;

//         // Recalculate totals
//         let subTotal = 0;
//         let totalItems = 0;
//         let distanceKm = 0;

//         for (const prod of cart.products) {
//             subTotal += (prod.basePrice * prod.quantity) + (prod.platePrice || 0);
//             totalItems += prod.quantity;
//         }

//         let deliveryCharge = 0;
//         if (restaurantId && totalItems > 0) {
//             const restaurant = await Restaurant.findById(restaurantId);
//             if (restaurant && restaurant.location && restaurant.location.coordinates) {
//                 const [restLon, restLat] = restaurant.location.coordinates;
//                 distanceKm = calculateDistanceKm(userLat, userLon, restLat, restLon);
//                 deliveryCharge = distanceKm <= 5 ? 20 : 20 + 2 * Math.ceil(distanceKm - 5);
//             } else {
//                 deliveryCharge = 20;
//             }
//         }

//         // Apply coupon
// let couponDiscount = 0;
// let appliedCoupon = null;

// if (couponId && mongoose.Types.ObjectId.isValid(couponId)) {
//     const coupon = await Coupon.findById(couponId);

//     if (coupon && coupon.isActive) {
//         // Check if subtotal meets coupon minimum
//         if (subTotal >= (coupon.minCartAmount || 0)) {
//             couponDiscount = Math.floor((subTotal * coupon.discountPercentage) / 100);
//             if (coupon.maxDiscountAmount) {
//                 couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
//             }
//             appliedCoupon = coupon;
//         } else {
//             // Cart does not meet minimum for coupon, so discount = 0
//             couponDiscount = 0;
//             appliedCoupon = null;
//         }
//     }
// }

// // Update cart totals
// cart.subTotal = subTotal;
// cart.totalItems = totalItems;
// cart.deliveryCharge = totalItems === 0 ? 0 : deliveryCharge;
// cart.couponDiscount = couponDiscount;
// cart.appliedCouponId = appliedCoupon?._id || null;
// cart.finalAmount = cart.subTotal + cart.deliveryCharge - couponDiscount;

// await cart.save();

// // Response
// return res.status(200).json({
//     success: true,
//     message: "Cart updated successfully",
//     distanceKm: parseFloat(distanceKm.toFixed(3)),
//     cart,
//     appliedCoupon: appliedCoupon
//         ? {
//               _id: appliedCoupon._id,
//               code: appliedCoupon.code,
//               discountPercentage: appliedCoupon.discountPercentage,
//               maxDiscountAmount: appliedCoupon.maxDiscountAmount,
//               minCartAmount: appliedCoupon.minCartAmount,
//               expiresAt: appliedCoupon.expiresAt,
//           }
//         : null,
//     couponDiscount
// });

//     } catch (err) {
//         console.error("Cart Operation Error:", err);
//         return res.status(500).json({ success: false, message: "Server error", error: err.message });
//     }
// };




// ----------------------------------------
// 👉 ADD TO CART (All calculations inline)
exports.addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { products } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    let cart = await Cart.findOne({ userId });

    // Create cart if not exists
    if (!cart) {
      cart = new Cart({
        userId,
        products: [],
        subTotal: 0,
        totalItems: 0,
        totalDiscount: 0,
        deliveryCharge: 0,
        platformCharge: 10,
        gstAmount: 0,
        finalAmount: 0
      });
    }

    for (const item of products) {
      const { restaurantProductId, recommendedId, quantity = 1, isHalfPlate, isFullPlate } = item;

      const productData = await RestaurantProduct.findById(restaurantProductId);
      if (!productData) continue;
      const recommendedItem = productData.recommended.id(recommendedId);
      if (!recommendedItem) continue;

      // ------------------- CLEAR CART IF DIFFERENT RESTAURANT -------------------
      if (
        cart.restaurantId &&
        cart.restaurantId.toString() !== productData.restaurantId.toString()
      ) {
        // Different restaurant → clear all products
        cart.products = [];
      }

      // Assign restaurant ID
      cart.restaurantId = productData.restaurantId;

      // ------------------- PRICE CALC -------------------
      let basePrice = recommendedItem.price;
      if (isHalfPlate) basePrice = recommendedItem.halfPlatePrice || recommendedItem.price;
      if (isFullPlate) basePrice = recommendedItem.fullPlatePrice || recommendedItem.price;

      const discountPercent = recommendedItem.discount || 0;
      const discountAmount = (basePrice * discountPercent) / 100;
      const finalPrice = basePrice - discountAmount;

      // ------------------- CREATE PRODUCT OBJECT -------------------
      const newProduct = {
        restaurantProductId,
        recommendedId,
        quantity,
        name: recommendedItem.name,
        image: recommendedItem.image,
        isHalfPlate: !!isHalfPlate,
        isFullPlate: !!isFullPlate,
        originalPrice: basePrice,
        discountPercent,
        discountAmount: Number(discountAmount.toFixed(2)),
        price: Number(finalPrice.toFixed(2))
      };

      // ------------------- ADD OR UPDATE -------------------
      const existingIndex = cart.products.findIndex(
        p =>
          p.restaurantProductId.toString() === restaurantProductId &&
          p.recommendedId.toString() === recommendedId &&
          p.isHalfPlate === !!isHalfPlate &&
          p.isFullPlate === !!isFullPlate
      );

      if (existingIndex !== -1) {
        // Product already exists → update quantity
        cart.products[existingIndex].quantity += quantity;
      } else {
        // New product → add to cart
        cart.products.push(newProduct);
      }
    }

    // ------------------- TOTAL CALCULATIONS -------------------
    let subTotal = 0;
    let totalItems = 0;
    let totalDiscount = 0;

    cart.products.forEach(p => {
      subTotal += p.price * p.quantity;
      totalItems += p.quantity;
      totalDiscount += (p.discountAmount || 0) * p.quantity;
    });

    cart.subTotal = Number(subTotal.toFixed(2));
    cart.totalItems = totalItems;
    cart.totalDiscount = Number(totalDiscount.toFixed(2));

    cart.discount = cart.products.length > 0 ? cart.products[0].discountPercent : 0;
    cart.gstAmount = Number((subTotal * 0.05).toFixed(2));
    cart.deliveryCharge = cart.products.length > 0 ? 20 : 0;
    cart.platformCharge = cart.products.length > 0 ? 10 : 0;
    cart.finalAmount = Number(
      (subTotal + cart.gstAmount + cart.deliveryCharge + cart.platformCharge).toFixed(2)
    );

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      cart
    });

  } catch (error) {
    console.error("addToCart Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
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
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // Fetch the cart
    const cart = await Cart.findOne({ userId }).lean();
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found for this user" });
    }

    // Populate recommended product details and restaurant status
    const updatedProducts = await Promise.all(cart.products.map(async (p) => {
      // Fetch recommended item details
      const productDoc = await RestaurantProduct.findById(p.restaurantProductId)
        .select("recommended restaurantId")
        .populate({
          path: "restaurantId",
          select: "restaurantName locationName status"
        })
        .lean();

      if (!productDoc) return p;

      const recommendedItem = productDoc.recommended.find(r => r._id.toString() === p.recommendedId.toString());

      const restaurant = productDoc.restaurantId;

      return {
        ...p, // quantity, isHalfPlate, isFullPlate, etc.
        recommended: recommendedItem || null, // full recommended details
        restaurant: restaurant
          ? {
              restaurantId: restaurant._id,
              restaurantName: restaurant.restaurantName,
              locationName: restaurant.locationName,
              status: restaurant.status
            }
          : null
      };
    }));

    cart.products = updatedProducts;

    res.status(200).json({
      success: true,
      data: cart
    });

  } catch (err) {
    console.error("Get Cart By User Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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




// ----------------------------------------
// 2️⃣ Update Cart Item Quantity
// Helper: calculate distance in km (Haversine formula)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = val => (val * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

exports.updateCartItemQuantity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { restaurantProductId, recommendedId, action, isHalfPlate, isFullPlate } = req.body;

    // ---------------- Validate input ----------------
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Invalid userId." });

    if (!restaurantProductId || !mongoose.Types.ObjectId.isValid(restaurantProductId) ||
        !recommendedId || !mongoose.Types.ObjectId.isValid(recommendedId))
      return res.status(400).json({ success: false, message: "Invalid product IDs." });

    if (!["inc", "dec"].includes(action))
      return res.status(400).json({ success: false, message: "Action must be 'inc' or 'dec'." });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });

    // ---------------- Find product in cart ----------------
    const index = cart.products.findIndex(p =>
      p.restaurantProductId.toString() === restaurantProductId &&
      p.recommendedId.toString() === recommendedId &&
      (isHalfPlate === undefined || p.isHalfPlate === isHalfPlate) &&
      (isFullPlate === undefined || p.isFullPlate === isFullPlate)
    );

    if (index === -1)
      return res.status(404).json({ success: false, message: "Product not found in cart." });

    // ---------------- Update quantity ----------------
    if (action === "inc") {
      cart.products[index].quantity += 1;
    } else {
      cart.products[index].quantity -= 1;
      if (cart.products[index].quantity <= 0) cart.products.splice(index, 1);
    }

    // ---------------- Recalculate cart totals ----------------
    let subTotal = 0, totalItems = 0, totalDiscount = 0;
    cart.products.forEach(p => {
      subTotal += p.price * p.quantity;
      totalItems += p.quantity;
      totalDiscount += (p.discountAmount || 0) * p.quantity;
    });

    cart.subTotal = Number(subTotal.toFixed(2));
    cart.totalItems = totalItems;
    cart.totalDiscount = Number(totalDiscount.toFixed(2));

    // GST 5%
    cart.gstAmount = Number((subTotal * 0.05).toFixed(2));

    // Delivery charge (distance-based)
    let deliveryCharge = 0;
    if (totalItems > 0 && cart.restaurantId) {
      const user = await User.findById(userId);
      const restaurant = await Restaurant.findById(cart.restaurantId);
      const [userLon, userLat] = user.location.coordinates;
      const [restLon, restLat] = restaurant.location.coordinates;
      const distanceKm = calculateDistanceKm(userLat, userLon, restLat, restLon);
      cart.distanceKm = Number(distanceKm.toFixed(2));
      const baseCharge = 20;
      deliveryCharge = distanceKm <= 5 ? baseCharge : baseCharge + 2 * Math.ceil(distanceKm - 5);
    } else cart.distanceKm = 0;

    cart.deliveryCharge = deliveryCharge;

    // Keep platformCharge from cart, initialize if missing
    if (!cart.platformCharge) cart.platformCharge = 10;

    // Cart-level discount % (first product as reference)
    cart.discount = cart.products.length > 0 ? cart.products[0].discountPercent : 0;

    // Final amount
    cart.finalAmount = Number(
      (subTotal + cart.gstAmount + cart.deliveryCharge + cart.platformCharge).toFixed(2)
    );

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      cart
    });

  } catch (err) {
    console.error("updateCartItemQuantity Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};





// ----------------------------------------
// 3️⃣ Delete Product From Cart
exports.deleteProductFromCart = async (req, res) => {
  try {
    const { userId, productId, recommendedId } = req.params;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(recommendedId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid IDs" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // ------ FIND ONLY FIRST MATCH (without needing half/full plate) ------
    const index = cart.products.findIndex(
      p =>
        p.restaurantProductId.toString() === productId &&
        p.recommendedId.toString() === recommendedId
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart.",
      });
    }

    // Remove exactly that item
    cart.products.splice(index, 1);

    // ---------------- RECALCULATE TOTALS ----------------
    let subTotal = 0;
    let totalItems = 0;
    let totalDiscount = 0;

    for (const p of cart.products) {
      subTotal += p.price * p.quantity;
      totalItems += p.quantity;
      totalDiscount += (p.discountAmount || 0) * p.quantity;
    }

    cart.subTotal = Number(subTotal.toFixed(2));
    cart.totalItems = totalItems;
    cart.totalDiscount = Number(totalDiscount.toFixed(2));

    cart.discount = cart.products.length > 0 ? cart.products[0].discountPercent : 0;
    cart.gstAmount = Number((subTotal * 0.05).toFixed(2));

    cart.deliveryCharge = cart.products.length > 0 ? 20 : 0;
    cart.platformCharge = cart.products.length > 0 ? 10 : 0;

    cart.finalAmount = Number(
      (subTotal + cart.gstAmount + cart.deliveryCharge + cart.platformCharge).toFixed(2)
    );

    // If cart empty → reset all
    if (cart.products.length === 0) {
      cart.restaurantId = null;
      cart.subTotal = 0;
      cart.totalItems = 0;
      cart.totalDiscount = 0;
      cart.gstAmount = 0;
      cart.deliveryCharge = 0;
      cart.platformCharge = 0;
      cart.finalAmount = 0;
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Product removed successfully",
      cart
    });

  } catch (error) {
    console.error("deleteProductFromCart Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// Apply coupon on existing cart
exports.applyCouponToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { couponCode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.products.length === 0) {
      return res.status(404).json({ success: false, message: "Cart is empty" });
    }

    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (!coupon) {
      return res.status(400).json({ success: false, message: "Invalid or inactive coupon" });
    }

    // Check minimum cart amount
    if (cart.subTotal < (coupon.minCartAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: `Minimum cart value of ₹${coupon.minCartAmount} required to apply this coupon.`,
      });
    }

    // Calculate discount
    let couponDiscount = Math.floor((cart.subTotal * coupon.discountPercentage) / 100);
    if (coupon.maxDiscountAmount) {
      couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
    }

    // Update cart totals
    cart.couponDiscount = couponDiscount;
    cart.appliedCouponId = coupon._id;
    cart.finalAmount = cart.subTotal + cart.deliveryCharge - couponDiscount;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        cart,
        coupon: {
          code: coupon.code,
          discountPercentage: coupon.discountPercentage,
          maxDiscountAmount: coupon.maxDiscountAmount,
          minCartAmount: coupon.minCartAmount,
          expiresAt: coupon.expiresAt,
        },
        couponDiscount,
      },
    });
  } catch (err) {
    console.error("Apply Coupon Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
