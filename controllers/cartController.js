const mongoose = require('mongoose');
const Cart = require('../models/cartModel');
const RestaurantProduct = require('../models/restaurantProductModel');
const Restaurant = require('../models/restaurantModel');
const User = require('../models/userModel'); // <-- make sure this is here
const Coupon = require('../models/couponModel'); // <-- ADD THIS
    
// Haversine formula to calculate distance in km (with meters in decimal)
// function calculateDistanceKm(lat1, lon1, lat2, lon2) {
//     const toRad = (val) => (val * Math.PI) / 180;
//     const R = 6371; // Earth's radius in km
//     const dLat = toRad(lat2 - lat1);
//     const dLon = toRad(lon2 - lon1);
//     const a =
//         Math.sin(dLat / 2) ** 2 +
//         Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return R * c;
// }
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



const axios = require('axios');

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

// Helper function to fetch charges from API
const fetchCharges = async () => {
  try {
    const response = await axios.get('http://31.97.206.144:5051/api/admin/allcharge');
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error('Failed to fetch charges from API');
  } catch (error) {
    console.error('Error fetching charges:', error);
    throw new Error('Charges API failed. Please try again.');
  }
};

// Helper function to calculate delivery charge based on deliveryMethod
const calculateDeliveryCharge = (distance, deliveryMethod, amount, perKmRate, minDistance, maxDistance, baseRate) => {
  console.log('Delivery Calculation Input:', {
    distance,
    deliveryMethod,
    amount,
    perKmRate,
    minDistance,
    maxDistance,
    baseRate
  });

  if (!distance || distance <= 0) return 0;

  let deliveryCharge = 0;

  switch(deliveryMethod) {
    case "flat_rate":
      // Flat rate: Use only amount, ignore distance
      deliveryCharge = amount || 0;
      console.log(`Flat rate calculation: amount = ${amount}, charge = ${deliveryCharge}`);
      break;

    case "per_km":
      // Per km: amount × distance
      if (amount && distance) {
        deliveryCharge = amount * distance;
      } else {
        deliveryCharge = 0;
      }
      console.log(`Per km calculation: amount = ${amount}, distance = ${distance}, charge = ${deliveryCharge}`);
      break;

    case "slab_based":
      // Slab based: Check if distance falls within min-max range
      if (minDistance && maxDistance) {
        if (distance >= minDistance && distance <= maxDistance) {
          // Distance within slab: Use amount
          deliveryCharge = amount || 0;
          console.log(`Slab based - Within range: amount = ${amount}, charge = ${deliveryCharge}`);
        } else if (distance > maxDistance) {
          // Distance beyond max: amount + (perKmRate × distance)
          const extraDistance = distance - maxDistance;
          const extraCharge = extraDistance * (perKmRate || 0);
          deliveryCharge = (amount || 0) + extraCharge;
          console.log(`Slab based - Beyond max: amount = ${amount}, extraDistance = ${extraDistance}, perKmRate = ${perKmRate}, extraCharge = ${extraCharge}, total = ${deliveryCharge}`);
        } else {
          // Distance less than min: Use amount
          deliveryCharge = amount || 0;
          console.log(`Slab based - Less than min: amount = ${amount}, charge = ${deliveryCharge}`);
        }
      } else {
        // No slab defined: Use amount
        deliveryCharge = amount || 0;
        console.log(`Slab based - No slab defined: amount = ${amount}, charge = ${deliveryCharge}`);
      }
      break;

    default:
      // Default: Use amount
      deliveryCharge = amount || 0;
      console.log(`Default calculation: amount = ${amount}, charge = ${deliveryCharge}`);
  }

  return Math.round(deliveryCharge * 100) / 100;
};

// Helper function to get active charge
const getActiveCharge = (charges, chargeType) => {
  const charge = charges.find(c => c.type === chargeType && c.isActive === true);
  if (!charge) {
    throw new Error(`Active charge not found for type: ${chargeType}`);
  }
  return charge;
};

// Helper function to get free delivery threshold from charges
const getFreeDeliveryThreshold = (charges) => {
  try {
    const freeDeliveryCharge = charges.find(c => 
      c.type === 'free_delivery_threshold' && c.isActive === true
    );
    
    if (freeDeliveryCharge && freeDeliveryCharge.freeDeliveryThreshold) {
      return freeDeliveryCharge.freeDeliveryThreshold;
    }
    
    // Default value if not found
    return 499;
  } catch (error) {
    console.error('Error getting free delivery threshold:', error);
    return 499; // Default fallback
  }
};

// Main addToCart function with AUTO distance calculation
// Main addToCart function with AUTO distance calculation
exports.addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { products } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Fetch charges from API
    const allCharges = await fetchCharges();
    
    // Get only active charges
    const activeCharges = allCharges.filter(charge => charge.isActive === true);
    
    // Extract specific charges
    const deliveryChargeObj = getActiveCharge(activeCharges, 'delivery_charge');
    const gstChargesObj = getActiveCharge(activeCharges, 'gst_charges');
    const platformChargeObj = getActiveCharge(activeCharges, 'platform_charge');
    const gstOnDeliveryObj = getActiveCharge(activeCharges, 'gst_on_delivery');
    
    // ✅ Get free delivery threshold from API
    const freeDeliveryThreshold = getFreeDeliveryThreshold(activeCharges);

    console.log('Charges Configuration:', {
      deliveryCharge: {
        amount: deliveryChargeObj.amount,
        deliveryMethod: deliveryChargeObj.deliveryMethod,
        perKmRate: deliveryChargeObj.perKmRate,
        minDistance: deliveryChargeObj.minDistance,
        maxDistance: deliveryChargeObj.maxDistance,
        baseRate: deliveryChargeObj.baseRate
      },
      platformCharge: {
        amount: platformChargeObj.amount,
        chargeType: platformChargeObj.chargeType,
        note: 'Fixed amount: ₹' + platformChargeObj.amount
      },
      freeDeliveryThreshold: {
        value: freeDeliveryThreshold,
        note: 'From API configuration'
      }
    });

    // Get user details with address
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if user has addresses
    if (!user.addresses || user.addresses.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Please add a delivery address first" 
      });
    }

    // Get user's primary address (first address)
    const userAddress = user.addresses[0];
    const userLocation = userAddress.location;
    
    console.log('User Address:', {
      street: userAddress.street,
      city: userAddress.city,
      coordinates: userLocation.coordinates
    });

    let cart = await Cart.findOne({ userId });
    let restaurantId = null;
    let restaurantLocation = null;
    let calculatedDistance = 0;
    let restaurantData = null;

    // Process products to get restaurant ID
    for (const item of products) {
      const { restaurantProductId } = item;
      const productData = await RestaurantProduct.findById(restaurantProductId);
      if (productData) {
        restaurantId = productData.restaurantId;
        break;
      }
    }

    // Get restaurant location if restaurant found
    if (restaurantId) {
      restaurantData = await Restaurant.findById(restaurantId);
      if (restaurantData && restaurantData.location && restaurantData.location.coordinates) {
        restaurantLocation = restaurantData.location;
        
        // Calculate distance using Haversine formula
        const [userLon, userLat] = userLocation.coordinates;
        const [restaurantLon, restaurantLat] = restaurantLocation.coordinates;
        
        calculatedDistance = calculateDistance(userLat, userLon, restaurantLat, restaurantLon);
        
        console.log('Distance Calculation:', {
          userCoordinates: [userLat, userLon],
          restaurantCoordinates: [restaurantLat, restaurantLon],
          calculatedDistance: `${calculatedDistance} km`
        });
      }
    }

    // Create or update cart
    if (!cart) {
      cart = new Cart({
        userId,
        products: [],
        subTotal: 0,
        totalItems: 0,
        totalDiscount: 0,
        deliveryCharge: 0,
        gstCharges: 0,
        gstOnDelivery: 0,
        platformCharge: 0,
        finalAmount: 0,
        amountSavedOnOrder: 0,
        distance: calculatedDistance,
        perKmRate: deliveryChargeObj.perKmRate || 0,
        freeDeliveryThreshold: freeDeliveryThreshold,
        isDeliveryFree: false,
        deliveryMethod: deliveryChargeObj.deliveryMethod,
        chargeCalculations: {
          deliveryCharge: {
            baseAmount: deliveryChargeObj.amount || 0,
            distanceCharge: 0,
            freeDeliveryApplied: false,
            deliveryMethod: deliveryChargeObj.deliveryMethod,
            minDistance: deliveryChargeObj.minDistance,
            maxDistance: deliveryChargeObj.maxDistance,
            perKmRate: deliveryChargeObj.perKmRate
          },
          gstOnFood: {
            rate: gstChargesObj.amount,
            amount: 0
          },
          platformCharge: {
            rate: platformChargeObj.amount,
            amount: 0
          },
          gstOnDelivery: {
            rate: gstOnDeliveryObj.amount,
            amount: 0
          }
        }
      });
    } else {
      // Update existing cart
      cart.perKmRate = deliveryChargeObj.perKmRate || 0;
      cart.freeDeliveryThreshold = freeDeliveryThreshold;
      cart.distance = calculatedDistance;
      cart.deliveryMethod = deliveryChargeObj.deliveryMethod;
      cart.chargeCalculations.deliveryCharge.baseAmount = deliveryChargeObj.amount || 0;
      cart.chargeCalculations.deliveryCharge.deliveryMethod = deliveryChargeObj.deliveryMethod;
      cart.chargeCalculations.deliveryCharge.minDistance = deliveryChargeObj.minDistance;
      cart.chargeCalculations.deliveryCharge.maxDistance = deliveryChargeObj.maxDistance;
      cart.chargeCalculations.deliveryCharge.perKmRate = deliveryChargeObj.perKmRate;
      cart.chargeCalculations.gstOnFood.rate = gstChargesObj.amount;
      cart.chargeCalculations.platformCharge.rate = platformChargeObj.amount;
      cart.chargeCalculations.gstOnDelivery.rate = gstOnDeliveryObj.amount;
    }

    // ✅ CRITICAL FIX: Reset totals before calculating
    let subTotal = 0;
    let totalItems = 0;
    let totalDiscount = 0;
    let totalOriginalPrice = 0;

    // Process new products to add/update
    for (const item of products) {
      const { restaurantProductId, recommendedId, quantity = 1, isHalfPlate, isFullPlate } = item;

      const productData = await RestaurantProduct.findById(restaurantProductId);
      if (!productData) {
        console.log(`Product not found: ${restaurantProductId}`);
        continue;
      }
      
      const recommendedItem = productData.recommended.id(recommendedId);
      if (!recommendedItem) {
        console.log(`Recommended item not found: ${recommendedId} in product ${restaurantProductId}`);
        continue;
      }

      // ✅ NEW LOGIC: Check if restaurantProductId is different from existing products
      if (cart.products && cart.products.length > 0) {
        const existingRestaurantProductIds = cart.products.map(p => p.restaurantProductId.toString());
        const newRestaurantProductIdStr = restaurantProductId.toString();
        
        // Check if the new product belongs to a different restaurant product
        if (!existingRestaurantProductIds.includes(newRestaurantProductIdStr)) {
          console.log('Different restaurantProductId detected, clearing cart');
          cart.products = []; // Clear all existing products
          cart.subTotal = 0;
          cart.totalItems = 0;
          cart.totalDiscount = 0;
          cart.deliveryCharge = 0;
          cart.gstCharges = 0;
          cart.gstOnDelivery = 0;
          cart.platformCharge = 0;
          cart.finalAmount = 0;
          cart.amountSavedOnOrder = 0;
          cart.isDeliveryFree = false;
          cart.chargeCalculations.deliveryCharge.distanceCharge = 0;
          cart.chargeCalculations.deliveryCharge.freeDeliveryApplied = false;
          
          // Reset local totals
          subTotal = 0;
          totalItems = 0;
          totalDiscount = 0;
          totalOriginalPrice = 0;
        }
      }

      // Assign restaurant ID
      cart.restaurantId = productData.restaurantId;

      // Price calculation
      let basePrice = recommendedItem.price;
      let originalPrice = basePrice;
      
      if (isHalfPlate) {
        basePrice = recommendedItem.halfPlatePrice || recommendedItem.price;
        originalPrice = basePrice;
      }
      if (isFullPlate) {
        basePrice = recommendedItem.fullPlatePrice || recommendedItem.price;
        originalPrice = basePrice;
      }

      const discountPercent = recommendedItem.discount || 0;
      const discountAmount = (basePrice * discountPercent) / 100;
      const finalPrice = basePrice - discountAmount;

      // Create product object
      const newProduct = {
        restaurantProductId,
        recommendedId,
        quantity,
        name: recommendedItem.name,
        image: recommendedItem.image || recommendedItem.imageUrl || '',
        isHalfPlate: !!isHalfPlate,
        isFullPlate: !!isFullPlate,
        originalPrice: Number(originalPrice.toFixed(2)),
        discountPercent,
        discountAmount: Number(discountAmount.toFixed(2)),
        price: Number(finalPrice.toFixed(2))
      };

      // Add or update product
      const existingIndex = cart.products.findIndex(
        p =>
          p.restaurantProductId.toString() === restaurantProductId &&
          p.recommendedId.toString() === recommendedId &&
          p.isHalfPlate === !!isHalfPlate &&
          p.isFullPlate === !!isFullPlate
      );

      if (existingIndex !== -1) {
        cart.products[existingIndex].quantity += quantity;
        console.log(`Updated quantity for product: ${recommendedItem.name}, new quantity: ${cart.products[existingIndex].quantity}`);
      } else {
        cart.products.push(newProduct);
        console.log(`Added new product: ${recommendedItem.name}, quantity: ${quantity}`);
      }
    }

    // ✅ FIX: Now calculate totals for ALL products in cart (after updates)
    subTotal = 0;
    totalItems = 0;
    totalDiscount = 0;
    totalOriginalPrice = 0;

    cart.products.forEach(product => {
      const productTotal = product.price * product.quantity;
      const originalProductTotal = product.originalPrice * product.quantity;
      const productDiscount = (product.discountAmount || 0) * product.quantity;
      
      subTotal += productTotal;
      totalOriginalPrice += originalProductTotal;
      totalItems += product.quantity;
      totalDiscount += productDiscount;
    });

    // Update cart totals
    cart.subTotal = Number(subTotal.toFixed(2));
    cart.totalItems = totalItems;
    cart.totalDiscount = Number(totalDiscount.toFixed(2));
    cart.amountSavedOnOrder = Number((totalOriginalPrice - subTotal).toFixed(2));

    console.log('Cart Calculations:', {
      subTotal: cart.subTotal,
      totalItems: cart.totalItems,
      totalDiscount: cart.totalDiscount,
      amountSavedOnOrder: cart.amountSavedOnOrder,
      totalOriginalPrice: totalOriginalPrice,
      distance: cart.distance,
      calculatedDistance: calculatedDistance,
      freeDeliveryThreshold: freeDeliveryThreshold,
      deliveryMethod: cart.deliveryMethod,
      productsCount: cart.products.length,
      productDetails: cart.products.map(p => ({
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        total: p.price * p.quantity
      }))
    });

    // Charge calculations
    const gstRate = gstChargesObj.amount;
    const platformRate = platformChargeObj.amount;
    const gstOnDeliveryRate = gstOnDeliveryObj.amount;
    const deliveryMethod = deliveryChargeObj.deliveryMethod;
    const deliveryAmount = deliveryChargeObj.amount || 0;
    const perKmRate = deliveryChargeObj.perKmRate || 0;
    const minDistance = deliveryChargeObj.minDistance || 0;
    const maxDistance = deliveryChargeObj.maxDistance || null;
    const baseRate = deliveryChargeObj.baseRate || 0;

    // Calculate GST on food items
    const gstOnFood = Number(((subTotal * gstRate) / 100).toFixed(2));
    cart.gstCharges = gstOnFood;
    cart.chargeCalculations.gstOnFood.amount = gstOnFood;

    // Calculate platform charge - FIXED AMOUNT
    const platformChargeAmt = platformRate; // Direct amount (11.8), no percentage calculation
    cart.platformCharge = platformChargeAmt;
    cart.chargeCalculations.platformCharge.amount = platformChargeAmt;

    console.log('Platform Charge Calculation:', {
      amount: platformRate,
      note: `Fixed amount from database (₹${platformRate}), not percentage`
    });

    // ---------- AUTO DISTANCE DELIVERY CALCULATION ----------
    let deliveryCharge = 0;
    let distanceCharge = 0;
    let freeDeliveryApplied = false;

    // Check if cart total is above free delivery threshold (from API)
    if (subTotal >= freeDeliveryThreshold) {
      deliveryCharge = 0;
      distanceCharge = 0;
      freeDeliveryApplied = true;
      cart.isDeliveryFree = true;
      console.log(`Free delivery applied: Order amount ₹${subTotal} > ₹${freeDeliveryThreshold} (threshold from API)`);
    } else {
      // Calculate delivery charge based on deliveryMethod
      if (cart.distance > 0) {
        deliveryCharge = calculateDeliveryCharge(
          cart.distance,
          deliveryMethod,
          deliveryAmount,
          perKmRate,
          minDistance,
          maxDistance,
          baseRate
        );
        distanceCharge = deliveryCharge;
      } else {
        // If no distance, use base amount
        deliveryCharge = deliveryAmount;
        console.log('Using base delivery amount:', deliveryCharge);
      }
      
      cart.isDeliveryFree = false;
      
      console.log('Delivery calculation:', {
        deliveryMethod: deliveryMethod,
        calculatedDistance: `${cart.distance} km`,
        deliveryAmount: deliveryAmount,
        perKmRate: perKmRate,
        minDistance: minDistance,
        maxDistance: maxDistance,
        baseRate: baseRate,
        deliveryCharge: deliveryCharge,
        freeDeliveryThreshold: freeDeliveryThreshold,
        note: `Order amount ₹${subTotal} is less than ₹${freeDeliveryThreshold}`
      });
    }

    cart.deliveryCharge = Number(deliveryCharge.toFixed(2));
    
    // Update charge calculations for delivery
    cart.chargeCalculations.deliveryCharge.distanceCharge = distanceCharge;
    cart.chargeCalculations.deliveryCharge.freeDeliveryApplied = freeDeliveryApplied;

    // Calculate GST on delivery charge
    const gstOnDeliveryAmt = Number(((deliveryCharge * gstOnDeliveryRate) / 100).toFixed(2));
    cart.gstOnDelivery = gstOnDeliveryAmt;
    cart.chargeCalculations.gstOnDelivery.amount = gstOnDeliveryAmt;

    // Calculate final amount
    const finalAmount = Number((
      subTotal + 
      gstOnFood + 
      platformChargeAmt + 
      deliveryCharge + 
      gstOnDeliveryAmt
    ).toFixed(2));

    cart.finalAmount = finalAmount;

    await cart.save();

    console.log('Final Cart Calculations:', {
      subTotal: cart.subTotal,
      gstOnFood: cart.gstCharges,
      platformCharge: cart.platformCharge,
      deliveryCharge: cart.deliveryCharge,
      deliveryMethod: cart.deliveryMethod,
      gstOnDelivery: cart.gstOnDelivery,
      finalAmount: cart.finalAmount,
      amountSavedOnOrder: cart.amountSavedOnOrder,
      distance: cart.distance,
      freeDeliveryApplied: freeDeliveryApplied,
      freeDeliveryThreshold: freeDeliveryThreshold
    });

    // Prepare delivery calculation description
    let deliveryCalculation = '';
    if (freeDeliveryApplied) {
      deliveryCalculation = `Free delivery (Order > ₹${freeDeliveryThreshold})`;
    } else {
      switch(deliveryMethod) {
        case "flat_rate":
          deliveryCalculation = `Flat rate: ₹${deliveryAmount}`;
          break;
        case "per_km":
          deliveryCalculation = `Per km: ₹${deliveryAmount} × ${cart.distance}km = ₹${deliveryCharge}`;
          break;
        case "slab_based":
          if (minDistance && maxDistance) {
            if (cart.distance >= minDistance && cart.distance <= maxDistance) {
              deliveryCalculation = `Slab based (within ${minDistance}-${maxDistance}km): ₹${deliveryAmount}`;
            } else if (cart.distance > maxDistance) {
              const extraDistance = cart.distance - maxDistance;
              const extraCharge = extraDistance * (perKmRate || 0);
              deliveryCalculation = `Slab based (beyond ${maxDistance}km): ₹${deliveryAmount} + (${extraDistance}km × ₹${perKmRate}) = ₹${deliveryCharge}`;
            } else {
              deliveryCalculation = `Slab based (below ${minDistance}km): ₹${deliveryAmount}`;
            }
          } else {
            deliveryCalculation = `Slab based: ₹${deliveryAmount}`;
          }
          break;
        default:
          deliveryCalculation = `₹${deliveryCharge}`;
      }
    }

    // Prepare response
    const responseData = {
      success: true,
      message: "Cart updated successfully",
      cart: cart.toObject(),
      chargeBreakdown: {
        subTotal: cart.subTotal,
        itemDiscount: cart.totalDiscount,
        savings: {
          amountSavedOnOrder: cart.amountSavedOnOrder,
          description: `You saved ₹${cart.amountSavedOnOrder} on items`
        },
        gstOnFood: {
          rate: `${gstRate}%`,
          amount: cart.gstCharges,
          calculation: `${subTotal} × ${gstRate}% = ${cart.gstCharges}`
        },
        platformCharge: {
          rate: `Fixed`,
          amount: cart.platformCharge,
          calculation: `Fixed amount: ₹${platformChargeAmt}`
        },
        deliveryCharge: {
          deliveryMethod: deliveryMethod,
          amount: deliveryAmount,
          distance: cart.distance,
          perKmRate: perKmRate,
          minDistance: minDistance,
          maxDistance: maxDistance,
          baseRate: baseRate,
          totalDeliveryCharge: cart.deliveryCharge,
          isFreeDelivery: cart.isDeliveryFree,
          freeDeliveryThreshold: freeDeliveryThreshold,
          freeDeliveryApplied: freeDeliveryApplied,
          calculation: deliveryCalculation
        },
        gstOnDelivery: {
          rate: `${gstOnDeliveryRate}%`,
          amount: cart.gstOnDelivery,
          calculation: deliveryCharge > 0 ? 
            `₹${deliveryCharge} × ${gstOnDeliveryRate}% = ₹${cart.gstOnDelivery}` :
            `Not applicable (No delivery charge)`
        },
        finalAmount: {
          amount: cart.finalAmount,
          calculation: `${cart.subTotal} + ${cart.gstCharges} + ${cart.platformCharge} + ${cart.deliveryCharge} + ${cart.gstOnDelivery} = ${cart.finalAmount}`
        }
      },
      appliedCharges: {
        gstCharges: gstChargesObj,
        platformCharge: platformChargeObj,
        deliveryCharge: deliveryChargeObj,
        gstOnDelivery: gstOnDeliveryObj,
        freeDeliveryThreshold: {
          type: 'free_delivery_threshold',
          value: freeDeliveryThreshold,
          source: 'API configuration'
        }
      },
      distanceDetails: {
        userAddress: {
          street: userAddress.street,
          city: userAddress.city,
          coordinates: userLocation.coordinates
        },
        restaurantLocation: restaurantData && restaurantLocation ? {
          name: restaurantData.restaurantName,
          coordinates: restaurantLocation.coordinates
        } : null,
        calculatedDistance: `${cart.distance} km`,
        calculationMethod: "Haversine formula"
      },
      savingsSummary: {
        amountSavedOnOrder: cart.amountSavedOnOrder,
        totalDiscount: cart.totalDiscount,
        totalOriginalPrice: totalOriginalPrice,
        finalPrice: cart.subTotal,
        savingsPercentage: totalOriginalPrice > 0 ? 
          Number(((cart.amountSavedOnOrder / totalOriginalPrice) * 100).toFixed(1)) : 0
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("addToCart Error:", error);
    
    if (error.message.includes('Active charge not found') || error.message.includes('Charges API failed')) {
      return res.status(503).json({
        success: false,
        message: "Unable to fetch charges configuration. Please contact administrator.",
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.stack
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

    // Validate input
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId." });
    }

    if (!restaurantProductId || !mongoose.Types.ObjectId.isValid(restaurantProductId) ||
        !recommendedId || !mongoose.Types.ObjectId.isValid(recommendedId)) {
      return res.status(400).json({ success: false, message: "Invalid product IDs." });
    }

    if (!["inc", "dec"].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be 'inc' or 'dec'." });
    }

    // Find cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found." });
    }

    // Find product in cart
    const index = cart.products.findIndex(p =>
      p.restaurantProductId.toString() === restaurantProductId &&
      p.recommendedId.toString() === recommendedId &&
      (isHalfPlate === undefined || p.isHalfPlate === isHalfPlate) &&
      (isFullPlate === undefined || p.isFullPlate === isFullPlate)
    );

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Product not found in cart." });
    }

    // Update quantity
    if (action === "inc") {
      cart.products[index].quantity += 1;
    } else {
      cart.products[index].quantity -= 1;
      if (cart.products[index].quantity <= 0) {
        cart.products.splice(index, 1);
      }
    }

    // If cart is empty after removal, clear the cart
    if (cart.products.length === 0) {
      await Cart.deleteOne({ _id: cart._id });
      return res.status(200).json({
        success: true,
        message: "Cart is empty now",
        cart: null
      });
    }

    // Recalculate cart totals (BASIC CALCULATIONS ONLY)
    let subTotal = 0;
    let totalItems = 0;
    let totalDiscount = 0;
    let totalOriginalPrice = 0;

    cart.products.forEach(p => {
      const productTotal = p.price * p.quantity;
      const originalProductTotal = p.originalPrice * p.quantity;
      const productDiscount = (p.discountAmount || 0) * p.quantity;
      
      subTotal += productTotal;
      totalOriginalPrice += originalProductTotal;
      totalItems += p.quantity;
      totalDiscount += productDiscount;
    });

    // Update basic cart totals
    cart.subTotal = Number(subTotal.toFixed(2));
    cart.totalItems = totalItems;
    cart.totalDiscount = Number(totalDiscount.toFixed(2));
    cart.amountSavedOnOrder = Number((totalOriginalPrice - subTotal).toFixed(2));

    console.log('Updated Cart Totals:', {
      subTotal: cart.subTotal,
      totalItems: cart.totalItems,
      totalDiscount: cart.totalDiscount,
      amountSavedOnOrder: cart.amountSavedOnOrder
    });

    // ✅ IMPORTANT: DO NOT recalculate delivery charges
    // The delivery charge, distance, and all other charges 
    // should remain the same as calculated in addToCart
    
    // Only recalculate GST on food items (based on new subtotal)
    if (cart.chargeCalculations && cart.chargeCalculations.gstOnFood) {
      const gstRate = cart.chargeCalculations.gstOnFood.rate;
      const gstOnFood = Number(((subTotal * gstRate) / 100).toFixed(2));
      cart.gstCharges = gstOnFood;
      cart.chargeCalculations.gstOnFood.amount = gstOnFood;
    }

    // ✅ Check for free delivery threshold
    if (cart.freeDeliveryThreshold && cart.deliveryCharge > 0) {
      if (subTotal >= cart.freeDeliveryThreshold) {
        // Apply free delivery
        cart.deliveryCharge = 0;
        cart.gstOnDelivery = 0;
        cart.isDeliveryFree = true;
        cart.chargeCalculations.deliveryCharge.distanceCharge = 0;
        cart.chargeCalculations.deliveryCharge.freeDeliveryApplied = true;
        cart.chargeCalculations.gstOnDelivery.amount = 0;
        
        console.log(`Free delivery applied on update: Order amount ₹${subTotal} >= ₹${cart.freeDeliveryThreshold}`);
      } else {
        // Remove free delivery if order amount dropped below threshold
        if (cart.isDeliveryFree) {
          console.log(`Free delivery removed: Order amount ₹${subTotal} < ₹${cart.freeDeliveryThreshold}`);
          
          // We need to recalculate delivery charge only if free delivery was removed
          // This requires having the original delivery calculation parameters
          // For simplicity, you might want to call a helper function here
          // Or keep the last calculated delivery charge
        }
      }
    }

    // Recalculate final amount with updated values
    cart.finalAmount = Number((
      cart.subTotal + 
      cart.gstCharges + 
      cart.platformCharge + 
      cart.deliveryCharge + 
      cart.gstOnDelivery
    ).toFixed(2));

    await cart.save();

    // Prepare response
    const responseData = {
      success: true,
      message: "Cart updated successfully",
      cart: cart.toObject(),
      summary: {
        subTotal: cart.subTotal,
        totalItems: cart.totalItems,
        totalDiscount: cart.totalDiscount,
        amountSavedOnOrder: cart.amountSavedOnOrder,
        deliveryCharge: cart.deliveryCharge,
        isDeliveryFree: cart.isDeliveryFree,
        freeDeliveryThreshold: cart.freeDeliveryThreshold,
        finalAmount: cart.finalAmount
      }
    };

    return res.status(200).json(responseData);

  } catch (err) {
    console.error("updateCartItemQuantity Error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
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
