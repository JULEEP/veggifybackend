const Product = require("../models/productModel");
const Order = require("../models/orderModel");
const RestaurantProduct = require("../models/restaurantProductModel");
const User = require("../models/userModel");
const Cart = require("../models/cartModel");
const Restaurant = require("../models/restaurantModel");
const cloudinary = require('../config/cloudinary');
const { DeliveryBoy } = require("../models/deliveryBoyModel");
const mongoose = require("mongoose");
const fs = require("fs");
const Ambassador = require("../models/ambassadorModel");
const QRCode = require('qrcode');
const Razorpay = require("razorpay");


// Haversine formula to calculate distance in km
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
};

// Haversine formula for distance
function calculateDistance(lon1, lat1, lon2, lat2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);  // Degrees to radians
  const dLon = (lon2 - lon1) * (Math.PI / 180);  // Degrees to radians
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}


// Helper to upload images to Cloudinary
async function uploadFilesToCloudinary(files) {
  if (!files) return [];
  const filesArray = Array.isArray(files) ? files : [files];
  const urls = [];
  for (const file of filesArray) {
    const result = await cloudinary.uploader.upload(file.path);
    urls.push(result.secure_url);
  }
  return urls;
}

exports.createProduct = async (req, res) => {
  try {
    const {
      description,
      contentname,
      userId,
      RestaurantProductId,
      recommendedId,
      reviews,
      type,
      rating,
      viewcount,
    } = req.body;

    const vendorHalfPercentage = 50;
    const vendor_Platecost = 5;

    // Fetch user and restaurant product
    const user = await User.findById(userId);
    const restaurantProduct = await RestaurantProduct.findById(RestaurantProductId).populate("restaurantId");

    if (!user || !restaurantProduct) {
      return res.status(400).json({
        success: false,
        message: "User or RestaurantProduct not found"
      });
    }

    // Find recommended item safely
    let recommendedItem;
    if (restaurantProduct.recommended && Array.isArray(restaurantProduct.recommended)) {
      recommendedItem = restaurantProduct.recommended.find(r => r._id && r._id.toString() === recommendedId);
    }

    if (!recommendedItem) {
      return res.status(400).json({
        success: false,
        message: "Recommended item not found in restaurant product"
      });
    }

    const productName = recommendedItem.name?.trim() || "Unnamed Product";
    const productPrice = Number(recommendedItem.price) || 0;
    const price = productPrice;

    // Upload product and review images
    const productImages = await uploadFilesToCloudinary(req.files?.productImages);
    const reviewImages = await uploadFilesToCloudinary(req.files?.reviewImages);

    // Parse reviews and attach images
    let parsedReviews = [];
    if (reviews) {
      parsedReviews = JSON.parse(reviews);
      parsedReviews.forEach((rev, i) => {
        if (reviewImages[i]) rev.image = reviewImages[i];
      });
    }

    // Add addons only if recommended item has addons
    let parsedAddons;
    if (recommendedItem.addons && typeof recommendedItem.addons === "object") {
      const addonsData = recommendedItem.addons;

      // Safe variation type
      let variationType = "";
      if (addonsData.variation && addonsData.variation.type) {
        variationType = Array.isArray(addonsData.variation.type)
          ? addonsData.variation.type[0]
          : addonsData.variation.type;
        if (variationType) variationType = variationType.toString().toLowerCase();
      }

      let variationPrice = 0;
      if (variationType === "full") variationPrice = productPrice;
      else if (variationType === "half") variationPrice = productPrice - (productPrice * vendorHalfPercentage / 100);

      const plateCount = Number(addonsData.plates?.item || 0);
      const totalPlatesPrice = plateCount * vendor_Platecost;

      parsedAddons = {
        productName,
        variation: {
          name: addonsData.variation?.name || "",
          type: Array.isArray(addonsData.variation?.type)
            ? addonsData.variation.type
            : [addonsData.variation?.type || ""],
          vendorPercentage: vendorHalfPercentage,
          price: variationPrice
        },
        plates: {
          name: addonsData.plates?.name || "",
          item: plateCount,
          platePrice: vendor_Platecost,
          totalPlatesPrice
        }
      };
    }

    // Calculate delivery time
    let deliveryTime = null;
    const restaurantCoordinates = restaurantProduct?.restaurantId?.location?.coordinates;
    const userCoordinates = user?.location?.coordinates;
    if (restaurantCoordinates && userCoordinates) {
      const dist = calculateDistance(restaurantCoordinates, userCoordinates);
      const estimatedTime = Math.round(dist * 2); // 2 min per km
      deliveryTime = estimatedTime > 60 ? "60+ mins" : `${estimatedTime} mins`;
    }

    // Location from RestaurantProduct
    const parsedLocation = restaurantProduct.locationName ? [restaurantProduct.locationName] : [];

    // Parse type
    const parsedType = JSON.parse(type || "[]");

    // Create product
    const product = await Product.create({
      productName,
      productPrice,
      description,
      image: productImages,
      locationname: parsedLocation,
      contentname,
      userId,
      reviews: parsedReviews,
      vendorHalfPercentage,
      vendor_Platecost,
      rating: Number(rating) || 0,
      viewcount: Number(viewcount) || 0,
      type: parsedType,
      addons: parsedAddons, // include only if exists
      deliverytime: deliveryTime,
      recommendedId,
      restaurantProduct: {
        product: restaurantProduct._id,
        productName,
        quantity: 1,
        price,
      }
    });

    const productObj = product.toObject();
    delete productObj.vendorHalfPercentage;
    delete productObj.vendor_Platecost;

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: productObj,
    });

  } catch (err) {
    console.error("❌ Product creation error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
// ✅ GET all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate({
        path: "userId",
        select: "firstName lastName email phoneNumber"
      })
      .populate({
        path: "restaurantProduct.product",
        select: "restaurantName locationName"
      });

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products
    });
  } catch (err) {
    console.error("❌ Get all products error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};



// ✅ GET product by ID
exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    console.error("❌ Get product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.updateProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid productId" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const {
      description,
      contentname,
      type,
      rating,
      viewcount,
      recommendedId
    } = req.body;

    // Update basic fields
    if (description !== undefined) product.description = description;
    if (contentname !== undefined) product.contentname = contentname;
    if (rating !== undefined) product.rating = Number(rating);
    if (viewcount !== undefined) product.viewcount = Number(viewcount);
    if (type !== undefined) product.type = JSON.parse(type || "[]");
    if (recommendedId !== undefined) product.recommendedId = recommendedId;

    // Handle images
    if (req.files?.productImages) {
      const uploadedImages = await uploadFilesToCloudinary(req.files.productImages);
      product.image = uploadedImages;
    }
    if (req.files?.reviewImages) {
      const uploadedReviewImages = await uploadFilesToCloudinary(req.files.reviewImages);
      if (product.reviews && Array.isArray(product.reviews)) {
        product.reviews.forEach((rev, i) => {
          if (uploadedReviewImages[i]) rev.image = uploadedReviewImages[i];
        });
      }
    }

    // Update addons if recommendedId provided
    if (recommendedId && product.restaurantProduct?.product) {
      const restaurantProduct = await RestaurantProduct.findById(product.restaurantProduct.product);
      const recommendedItem = restaurantProduct.recommended.find(r => r._id && r._id.toString() === recommendedId);

      if (recommendedItem?.addons && typeof recommendedItem.addons === "object") {
        const addonsData = recommendedItem.addons;
        const vendorHalfPercentage = 50;
        const vendor_Platecost = 5;
        let variationType = "";
        if (addonsData.variation && addonsData.variation.type) {
          variationType = Array.isArray(addonsData.variation.type)
            ? addonsData.variation.type[0]
            : addonsData.variation.type;
          variationType = variationType?.toString().toLowerCase();
        }
        const variationPrice = variationType === "full" ? recommendedItem.price : variationType === "half" ? recommendedItem.price - (recommendedItem.price * vendorHalfPercentage / 100) : 0;
        const plateCount = Number(addonsData.plates?.item || 0);
        const totalPlatesPrice = plateCount * vendor_Platecost;

        product.addons = {
          productName: recommendedItem.name,
          variation: {
            name: addonsData.variation?.name || "",
            type: Array.isArray(addonsData.variation?.type) ? addonsData.variation.type : [addonsData.variation?.type || ""],
            vendorPercentage: vendorHalfPercentage,
            price: variationPrice
          },
          plates: {
            name: addonsData.plates?.name || "",
            item: plateCount,
            platePrice: vendor_Platecost,
            totalPlatesPrice
          }
        };
      }
    }

    await product.save();
    return res.status(200).json({ success: true, message: "Product updated successfully", data: product });

  } catch (err) {
    console.error("❌ Update Product Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
// ✅ DELETE product
exports.deleteProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid productId" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await Product.findByIdAndDelete(productId);
    return res.status(200).json({ success: true, message: "Product deleted successfully" });

  } catch (err) {
    console.error("❌ Delete Product Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


// 1. Toggle Wishlist (Add/Remove)
exports.addToWishlist = async (req, res) => {
  const { userId } = req.params;
  const { productId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const exists = user.myWishlist.includes(productId);

    if (exists) {
      user.myWishlist = user.myWishlist.filter(id => id.toString() !== productId);
      await user.save();
      return res.status(200).json({
        message: "Product removed from wishlist",
        isInWishlist: false,
        wishlist: user.myWishlist
      });
    } else {
      user.myWishlist.push(productId);
      await user.save();
      return res.status(200).json({
        message: "Product added to wishlist",
        isInWishlist: true,
        wishlist: user.myWishlist
      });
    }
  } catch (error) {
    console.error("Wishlist toggle error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 2. Get Wishlist with full product details
// 2. Get Wishlist with full recommended product details
exports.getWishlist = async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. Get the user's wishlist
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myWishlist = user.myWishlist; // array of recommended._id
    if (!myWishlist || myWishlist.length === 0) {
      return res.status(404).json({ message: "Wishlist is empty" });
    }

    // 2. Find recommended items with restaurant details
    const wishlistItems = await Promise.all(
      myWishlist.map(async (recId) => {
        // Find the product that has this recommended item
        const product = await RestaurantProduct.findOne(
          { "recommended._id": recId },
          { recommended: { $elemMatch: { _id: recId } } }
        ).populate("restaurantId"); // populate restaurant details

        if (!product || !product.recommended[0]) return null;

        const recommendedItem = product.recommended[0];

        // Add restaurant details to the recommended item
        const restaurant = product.restaurantId; // populated document
        const restaurantDetails = restaurant
          ? {
              restaurantId: restaurant._id, // Added restaurantId
              restaurantName: restaurant.restaurantName || "",
              locationName: restaurant.locationName || "",
              status: restaurant.status || "unknown"
            }
          : {};

        return {
          ...recommendedItem.toObject(),
          restaurantProductId: product._id, // ✅ Include parent RestaurantProduct ID
          restaurant: restaurantDetails
        };
      })
    );

    // Filter out nulls
    const filteredWishlist = wishlistItems.filter(item => item !== null);

    res.status(200).json({ wishlist: filteredWishlist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};



// 3. Remove Specific Product
exports.removeFromWishlist = async (req, res) => {
  const { userId, productId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.myWishlist = user.myWishlist.filter(id => id.toString() !== productId);
    await user.save();

    res.status(200).json({ message: "Product removed", wishlist: user.myWishlist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// -------------------- ORDER CONTROLLERS --------------------


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_RgqXPvDLbgEIVv",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "1FQJrX3Ol38hWDeZ4CRI7O3i",
});



// exports.createOrder = async (req, res) => {
//   try {
//     const { userId, paymentMethod, addressId } = req.body;

//     // Basic validations
//     if (!mongoose.Types.ObjectId.isValid(userId))
//       return res.status(400).json({ success: false, message: "Valid userId is required." });
//     if (!mongoose.Types.ObjectId.isValid(addressId))
//       return res.status(400).json({ success: false, message: "Valid addressId is required." });
//     if (!["COD", "Online"].includes(paymentMethod))
//       return res.status(400).json({ success: false, message: "Invalid payment method." });

//     // Get cart by userId
//     const cart = await Cart.findOne({ userId }).populate('products.restaurantProductId');
//     if (!cart) {
//       return res.status(404).json({
//         success: false,
//         message: "Cart not found for this user."
//       });
//     }

//     // Check if cart has products
//     if (!cart.products || cart.products.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Cart is empty. Add products to create order."
//       });
//     }

//     // Get user with specific address
//     const user = await User.findOne(
//       { _id: userId, "addresses._id": addressId },
//       {
//         name: 1,
//         email: 1,
//         location: 1,
//         referredBy: 1, // Get the referral code if available
//         addresses: { $elemMatch: { _id: addressId } }
//       }
//     );
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User or address not found."
//       });
//     }

//     const selectedAddress = user.addresses[0];
//     if (!selectedAddress || !user.location || !user.location.coordinates) {
//       return res.status(400).json({
//         success: false,
//         message: "User location or selected address not found."
//       });
//     }

//     // Get restaurant details from cart
//     const restaurantId = cart.restaurantId;
//     if (!restaurantId) {
//       return res.status(400).json({
//         success: false,
//         message: "Restaurant not found in cart."
//       });
//     }

//     const restaurant = await Restaurant.findById(restaurantId, "restaurantName location");
//     if (!restaurant) {
//       return res.status(404).json({
//         success: false,
//         message: "Restaurant not found."
//       });
//     }

//     // Process products from cart
//     const cleanProducts = [];
//     let subTotal = 0;
//     let totalItems = 0;

//     for (const prod of cart.products) {
//       const restaurantProduct = prod.restaurantProductId;
//       const recommendedItem = restaurantProduct?.recommended?.id(prod.recommendedId);

//       if (!recommendedItem) continue;

//       let unitPrice = recommendedItem.price || 0;
//       const addOnClean = {};

//       // Handle addons and variations
//       if (recommendedItem.addons && prod.addOn) {
//         if (recommendedItem.addons.variation?.type.includes("Half") && prod.addOn.variation === "Half") {
//           addOnClean.variation = "Half";
//           unitPrice = recommendedItem.calculatedPrice?.half ||
//             Math.round(unitPrice * (recommendedItem.vendorHalfPercentage / 100));
//         }

//         if (recommendedItem.addons.plates && prod.addOn.plateitems > 0) {
//           addOnClean.plateitems = prod.addOn.plateitems;
//           const plateCost = prod.addOn.plateitems * (recommendedItem.vendor_Platecost || 0);
//           unitPrice += plateCost;
//         }
//       }

//       const productTotal = unitPrice * prod.quantity;
//       subTotal += productTotal;
//       totalItems += prod.quantity;

//       cleanProducts.push({
//         restaurantProductId: prod.restaurantProductId._id,
//         recommendedId: prod.recommendedId,
//         quantity: prod.quantity,
//         name: recommendedItem.name,
//         basePrice: unitPrice,
//         image: recommendedItem.image || "",
//         ...(Object.keys(addOnClean).length > 0 ? { addOn: addOnClean } : {}), // Add addons if any
//       });
//     }

//     // **Calculate distanceKm** (using Haversine formula)
//     const userCoords = user.location.coordinates; // Assuming [longitude, latitude]
//     const restaurantCoords = restaurant.location.coordinates; // Assuming [longitude, latitude]

//     const distanceKm = haversineDistance(
//       [userCoords[0], userCoords[1]],
//       [restaurantCoords[0], restaurantCoords[1]]
//     );

//     // **Get the DeliveryBoy's baseDeliveryCharge** (Assuming we can fetch the nearest available delivery boy)
//     const nearestDeliveryBoy = await DeliveryBoy.findOne({ status: 'Available' }).sort({ createdAt: 1 });
//     const baseDeliveryCharge = nearestDeliveryBoy ? nearestDeliveryBoy.baseDeliveryCharge : 5; // Default base charge if no delivery boy found

//     // Calculate the actual delivery charge and round to nearest whole number
//     const calculatedDeliveryCharge = Math.round(baseDeliveryCharge * distanceKm); // Round to nearest integer

//     // Apply coupon from cart
//     const couponDiscount = cart.couponDiscount || 0;
//     const appliedCoupon = cart.appliedCoupon || null;
//     const totalPayable = subTotal + calculatedDeliveryCharge - couponDiscount;

//     // Round the total payable value to 2 decimal places
//     const roundedTotalPayable = totalPayable.toFixed(2); // Ensure 2 decimals

//     // Auto-set payment status based on payment method
//     const paymentStatus = paymentMethod === "COD" ? "Pending" : "Paid";

//     // Create order data with restaurant location directly
//     const orderData = {
//       userId,
//       cartId: cart._id, // Use cart's _id
//       restaurantId,
//       restaurantLocation: restaurant.location, // Save the restaurant's location here (directly from restaurant)
//       deliveryAddress: selectedAddress, // Full address object
//       paymentMethod,
//       paymentStatus,
//       orderStatus: "Pending",
//       totalItems,
//       subTotal,
//       deliveryCharge: calculatedDeliveryCharge,
//       couponDiscount,
//       appliedCoupon,
//       totalPayable: roundedTotalPayable,  // Use the rounded totalPayable here
//       products: cleanProducts,
//       distanceKm,
//     };

//     // Create order
//     const order = await Order.create(orderData);
//     const populatedOrder = await Order.findById(order._id)
//       .populate("restaurantId", "restaurantName") // Just populate restaurantName if needed
//       .populate("userId", "name email");

//     // Optional: Clear cart after successful order creation
//     await Cart.findOneAndUpdate(
//       { userId },
//       {
//         products: [],
//         subTotal: 0,
//         deliveryCharge: 0,
//         couponDiscount: 0,
//         finalAmount: 0,
//         totalItems: 0,
//         appliedCoupon: null,
//       }
//     );

//     return res.status(201).json({
//       success: true,
//       message: paymentStatus === "Paid" ? "Payment successful and order created" : "Order created successfully",
//       data: populatedOrder,
//     });

//   } catch (error) {
//     console.error("createOrder error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };



const axios = require('axios');
const adminModel = require("../models/adminModel");

// Helper function to fetch charges from API
const fetchCharges = async () => {
  try {
    const response = await axios.get('http://31.97.206.144:5051/api/admin/allcharge');
    if (response.data.success) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error('Error fetching charges:', error);
    // Return default charges if API fails
    return [
      {
        type: 'delivery_charge',
        amount: 40,
        chargeType: 'fixed',
        deliveryMethod: 'per_km',
        perKmRate: 39.99,
        displayLabel: 'Delivery Charge',
        unit: '₹',
        isActive: true
      },
      {
        type: 'gst_on_delivery',
        amount: 18,
        chargeType: 'percentage',
        deliveryMethod: 'flat_rate',
        displayLabel: 'GST on Delivery Charges',
        unit: '%',
        isActive: true
      },
      {
        type: 'packing_charges',
        amount: 20,
        chargeType: 'fixed',
        displayLabel: 'Packing Charges',
        unit: '₹',
        isActive: true
      },
      {
        type: 'gst_charges',
        amount: 5,
        chargeType: 'percentage',
        displayLabel: 'GST Charges',
        unit: '%',
        isActive: true
      },
      {
        type: 'platform_charge',
        amount: 10,
        chargeType: 'percentage',
        displayLabel: 'Platform Charge',
        unit: '%',
        isActive: true
      }
    ];
  }
};






exports.createOrder = async (req, res) => {
  try {
    const { userId, paymentMethod, addressId, transactionId } = req.body;

    // ✅ Validate input
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    if (!mongoose.Types.ObjectId.isValid(addressId))
      return res.status(400).json({ success: false, message: "Valid addressId is required." });

    if (!["COD", "Online"].includes(paymentMethod))
      return res.status(400).json({ success: false, message: "Invalid payment method." });

    if (paymentMethod === "Online" && !transactionId)
      return res.status(400).json({ success: false, message: "transactionId is required for Online payment." });

    // ✅ Fetch cart with all charge calculations
    const cart = await Cart.findOne({ userId })
      .populate('products.restaurantProductId')
      .populate('restaurantId', 'restaurantName locationName');
    
    if (!cart || !cart.products.length)
      return res.status(404).json({ success: false, message: "Cart is empty." });

    console.log('Cart data for order:', {
      subTotal: cart.subTotal,
      deliveryCharge: cart.deliveryCharge,
      gstCharges: cart.gstCharges,
      platformCharge: cart.platformCharge,
      gstOnDelivery: cart.gstOnDelivery,
      finalAmount: cart.finalAmount,
      amountSavedOnOrder: cart.amountSavedOnOrder,
      isDeliveryFree: cart.isDeliveryFree,
      distance: cart.distance,
      perKmRate: cart.perKmRate,
      freeDeliveryThreshold: cart.freeDeliveryThreshold,
      chargeCalculations: cart.chargeCalculations
    });

    // ✅ Fetch user & address
    const user = await User.findOne(
      { _id: userId, "addresses._id": addressId },
      { 
        name: 1, 
        email: 1, 
        mobile: 1, 
        location: 1, 
        addresses: { $elemMatch: { _id: addressId } } 
      }
    );
    
    if (!user)
      return res.status(404).json({ success: false, message: "User or address not found." });

    const selectedAddress = user.addresses[0];

    // ✅ Restaurant info
    const restaurant = await Restaurant.findById(
      cart.restaurantId, 
      "restaurantName locationName location phoneNumber notifications"
    ); 
    
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found." });

    // ✅ Get current charges from API for snapshot ONLY
    let appliedChargesSnapshot = {};
    try {
      const allCharges = await fetchCharges();
      const activeCharges = allCharges.filter(charge => charge.isActive === true);
      
      // Extract specific charges
      const deliveryChargeObj = activeCharges.find(c => c.type === 'delivery_charge');
      const gstChargesObj = activeCharges.find(c => c.type === 'gst_charges');
      const platformChargeObj = activeCharges.find(c => c.type === 'platform_charge');
      const gstOnDeliveryObj = activeCharges.find(c => c.type === 'gst_on_delivery');

      appliedChargesSnapshot = {
        gstCharges: gstChargesObj || null,
        platformCharge: platformChargeObj || null,
        deliveryCharge: deliveryChargeObj || null,
        gstOnDelivery: gstOnDeliveryObj || null
      };
    } catch (error) {
      console.log('Charges API error (using cart data only):', error.message);
      // API fail hua to bhi chalega, cart se hi data hai
    }

    // ✅ Clean products from cart
    const cleanProducts = cart.products.map(product => ({
      restaurantProductId: product.restaurantProductId,
      recommendedId: product.recommendedId,
      quantity: product.quantity,
      isHalfPlate: product.isHalfPlate,
      isFullPlate: product.isFullPlate,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice || product.price,
      image: product.image,
      discountPercent: product.discountPercent,
      discountAmount: product.discountAmount
    }));

    // ✅ Prepare product summary for notification
    const productSummary = cart.products.map(product => ({
      name: product.name,
      quantity: product.quantity,
      price: product.price,
      total: product.price * product.quantity
    }));

    const totalItemsCount = cart.totalItems;

    // ✅ Payment status logic
    let paymentStatus = paymentMethod === "COD" ? "Pending" : "Paid";
    let razorpayPaymentDetails = null;
    let finalTransactionId = transactionId || null;

    if (paymentMethod === "Online") {
      try {
        const payment = await razorpay.payments.fetch(transactionId);
        razorpayPaymentDetails = payment;

        if (payment.status === "authorized") {
          const captured = await razorpay.payments.capture(transactionId, payment.amount, payment.currency);
          razorpayPaymentDetails = captured;
          finalTransactionId = captured.id;
        }

        paymentStatus = "Paid";
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Razorpay payment verification failed.",
          error: err.message
        });
      }
    }

    // ✅ Create order with all charge details (DIRECT from cart)
    const orderData = {
      userId,
      cartId: cart._id,
      restaurantId: cart.restaurantId,
      restaurantName: restaurant.restaurantName,
      restaurantLocation: restaurant.location,
      deliveryAddress: selectedAddress,
      paymentMethod,
      paymentStatus,
      transactionId: finalTransactionId,
      razorpayPaymentDetails,
      orderStatus: "Pending",
      
      // ✅ All charge fields DIRECT from cart
      subTotal: cart.subTotal,
      totalItems: cart.totalItems,
      totalDiscount: cart.totalDiscount,
      gstCharges: cart.gstCharges,
      platformCharge: cart.platformCharge,
      deliveryCharge: cart.deliveryCharge,
      gstOnDelivery: cart.gstOnDelivery,
      couponDiscount: cart.couponDiscount || 0,
      totalPayable: cart.finalAmount,
      distanceKm: cart.distance,
      isDeliveryFree: cart.isDeliveryFree,
      freeDeliveryThreshold: cart.freeDeliveryThreshold,
      perKmRate: cart.perKmRate,
      
      // ✅ नया field: amountSavedOnOrder
      amountSavedOnOrder: cart.amountSavedOnOrder || 0,
      
      // ✅ Charge calculations DIRECT from cart
      chargeCalculations: cart.chargeCalculations || {},
      
      // ✅ Applied charges snapshot
      appliedCharges: appliedChargesSnapshot,
      
      // ✅ Products
      products: cleanProducts,
      
      // ✅ Applied coupon
      appliedCoupon: cart.appliedCoupon || null,
      
      // ✅ Delivery status
      deliveryStatus: "Pending"
    };

    const order = await Order.create(orderData);

    // ✅ Send Notification to Restaurant
    try {
      const notification = {
        type: 'order_placed',
        title: '🎉 New Order Received!',
        message: `New order #${order.orderNumber || order._id.toString().slice(-6)} has been placed`,
        orderId: order._id,
        userId: user._id,
        isRead: false,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber || order._id.toString().slice(-6),
          customerName: user.name || 'Customer',
          customerPhone: user.mobile || 'N/A',
          totalAmount: order.totalPayable,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          itemCount: totalItemsCount,
          products: productSummary,
          deliveryAddress: {
            street: selectedAddress.street,
            city: selectedAddress.city,
            state: selectedAddress.state,
            country: selectedAddress.country,
            postalCode: selectedAddress.postalCode
          },
          timestamp: new Date().toISOString()
        }
      };

      // Add notification to restaurant
      await Restaurant.findByIdAndUpdate(
        cart.restaurantId,
        {
          $push: {
            notifications: {
              $each: [notification],
              $position: 0,
              $slice: 50
            }
          }
        }
      );
      
    } catch (notifError) {
      console.error('Notification sending failed:', notifError.message);
    }

    // ✅ Prepare charge breakdown for response (DIRECT from cart)
    const gstRate = cart.chargeCalculations?.gstOnFood?.rate || 5;
    const platformRate = cart.chargeCalculations?.platformCharge?.rate || 10;
    const gstOnDeliveryRate = cart.chargeCalculations?.gstOnDelivery?.rate || 18;
    const baseDeliveryAmount = cart.chargeCalculations?.deliveryCharge?.baseAmount || 40;
    
    // ✅ FIX: Platform charge calculation - check if it's percentage or fixed
    let platformChargeInfo;
    if (appliedChargesSnapshot.platformCharge?.chargeType === 'percentage') {
      platformChargeInfo = {
        rate: `${platformRate}%`,
        amount: order.platformCharge,
        calculation: `${order.subTotal} × ${platformRate}% = ${order.platformCharge}`
      };
    } else {
      platformChargeInfo = {
        rate: `Fixed`,
        amount: order.platformCharge,
        calculation: `Fixed amount: ₹${order.platformCharge}`
      };
    }

    const chargeBreakdown = {
      subTotal: order.subTotal,
      itemDiscount: order.totalDiscount,
      savings: {
        amountSavedOnOrder: order.amountSavedOnOrder,
        description: `You saved ₹${order.amountSavedOnOrder} on this order`
      },
      gstOnFood: {
        rate: `${gstRate}%`,
        amount: order.gstCharges,
        calculation: `${order.subTotal} × ${gstRate}% = ${order.gstCharges}`
      },
      platformCharge: platformChargeInfo,
      deliveryCharge: {
        baseAmount: baseDeliveryAmount,
        distance: order.distanceKm,
        perKmRate: order.perKmRate,
        distanceCharge: cart.chargeCalculations?.deliveryCharge?.distanceCharge || 0,
        totalDeliveryCharge: order.deliveryCharge,
        isFreeDelivery: order.isDeliveryFree,
        freeDeliveryThreshold: order.freeDeliveryThreshold,
        freeDeliveryApplied: cart.chargeCalculations?.deliveryCharge?.freeDeliveryApplied || false,
        calculation: cart.chargeCalculations?.deliveryCharge?.freeDeliveryApplied ? 
          `Free delivery (Order > ₹${order.freeDeliveryThreshold})` : 
          order.distanceKm > 0 && order.perKmRate > 0 ? 
            `${order.distanceKm}km × ₹${order.perKmRate} = ₹${order.deliveryCharge}` :
            `Flat charge: ₹${order.deliveryCharge}`
      },
      gstOnDelivery: {
        rate: `${gstOnDeliveryRate}%`,
        amount: order.gstOnDelivery,
        calculation: order.deliveryCharge > 0 ? 
          `₹${order.deliveryCharge} × ${gstOnDeliveryRate}% = ₹${order.gstOnDelivery}` :
          `Not applicable (Free delivery)`
      },
      couponDiscount: {
        amount: order.couponDiscount,
        applied: order.couponDiscount > 0
      },
      grandTotal: {
        amount: order.totalPayable,
        calculation: `${order.subTotal} + ${order.gstCharges} + ${order.platformCharge} + ${order.deliveryCharge} + ${order.gstOnDelivery} - ${order.couponDiscount} = ${order.totalPayable}`
      }
    };

    // ✅ Clear cart (simple reset)
    await Cart.findOneAndUpdate(
      { userId },
      { 
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
        distance: 0,
        perKmRate: 0,
        freeDeliveryThreshold: 399, // Changed to 399
        isDeliveryFree: false,
        restaurantId: null,
        chargeCalculations: {},
        appliedCoupon: null,
        couponDiscount: 0
      }
    );

    // ✅ Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId", "name email");

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        ...populatedOrder.toObject(),
        chargeBreakdown
      },
      razorpayPaymentDetails,
      summary: {
        itemsTotal: order.subTotal,
        totalDiscount: order.totalDiscount,
        amountSavedOnOrder: order.amountSavedOnOrder,
        charges: {
          gstOnFood: order.gstCharges,
          platformCharge: order.platformCharge,
          deliveryCharge: order.deliveryCharge,
          gstOnDelivery: order.gstOnDelivery
        },
        couponDiscount: order.couponDiscount,
        grandTotal: order.totalPayable,
        itemsCount: order.totalItems,
        isDeliveryFree: order.isDeliveryFree,
        distanceKm: order.distanceKm,
        perKmRate: order.perKmRate
      },
      appliedCharges: appliedChargesSnapshot,
      savingsInfo: {
        amountSavedOnOrder: order.amountSavedOnOrder,
        totalOriginalAmount: order.subTotal + order.amountSavedOnOrder,
        savingsPercentage: order.amountSavedOnOrder > 0 ? 
          Number(((order.amountSavedOnOrder / (order.subTotal + order.amountSavedOnOrder)) * 100).toFixed(1)) : 0
      },
      notificationSent: true,
      restaurantNotified: {
        restaurantId: restaurant._id,
        restaurantName: restaurant.restaurantName,
        notificationType: 'order_placed'
      }
    });

  } catch (error) {
    console.error("createOrder Error:", error);
    
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.stack
    });
  }
};
// -------------------------
// GET ALL ORDERS
// -------------------------

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId") // populate all user fields
      .populate({
        path: "cartId",
        populate: [
          { path: "userId", select: "name email phone" }, // user inside cart
          { path: "restaurantId", select: "restaurantName locationName" }, // restaurant inside cart
          {
            path: "products.restaurantProductId",
            select: "name price image", // product details inside cart products array
          },
          { path: "appliedCouponId", select: "code discountPercentage" }, // coupon details if any
        ],
      })
      // 🆕 Populate deliveryBoyId with selected fields
      .populate("deliveryBoyId", "fullName mobileNumber vehicleType email deliveryBoyStatus");

    return res.status(200).json({
      success: true,
      message: "All orders fetched successfully.",
      data: orders,
    });
  } catch (error) {
    console.error("getAllOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



// Update only orderStatus by ID
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { orderStatus } = req.body;  // extract orderStatus from request body

  if (!orderStatus) {
    return res.status(400).json({ success: false, message: "orderStatus is required" });
  }

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { orderStatus },  // update only orderStatus field
      { new: true, runValidators: true }
    )
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId")
      .populate({
        path: "cartId",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "restaurantId", select: "restaurantName locationName" },
          { path: "products.restaurantProductId", select: "name price image" },
          { path: "appliedCouponId", select: "code discountPercentage" },
        ],
      });

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error("updateOrderStatus error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



// Delete order by ID
exports.deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("deleteOrder error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// -------------------------
// GET ORDERS BY USER ID
// -------------------------
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ success: false, message: "Valid orderId is required." });

    let order = await Order.findById(orderId)
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId", "fullName mobileNumber"); // optional user info

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found." });

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order
    });

  } catch (error) {
    console.error("getOrderById error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.getOrdersByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid userId is required." });
    }

    // Build filter object dynamically
    const filter = { userId };

    // If orderStatus is passed in query, add that
    if (req.query.orderStatus) {
      filter.orderStatus = req.query.orderStatus;
    }

    // If “today” filter is requested (say via `today=true`), add date filter
    if (req.query.today === "true") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const orders = await Order.find(filter)
      .populate("restaurantId", "restaurantName locationName");

    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("getOrdersByUserId error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};




exports.getPreviousOrdersByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid userId is required." });
    }

    // Find orders for that user with status "Completed"
    const orders = await Order.find({
      userId,
      orderStatus: "Delivered"
    }).populate("restaurantId", "restaurantName locationName");

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error("getCompletedOrdersByUserId error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};



exports.getAcceptedOrdersByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required."
      });
    }

    console.log("🔍 USER ID:", userId);

    // Sirf latest order find karo BINA KISI FILTER KE
    const latestOrder = await Order.findOne({ userId })
      .sort({ createdAt: -1 })
      .lean();

    console.log("🎯 LATEST ORDER (BINA FILTER KE):");
    console.log("   Order ID:", latestOrder?._id?.toString());
    console.log("   Status:", latestOrder?.orderStatus);
    console.log("   Created At:", latestOrder?.createdAt);
    console.log("   Restaurant ID:", latestOrder?.restaurantId?.toString());
    console.log("   Delivery Boy ID:", latestOrder?.deliveryBoyId?.toString());

    if (!latestOrder) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this user."
      });
    }

    // ✅ NEW LOGIC: Check if latest order is Delivered or Cancelled
    if (["Delivered", "Cancelled"].includes(latestOrder.orderStatus)) {
      console.log("❌ Latest order is Delivered/Cancelled. Status:", latestOrder.orderStatus);
      return res.status(404).json({
        success: false,
        message: `Your latest order is already ${latestOrder.orderStatus}. No active orders found.`
      });
    }

    // ✅ Check if latest order has accepted status
    if (!["Accepted", "Rider Accepted"].includes(latestOrder.orderStatus)) {
      console.log("❌ Latest order is NOT accepted. Status:", latestOrder.orderStatus);
      return res.status(404).json({
        success: false,
        message: `Your latest order is ${latestOrder.orderStatus}. No accepted orders found.`
      });
    }

    // Agar accepted hai toh phir populate karo aur response bhejo
    const populatedOrder = await Order.findById(latestOrder._id)
      .populate("restaurantId", "restaurantName locationName")
      .populate("deliveryBoyId", "fullName mobileNumber profileImage");

    console.log("✅ Latest order IS accepted. Sending response...");

    // Rest of your processing code...
    const pickupTime = populatedOrder.acceptedAt ? new Date(populatedOrder.acceptedAt) : null;
    const deliveryTime = pickupTime ? new Date(pickupTime.getTime() + 30 * 60000) : null;

    const pickupTimeStr = pickupTime
      ? pickupTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "";

    const deliveryTimeStr = deliveryTime
      ? deliveryTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "";

    const result = {
      orderId: populatedOrder._id,
      message: "Vendor Accepted Your Order From",
      restaurantName: populatedOrder.restaurantId?.restaurantName || "Unknown Restaurant",
      restaurantLocation: populatedOrder.restaurantId?.locationName || "Unknown Location",

      orderDetails: {
        totalItems: populatedOrder.totalItems || 0,
        subTotal: `₹${populatedOrder.subTotal.toFixed(2)}`,
        deliveryCharge: `₹${populatedOrder.deliveryCharge.toFixed(2)}`,
        totalPayable: `₹${populatedOrder.totalPayable.toFixed(2)}`
      },

      deliveryFlow: {
        restaurant: {
          name: populatedOrder.restaurantId?.restaurantName || "Restaurant",
          time: pickupTimeStr
        },
        user: {
          address: populatedOrder.deliveryAddress || "Your Address",
          time: deliveryTimeStr
        }
      },

      riderDetails: populatedOrder.deliveryStatus === "Picked" || populatedOrder.orderStatus === "Rider Accepted"
        ? {
            id: populatedOrder.deliveryBoyId?._id || "N/A",
            profileImage: populatedOrder.deliveryBoyId?.profileImage || "default-profile-image.jpg",
            name: populatedOrder.deliveryBoyId?.fullName || "Delivery Boy",
            contact: populatedOrder.deliveryBoyId?.mobileNumber || "N/A"
          }
        : null
    };

    if (populatedOrder.orderStatus === "Rider Accepted") {
      result.message = "Rider Accepted Your Order From";
    }

    console.log("📤 FINAL RESPONSE ORDER ID:", result.orderId);
    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("getAcceptedOrdersByUserId error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

exports.getOrderByUserIdAndOrderId = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    // Validate userId and orderId
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId and orderId are required."
      });
    }

    // Fetch the order details for the user and orderId
    const order = await Order.findOne({
      _id: orderId,
      userId,
    })
      .populate("restaurantId", "restaurantName locationName")
      .populate("deliveryBoyId", "fullName mobileNumber profileImage");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    // If the order status is "Delivered", remove the order data from the response
    if (order.orderStatus === "Delivered") {
      return res.status(200).json({
        success: true,
        message: "Your order has been delivered. No further details are available."
      });
    }

    // Check if the order status allows viewing
    if (!["Accepted", "Rider Accepted", "Picked"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Order has not been accepted, rider has not accepted, or the order has not been picked yet. Please wait for acceptance before viewing details."
      });
    }

    const pickupTime = order.acceptedAt ? new Date(order.acceptedAt) : null;
    const deliveryTime = pickupTime ? new Date(pickupTime.getTime() + 30 * 60000) : null;

    const pickupTimeStr = pickupTime
      ? pickupTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "";

    const deliveryTimeStr = deliveryTime
      ? deliveryTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "";

    // Full response including all charges and products
    const result = {
      orderId: order._id,
      message: "Your Order Details",
      restaurantName: order.restaurantId?.restaurantName || "Unknown Restaurant",
      restaurantLocation: order.restaurantId?.locationName || "Unknown Location",

      orderDetails: {
        totalItems: order.totalItems || 0,
        subTotal: `₹${(Number(order.subTotal) || 0).toFixed(2)}`,
        deliveryCharge: `₹${(Number(order.deliveryCharge) || 0).toFixed(2)}`,
        totalPayable: `₹${(Number(order.totalPayable) || 0).toFixed(2)}`,
        gstCharges: `₹${(Number(order.gstCharges) || 0).toFixed(2)}`,
        packingCharges: `₹${(Number(order.packingCharges) || 0).toFixed(2)}`,
        gstOnDelivery: `₹${(Number(order.gstOnDelivery) || 0).toFixed(2)}`,
        platformCharge: `₹${(Number(order.platformCharge) || 0).toFixed(2)}`,
        couponDiscount: `₹${(Number(order.couponDiscount) || 0).toFixed(2)}`,
        totalDiscount: `₹${(Number(order.totalDiscount) || 0).toFixed(2)}`,
        distanceKm: order.distanceKm || 0,
        isDeliveryFree: order.isDeliveryFree || false,
        freeDeliveryThreshold: order.freeDeliveryThreshold || 0,
        perKmRate: order.perKmRate || 0,
        products: order.products || [],
        appliedCharges: order.appliedCharges || {},
        chargeCalculations: order.chargeCalculations || {}
      },

      deliveryFlow: {
        restaurant: {
          name: order.restaurantId?.restaurantName || "Restaurant",
          time: pickupTimeStr
        },
        user: {
          address: order.deliveryAddress || "Your Address",
          time: deliveryTimeStr
        }
      },

      riderDetails: (order.deliveryStatus === "Rider Accepted" || order.orderStatus === "Picked")
        ? {
            id: order.deliveryBoyId?._id || "N/A",
            name: order.deliveryBoyId?.fullName || "Delivery Boy",
            contact: order.deliveryBoyId?.mobileNumber || "N/A",
            profileImage: order.deliveryBoyId?.profileImage || "default-profile-image.jpg"
          }
        : null,

      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      transactionId: order.transactionId,
      acceptedAt: order.acceptedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("getOrderByUserIdAndOrderId error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};





// -------------------------
// UPDATE ORDER BY USER ID
// -------------------------
exports.updateOrderByUserId = async (req, res) => {
  try {
    const { userId } = req.body;
    const { orderId } = req.params;
    const updateFields = req.body.update || {}; // fields to update

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ success: false, message: "Valid orderId is required." });

    let order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    if (order.userId.toString() !== userId)
      return res.status(403).json({ success: false, message: "You are not authorized to update this order." });

    // Allowed fields to update (optional: add more fields if needed)
    const allowedFields = ["paymentStatus", "orderStatus", "paymentMethod"];
    for (const key of allowedFields) {
      if (updateFields[key] !== undefined) {
        order[key] = updateFields[key];
      }
    }

    await order.save();

    order = await Order.findById(order._id)
      .populate("restaurantId", "restaurantName locationName");

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order
    });

  } catch (error) {
    console.error("updateOrderByUserId error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
// -------------------------
// DELETE ORDER BY USER ID
// -------------------------
exports.deleteOrderByUserId = async (req, res) => {
  try {
    const { userId } = req.body;
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ success: false, message: "Valid orderId is required." });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    if (order.userId.toString() !== userId)
      return res.status(403).json({ success: false, message: "You are not authorized to delete this order." });

    await order.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully"
    });

  } catch (error) {
    console.error("deleteOrderByUserId error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
const haversineDistance = (coords1, coords2) => {
  const toRad = x => (x * Math.PI) / 180;

  // Ensure coords1 and coords2 are arrays with 2 elements (longitude, latitude)
  if (!Array.isArray(coords1) || !Array.isArray(coords2)) {
    throw new Error('Both coords1 and coords2 should be arrays containing longitude and latitude.');
  }

  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};


exports.vendorAcceptOrder = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;  // Extract orderId and vendorId from the URL parameters
    const { orderStatus } = req.body;  // ❌ preparationTime removed

    // Step 1: Find the order by orderId
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Step 2: Verify vendor ownership
    if (order.restaurantId.toString() !== vendorId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized action: Vendor ID does not match the order's restaurant"
      });
    }

    // Step 3: ❌ preparationTime validation removed

    // Step 4: Get the restaurant location from the order
    const restaurantCoords = order.restaurantLocation?.coordinates || [0, 0];
    if (restaurantCoords.length === 0) {
      return res.status(400).json({ success: false, message: "Restaurant location not available" });
    }

    // Step 5: Find active delivery boys within 10 km
    const nearbyDeliveryBoys = await DeliveryBoy.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: restaurantCoords,
          },
          $maxDistance: 10000 // 10 km in meters
        }
      },
      isActive: true,
      currentOrder: false
    });

    if (!nearbyDeliveryBoys.length) {
      return res.status(404).json({
        success: false,
        message: "No delivery boys found within 10 km or all are busy"
      });
    }

    // Step 6: Collect delivery boy info
    let deliveryBoysInfo = [];

    for (let i = 0; i < nearbyDeliveryBoys.length; i++) {
      const deliveryBoy = nearbyDeliveryBoys[i];
      deliveryBoysInfo.push({
        deliveryBoyId: deliveryBoy._id,
        fullName: deliveryBoy.fullName,
        mobileNumber: deliveryBoy.mobileNumber,
        vehicleType: deliveryBoy.vehicleType,
        walletBalance: deliveryBoy.walletBalance,
        status: deliveryBoy.deliveryBoyStatus,
      });
    }

    // Step 7: Update order status
    order.orderStatus = orderStatus || "Pending";
    order.deliveryStatus = "Pending";
    order.acceptedAt = new Date();
    order.distanceKm = 0;

    // ❌ Step for preparationTime removed

    // Step 8: Save available delivery boys in order
    order.availableDeliveryBoys = deliveryBoysInfo;

    // Step 9: Delivery charge
    const deliveryCharge = order.deliveryCharge || 0;

    // Save order
    await order.save();

    // Step 10: Response
    res.status(200).json({
      success: true,
      message: "Order accepted, delivery boys available for this order",
      order,
      availableDeliveryBoys: deliveryBoysInfo,
      deliveryCharge,
      count: deliveryBoysInfo.length,
    });

  } catch (err) {
    console.error("Error accepting order:", err);
    res.status(500).json({
      success: false,
      message: "Error accepting order",
      error: err.message
    });
  }
};


// Assign delivery partner
exports.assignDeliveryAndTrack = async (req, res) => {
  try {
    const { deliveryUserId, eta } = req.body;
    const deliveryUser = await User.findById(deliveryUserId);
    if (!deliveryUser) return res.status(404).json({ success: false, message: "Delivery user not found" });

    const updatedOrder = await Order.findByIdAndUpdate(req.params.orderId, {
      deliveryUserId,
      deliveryEta: eta,
      status: "ongoing"
    }, { new: true });

    res.status(200).json({
      success: true,
      message: "Delivery partner assigned",
      data: {
        order: updatedOrder,
        deliveryPerson: {
          name: deliveryUser.fullName,
          phone: deliveryUser.phoneNumber,
          eta
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error assigning delivery partner", error: err.message });
  }
};


// ✅ GET: Today's Bookings by User
exports.getTodaysBookingsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Valid userId is required." });
    }

    // Calculate start and end of today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch today's orders for this user
    const orders = await Order.find({
      userId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
      .populate("restaurantId", "restaurantName locationName")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Today's bookings fetched successfully",
      count: orders.length,
      data: orders.map(order => ({
        orderId: order._id,
        totalItems: order.totalItems,
        subTotal: order.subTotal,
        deliveryCharge: order.deliveryCharge,
        totalPayable: order.totalPayable,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        restaurantLocation: order.restaurantLocation,
        restaurantDetails: order.restaurantId,
        products: order.products,
        createdAt: order.createdAt
      }))
    });

  } catch (error) {
    console.error("getTodaysBookingsByUserId error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
// ✅ POST: Get Orders by Status
exports.getOrdersByStatus = async (req, res) => {
  try {
    const { userId, status } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Valid userId is required." });
    }

    // Validate status if provided
    const validStatuses = ["Pending", "Confirmed", "Delivered", "Cancelled"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid order status." });
    }

    // Build filter
    const filter = { userId };
    if (status) filter.orderStatus = status;

    // Fetch orders
    const orders = await Order.find(filter)
      .populate("restaurantId", "restaurantName locationName")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      count: orders.length,
      data: orders.map(order => ({
        orderId: order._id,
        totalItems: order.totalItems,
        subTotal: order.subTotal,
        deliveryCharge: order.deliveryCharge,
        totalPayable: order.totalPayable,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        restaurantLocation: order.restaurantLocation,
        restaurantDetails: order.restaurantId,
        products: order.products,
        createdAt: order.createdAt
      }))
    });

  } catch (error) {
    console.error("getOrdersByStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



exports.acceptOrderByRestaurant = async (req, res) => {
  try {
    const { restaurantId, orderId, orderStatus } = req.body;

    // Validate required fields
    if (!restaurantId || !orderId || !orderStatus) {
      return res.status(400).json({
        success: false,
        message: "restaurantId, orderId, and orderStatus are required.",
      });
    }

    // Validate orderStatus value (optional: you can add allowed statuses)

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Check if the order belongs to the restaurant
    if (order.restaurantId.toString() !== restaurantId) {
      return res.status(400).json({
        success: false,
        message: "This order doesn't belong to your restaurant.",
      });
    }

    // Update order status dynamically
    order.orderStatus = orderStatus;
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status has been updated to '${orderStatus}'.`,
      data: order,
    });
  } catch (error) {
    console.error("Error updating order status by restaurant:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};




exports.getAcceptedOrdersForRider = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;  // Extract deliveryBoyId from params

    // Step 1: Check if the delivery boy has a current order assigned
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found."
      });
    }

    // If the delivery boy has a current order (currentOrder = true), don't fetch new orders
    if (deliveryBoy.currentOrder === true) {
      return res.status(400).json({
        success: false,
        message: "This delivery boy already has an active order assigned."
      });
    }

    // Step 2: Find the orders where deliveryBoyId is in availableDeliveryBoys and deliveryStatus is 'Pending'
    const orders = await Order.find({
      "availableDeliveryBoys.deliveryBoyId": deliveryBoyId,  // Check if deliveryBoyId is in availableDeliveryBoys array
      deliveryStatus: "Pending"  // Only consider orders with deliveryStatus 'Pending'
    })
      .populate("restaurantId")  // Optionally, populate restaurantId to get full restaurant data
      .select('-availableDeliveryBoys');  // Exclude availableDeliveryBoys from the response

    // Step 3: If no orders are found
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this delivery boy with 'Pending' status."
      });
    }

    // Step 4: Return the full order data where the deliveryBoyId is present and deliveryStatus is 'Pending'
    return res.status(200).json({
      success: true,
      message: "Orders found for the delivery boy.",
      orders: orders,  // Returning the full order data
    });

  } catch (err) {
    console.error("Error fetching orders:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};




exports.acceptOrderForRider = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const { orderId, deliveryBoyId } = req.params;

    // Step 1: Validate the delivery boy
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Step 2: Check if the rider already has a current order
    if (deliveryBoy.currentOrder) {
      return res.status(400).json({
        success: false,
        message: "This rider already has an active order. Complete it before accepting a new one.",
      });
    }

    // Step 3: Validate the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Step 4: Check if the order has already been accepted by another rider
    if (order.deliveryStatus === "Rider Accepted") {
      return res.status(400).json({
        success: false,
        message: "This order has already been accepted by another rider.",
      });
    }

    // Step 5: Handle Rider Acceptance
    if (orderStatus === "Rider Accepted" && order.orderStatus === "Accepted") {
      // Update order status and delivery status
      order.orderStatus = "Rider Accepted";
      order.deliveryStatus = "Rider Accepted";

      // Assign the current delivery boy to this order
      order.deliveryBoyId = deliveryBoy._id;

      // Mark delivery boy as having a current order
      deliveryBoy.currentOrder = true;
      
      // **Update the currentOrderStatus with the order's status**
      deliveryBoy.currentOrderStatus = orderStatus;  // Add the orderStatus to currentOrderStatus

      // Save both order and delivery boy
      await order.save();
      await deliveryBoy.save();

      console.log(`Order ${orderId} accepted by delivery boy ${deliveryBoyId}`);

      return res.status(200).json({
        success: true,
        message: "Order accepted by rider.",
        data: [order],  // Wrapping the order in an array
      });
    }

    // Step 6: Handle Rider Rejection
    if (orderStatus === "Rider Rejected") {
      order.deliveryStatus = "Rider Rejected";
      await order.save();

      console.log(`Order ${orderId} rejected by delivery boy ${deliveryBoyId}`);

      // Assign to another delivery boy after 30 seconds
      setTimeout(async () => {
        const newDeliveryBoy = await DeliveryBoy.findOne({ status: "Available" });

        if (newDeliveryBoy) {
          order.deliveryStatus = "Assigned";
          await order.save();
          console.log("New delivery boy assigned:", newDeliveryBoy._id);
        } else {
          console.log("No available delivery boy found.");
        }
      }, 30000);

      return res.status(200).json({
        success: true,
        message: "Order status updated to 'Rider Rejected'. New delivery boy will be assigned shortly.",
        data: [order],  // Wrapping the order in an array
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid order status or request.",
    });
  } catch (error) {
    console.error("Error accepting/rejecting order for rider:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



exports.getOrdersForRider = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    // Fetch orders where both the orderStatus and deliveryStatus are "Rider Accepted" and deliveryBoyId is present (assigned to a delivery boy)
    const riderAcceptedOrders = await Order.find({
      orderStatus: "Rider Accepted",  // Order status is "Rider Accepted"
      deliveryStatus: "Rider Accepted",  // Delivery status is "Rider Accepted"
      deliveryBoyId: deliveryBoyId  // Order is assigned to the specific delivery boy
    })
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId", "name email")
      .populate("deliveryBoyId", "fullName mobileNumber")
      .select('-availableDeliveryBoys');  // Exclude availableDeliveryBoys from the response

    // If no orders found
    if (!riderAcceptedOrders || riderAcceptedOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No rider accepted orders found for this delivery boy."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rider accepted orders fetched successfully.",
      data: riderAcceptedOrders,
    });
  } catch (error) {
    console.error("Error fetching rider accepted orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



exports.getDeliveredOrdersForRider = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params; // Extract the deliveryBoyId from params

    // Fetch orders where both the orderStatus and deliveryStatus are "Delivered" and the order is assigned to the specific delivery boy
    const deliveredOrders = await Order.find({
      orderStatus: "Delivered",  // Order status is "Delivered"
      deliveryStatus: "Delivered",  // Delivery status is "Delivered"
      deliveryBoyId: deliveryBoyId  // Order is assigned to the specific delivery boy
    })
      .populate("restaurantId", "restaurantName locationName") // Populate restaurant details
      .populate("userId", "name email") // Populate user details
      .populate("deliveryBoyId", "fullName mobileNumber") // Populate delivery boy details
      .select('-availableDeliveryBoys');  // Exclude the availableDeliveryBoys field from the response

    // If no delivered orders found
    if (!deliveredOrders || deliveredOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No delivered orders found for this delivery boy."
      });
    }

    // Return the list of delivered orders
    return res.status(200).json({
      success: true,
      message: "Delivered orders fetched successfully.",
      data: deliveredOrders,
    });
  } catch (error) {
    console.error("Error fetching delivered orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};




exports.acceptPickupForRider = async (req, res) => {
  try {
    const { orderStatus } = req.body; // Get orderStatus from the body
    const { orderId, deliveryBoyId } = req.params; // Get orderId and deliveryBoyId from params

    // Validate the delivery boy
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Validate the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Ensure the order is in "Rider Accepted" status before proceeding to "Picked"
    if (orderStatus !== "Picked" || order.orderStatus !== "Rider Accepted" || order.deliveryStatus !== "Rider Accepted") {
      return res.status(400).json({
        success: false,
        message: "Order is not in 'Rider Accepted' status or invalid order status.",
      });
    }

    // Change order status and delivery status to "Picked"
    order.orderStatus = "Picked";  // Change order status to "Picked"
    order.deliveryStatus = "Picked";  // Update delivery status to "Picked"

    // **Update the currentOrderStatus in DeliveryBoy schema**
    deliveryBoy.currentOrderStatus = "Picked";  // Set the delivery boy's current order status

    // Save both order and delivery boy
    await order.save();
    await deliveryBoy.save();

    return res.status(200).json({
      success: true,
      message: "Order status updated to 'Picked'.",
      data: order,
    });
  } catch (error) {
    console.error("Error accepting pickup for rider:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};




exports.getRiderPickedOrders = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    // Fetch orders where both the orderStatus and deliveryStatus are "Picked" and deliveryBoyId is assigned
    const pickedOrders = await Order.find({
      orderStatus: "Picked",  // Order status is "Picked"
      deliveryStatus: "Picked",  // Delivery status is "Picked"
      deliveryBoyId: deliveryBoyId  // Assigned to the specific delivery boy
    }).populate("restaurantId", "restaurantName locationName")
      .populate("userId", "firstName lastName phoneNumber email")
      .populate("deliveryBoyId", "fullName mobileNumber");

    // If no orders found
    if (!pickedOrders || pickedOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No picked orders found for this delivery boy."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Picked orders fetched successfully.",
      data: pickedOrders,
    });
  } catch (error) {
    console.error("Error fetching picked orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};




// exports.markOrderAsDelivered = async (req, res) => {
//   try {
//     const { deliveryBoyId, orderId, paymentType } = req.body;

//     console.log('🔵 MARK ORDER AS DELIVERED STARTED');
//     console.log('📦 Order ID:', orderId);
//     console.log('🚴 Delivery Boy ID:', deliveryBoyId);
//     console.log('💰 Payment Type:', paymentType);

//     // Validate the delivery boy
//     const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
//     if (!deliveryBoy) {
//       console.log('❌ Delivery boy not found:', deliveryBoyId);
//       return res.status(404).json({
//         success: false,
//         message: "Delivery boy not found.",
//       });
//     }
//     console.log('✅ Delivery boy found:', deliveryBoy._id, '-', deliveryBoy.name);

//     // Validate the order
//     const order = await Order.findById(orderId).populate('restaurantId');
//     if (!order) {
//       console.log('❌ Order not found:', orderId);
//       return res.status(404).json({
//         success: false,
//         message: "Order not found.",
//       });
//     }
//     console.log('✅ Order found:', order._id);
//     console.log('📊 Order Details:', {
//       orderStatus: order.orderStatus,
//       deliveryStatus: order.deliveryStatus,
//       userId: order.userId,
//       subTotal: order.subTotal,
//       deliveryCharge: order.deliveryCharge,
//       totalPayable: order.totalPayable
//     });

//     // Ensure the order is in "Picked" status before proceeding to "Delivered"
//     if (order.orderStatus !== "Picked" || order.deliveryStatus !== "Picked") {
//       console.log('❌ Order status check failed:', {
//         orderStatus: order.orderStatus,
//         deliveryStatus: order.deliveryStatus,
//         required: 'Picked'
//       });
//       return res.status(400).json({
//         success: false,
//         message: "Order is not in 'Picked' status.",
//       });
//     }
//     console.log('✅ Order is in "Picked" status');

//     // Mark order as delivered and update statuses
//     order.orderStatus = "Delivered";
//     order.deliveryStatus = "Delivered";
//     console.log('📈 Order status updated to "Delivered"');

//     // Store the paymentType in the order
//     if (paymentType) {
//       order.paymentType = paymentType;
//       console.log('💰 Payment type added to order:', paymentType);
//     }

//     // Handle payment for COD orders (without UPI ID)
//     if (order.paymentMethod === "COD") {
//       order.paymentStatus = "Paid";
//       console.log('💵 COD order - Payment status set to "Paid"');
//     } else {
//       order.paymentStatus = "Completed";
//       console.log('💳 Non-COD order - Payment status set to "Completed"');
//     }

//     // ========== DISTRIBUTE PAYMENT TO ADMIN AND RESTAURANT ==========
//     console.log('\n💸 PAYMENT DISTRIBUTION STARTED');
    
//     // 1. Find the restaurant
//     const restaurant = await Restaurant.findById(order.restaurantId);
//     if (!restaurant) {
//       console.log('❌ Restaurant not found for order:', order.restaurantId);
//       return res.status(404).json({
//         success: false,
//         message: "Restaurant not found.",
//       });
//     }
//     console.log('✅ Restaurant found:', restaurant._id, '-', restaurant.restaurantName);

//     // 2. **FIXED: Now always use 20% commission from subtotal**
//     const commissionPercentage = 20; // FIXED 20% commission
    
//     // 3. **CHANGED: Calculate commission from SUBTOTAL, not totalPayable**
//     const subtotal = order.subTotal || order.totalAmount || 0;
    
//     // Delivery charge alag se rahega
//     const deliveryCharge = order.deliveryCharge || 0;
//     const totalPayable = order.totalPayable || 0;
    
//     // Calculate amounts based on SUBTOTAL
//     const adminCommission = (subtotal * commissionPercentage) / 100;
//     const restaurantAmount = subtotal - adminCommission;
    
//     console.log("📊 Payment Distribution Details:", {
//       subtotal: subtotal.toFixed(2),
//       deliveryCharge: deliveryCharge.toFixed(2),
//       totalPayable: totalPayable.toFixed(2),
//       commissionPercentage: `${commissionPercentage}%`,
//       adminCommission: adminCommission.toFixed(2),
//       restaurantAmount: restaurantAmount.toFixed(2)
//     });

//     // 4. Update Admin wallet (add commission) - FIXED
//     const admin = await adminModel.findOne();
    
//     if (admin) {
//       console.log('👑 Admin found:', admin._id);
      
//       // CRITICAL FIX: Check if walletBalance exists, if not create it
//       if (admin.walletBalance === undefined) {
//         admin.walletBalance = 0;
//         console.log('⚠️ Admin wallet balance was undefined, set to 0');
//       }
      
//       const adminBalanceBefore = admin.walletBalance;
      
//       // Now add commission
//       admin.walletBalance = admin.walletBalance + adminCommission;
      
//       console.log('💰 Admin wallet updated:', {
//         before: adminBalanceBefore.toFixed(2),
//         added: adminCommission.toFixed(2),
//         after: admin.walletBalance.toFixed(2)
//       });
      
//       // Create transaction object
//       const transactionObj = {
//         amount: adminCommission,
//         dateAdded: new Date().toISOString(),
//         type: "commission",
//         orderId: orderId.toString(),
//         restaurantId: restaurant._id.toString(),
//         restaurantName: restaurant.restaurantName,
//         subtotal: subtotal,
//         commissionPercentage: commissionPercentage,
//         description: `Commission from order #${orderId.toString().substring(0, 8)} (20% of subtotal)`
//       };
      
//       // Initialize if not exists
//       if (!admin.walletTransactions || !Array.isArray(admin.walletTransactions)) {
//         admin.walletTransactions = [];
//         console.log('📝 Admin wallet transactions array initialized');
//       }
      
//       // Admin ke liye JSON string push karo
//       admin.walletTransactions.push(JSON.stringify(transactionObj));
//       console.log('📋 Admin transaction added:', transactionObj.description);
      
//       // Mark fields as modified
//       admin.markModified('walletBalance');
//       admin.markModified('walletTransactions');
      
//       await admin.save();
//       console.log('💾 Admin saved successfully');
//     } else {
//       console.log('❌ Admin not found in database');
//     }

//     // 5. Update Restaurant wallet (add restaurant's share)
//     console.log('\n🏪 RESTAURANT PAYMENT PROCESSING');
    
//     // Check and initialize restaurant wallet fields
//     if (restaurant.walletBalance === undefined) {
//       restaurant.walletBalance = 0;
//       console.log('⚠️ Restaurant wallet balance was undefined, set to 0');
//     }
//     if (restaurant.totalEarnings === undefined) {
//       restaurant.totalEarnings = 0;
//       console.log('⚠️ Restaurant totalEarnings was undefined, set to 0');
//     }
//     if (restaurant.totalCommissionPaid === undefined) {
//       restaurant.totalCommissionPaid = 0;
//       console.log('⚠️ Restaurant totalCommissionPaid was undefined, set to 0');
//     }
    
//     const restaurantBalanceBefore = restaurant.walletBalance;
//     const totalEarningsBefore = restaurant.totalEarnings;
//     const totalCommissionBefore = restaurant.totalCommissionPaid;
    
//     restaurant.walletBalance = restaurant.walletBalance + restaurantAmount;
//     restaurant.totalEarnings = restaurant.totalEarnings + restaurantAmount;
//     restaurant.totalCommissionPaid = restaurant.totalCommissionPaid + adminCommission;
    
//     console.log('🏪 Restaurant wallet updated:', {
//       walletBalance: {
//         before: restaurantBalanceBefore.toFixed(2),
//         added: restaurantAmount.toFixed(2),
//         after: restaurant.walletBalance.toFixed(2)
//       },
//       totalEarnings: {
//         before: totalEarningsBefore.toFixed(2),
//         added: restaurantAmount.toFixed(2),
//         after: restaurant.totalEarnings.toFixed(2)
//       },
//       totalCommissionPaid: {
//         before: totalCommissionBefore.toFixed(2),
//         added: adminCommission.toFixed(2),
//         after: restaurant.totalCommissionPaid.toFixed(2)
//       }
//     });
    
//     // Initialize if not exists
//     if (!restaurant.walletTransactions || !Array.isArray(restaurant.walletTransactions)) {
//       restaurant.walletTransactions = [];
//       console.log('📝 Restaurant wallet transactions array initialized');
//     }
    
//     // Restaurant ke liye transaction object
//     const restaurantTransaction = {
//       amount: restaurantAmount,
//       dateAdded: new Date().toISOString(),
//       type: "order_payment",
//       orderId: orderId.toString(),
//       subtotal: subtotal,
//       commissionDeducted: adminCommission,
//       commissionPercentage: commissionPercentage,
//       netAmount: restaurantAmount,
//       description: `Payment for order #${orderId.toString().substring(0, 8)} (80% of subtotal)`
//     };
    
//     // Restaurant ke liye JSON string push karo
//     restaurant.walletTransactions.push(JSON.stringify(restaurantTransaction));
//     console.log('📋 Restaurant transaction added:', restaurantTransaction.description);
    
//     await restaurant.save();
//     console.log('💾 Restaurant saved successfully');

//     // 6. Update order with commission details
//     order.adminCommission = adminCommission;
//     order.restaurantPayout = restaurantAmount;
//     order.commissionPercentage = commissionPercentage;
//     order.commissionAppliedOn = "subtotal"; // Indicate commission was applied on subtotal
//     console.log('📋 Order commission details updated');

//     // ========== NEW: REFERRAL REWARD LOGIC ==========
//     console.log('\n🎁 REFERRAL REWARD PROCESSING STARTED');
//     let referralRewardDetails = null;

//     // Find the user who placed this order
//     const user = await User.findById(order.userId);
    
//     if (user) {
//       console.log('👤 Order user found:', user._id, '-', user.name || user.email);
//       console.log('🔍 Checking user.referredBy field:', user.referredBy);
      
//       if (user.referredBy) {
//         console.log('🎯 User has a referrer! Referrer CODE:', user.referredBy);
//         console.log('📧 User email:', user.email);
//         console.log('📞 User phone:', user.phone);
        
//         const referralCommissionPercentage = 6; // 6% of admin commission
//         const userFixedReward = 20; // ₹20 fixed reward for user referrals
        
//         // Calculate reward amounts
//         const referralRewardFromCommission = (adminCommission * referralCommissionPercentage) / 100;
        
//         console.log('📐 Referral calculations:', {
//           adminCommission: adminCommission.toFixed(2),
//           referralPercentage: `${referralCommissionPercentage}%`,
//           referralRewardFromCommission: referralRewardFromCommission.toFixed(2),
//           userFixedReward: userFixedReward.toFixed(2)
//         });
        
//         // Get the referral code from user
//         const referralCode = user.referredBy;
        
//         console.log('🔎 Looking for referrer with CODE:', referralCode);
        
//         // Try to find as Ambassador first (searching by referralCode field)
//         let referrer = await Ambassador.findOne({ referralCode: referralCode });
//         let referrerType = "ambassador";
        
//         if (referrer) {
//           console.log('🎖️ Referrer found as AMBASSADOR:', referrer._id);
//           console.log('📛 Ambassador name:', referrer.name);
//           console.log('📞 Ambassador phone:', referrer.phone);
//           console.log('🔑 Ambassador referral code:', referrer.referralCode);
//         } else {
//           console.log('❌ Not found as Ambassador, trying Restaurant...');
          
//           // If not found as Ambassador, try as Restaurant (searching by referralCode field)
//           referrer = await Restaurant.findOne({ referralCode: referralCode });
//           referrerType = "restaurant";
          
//           if (referrer) {
//             console.log('🏪 Referrer found as RESTAURANT:', referrer._id);
//             console.log('🏬 Restaurant name:', referrer.restaurantName);
//             console.log('🔑 Restaurant referral code:', referrer.referralCode);
//           } else {
//             console.log('❌ Not found as Restaurant, trying User...');
            
//             // If still not found, try as User (searching by referralCode field)
//             referrer = await User.findOne({ referralCode: referralCode });
//             referrerType = "user";
            
//             if (referrer) {
//               console.log('👤 Referrer found as USER:', referrer._id);
//               console.log('📛 User name:', referrer.name);
//               console.log('📞 User phone:', referrer.phone);
//               console.log('🔑 User referral code:', referrer.referralCode);
//             } else {
//               console.log('❌ Referrer not found in any collection with referralCode:', referralCode);
//               console.log('ℹ️ Searching in: Ambassador.referralCode, Restaurant.referralCode, User.referralCode');
//             }
//           }
//         }
        
//         if (referrer) {
//           console.log(`✅ Referrer confirmed as ${referrerType.toUpperCase()}:`, referrer._id);
//           console.log(`🔑 Referrer code: ${referrer.referralCode}`);
          
//           let rewardAmount = 0;
//           let rewardDescription = "";
          
//           // Determine reward based on referrer type
//           if (referrerType === "ambassador" || referrerType === "restaurant") {
//             // Ambassador or Restaurant gets 6% of admin commission
//             rewardAmount = referralRewardFromCommission;
//             rewardDescription = `6% of admin commission for referring user ${user._id} (${user.name || user.email})`;
//             console.log(`💰 ${referrerType.toUpperCase()} reward: ${rewardAmount.toFixed(2)} (6% of admin commission)`);
//           } else if (referrerType === "user") {
//             // User gets fixed ₹20 reward
//             rewardAmount = userFixedReward;
//             rewardDescription = `₹20 fixed reward for referring user ${user._id} (${user.name || user.email})`;
//             console.log(`💰 USER reward: ${rewardAmount.toFixed(2)} (Fixed ₹20)`);
//           }
          
//           // Update referrer's wallet
//           const referrerWalletBefore = referrer.walletBalance || 0;
          
//           if (referrer.walletBalance === undefined) {
//             referrer.walletBalance = 0;
//             console.log('⚠️ Referrer wallet balance was undefined, set to 0');
//           }
          
//           referrer.walletBalance = referrer.walletBalance + rewardAmount;
          
//           console.log(`💰 Referrer wallet updated (${referrerType}):`, {
//             before: referrerWalletBefore.toFixed(2),
//             added: rewardAmount.toFixed(2),
//             after: referrer.walletBalance.toFixed(2)
//           });
          
//           // Initialize wallet transactions if not exists
//           if (!referrer.walletTransactions || !Array.isArray(referrer.walletTransactions)) {
//             referrer.walletTransactions = [];
//             console.log('📝 Referrer wallet transactions array initialized');
//           }
          
//           // Add transaction record
//           const referralTransaction = {
//             amount: rewardAmount,
//             dateAdded: new Date(),
//             type: "referral_reward",
//             orderId: orderId,
//             referredUserId: user._id,
//             referredUserName: user.name || user.email,
//             referredUserCode: user.referralCode || 'No code',
//             orderAmount: subtotal,
//             referralCodeUsed: referralCode,
//             description: rewardDescription
//           };
          
//           // Check the model type to determine how to store the transaction
//           if (referrerType === "user") {
//             // For User model, store as proper object
//             referrer.walletTransactions.push(referralTransaction);
//             console.log('📋 User referral transaction added as object');
//           } else {
//             // For Ambassador/Restaurant, store as JSON string
//             referrer.walletTransactions.push(JSON.stringify(referralTransaction));
//             console.log('📋 Ambassador/Restaurant referral transaction added as JSON string');
//           }
          
//           // Save the referrer
//           await referrer.save();
//           console.log(`💾 Referrer (${referrerType}) saved successfully`);
          
//           // Deduct the reward from admin's wallet
//           if (admin) {
//             const adminBalanceBeforeDeduction = admin.walletBalance;
//             admin.walletBalance = admin.walletBalance - rewardAmount;
            
//             console.log('👑 Admin wallet deduction for referral:', {
//               before: adminBalanceBeforeDeduction.toFixed(2),
//               deducted: rewardAmount.toFixed(2),
//               after: admin.walletBalance.toFixed(2),
//               referrerType: referrerType,
//               referrerId: referrer._id,
//               referrerCode: referrer.referralCode
//             });
            
//             // Add a transaction record for the deduction
//             const adminDeductionTransaction = {
//               amount: -rewardAmount,
//               dateAdded: new Date().toISOString(),
//               type: "referral_payout",
//               orderId: orderId.toString(),
//               referrerId: referrer._id.toString(),
//               referrerType: referrerType,
//               referrerName: referrer.name || referrer.restaurantName || referrer._id,
//               referrerCode: referrer.referralCode,
//               referredUserId: user._id.toString(),
//               referredUserName: user.name || user.email,
//               referralCodeUsed: referralCode,
//               description: `Referral reward paid to ${referrerType} "${referrer.name || referrer.restaurantName || referrer._id}" (code: ${referrer.referralCode}) for order #${orderId.toString().substring(0, 8)}`
//             };
            
//             admin.walletTransactions.push(JSON.stringify(adminDeductionTransaction));
//             console.log('📋 Admin deduction transaction added');
            
//             admin.markModified('walletBalance');
//             admin.markModified('walletTransactions');
//             await admin.save();
//             console.log('💾 Admin saved after referral deduction');
//           }
          
//           // Update order with referral info
//           order.referredBy = referralCode; // Store the referral code
//           order.referredById = referrer._id; // Store the actual referrer ID
//           order.referrerType = referrerType;
//           order.referralRewardPaid = rewardAmount;
//           order.referredUserName = user.name || user.email;
//           order.referrerName = referrer.name || referrer.restaurantName || referrer._id;
//           order.referrerCode = referrer.referralCode; // Store the referrer's code
          
//           console.log('📋 Order updated with referral info:', {
//             referredByCode: referralCode,
//             referredById: referrer._id,
//             referrerType: referrerType,
//             referralRewardPaid: rewardAmount.toFixed(2),
//             referredUserName: user.name || user.email,
//             referrerName: referrer.name || referrer.restaurantName || referrer._id,
//             referrerCode: referrer.referralCode
//           });
          
//           // Prepare response details
//           referralRewardDetails = {
//             referrerType: referrerType,
//             referrerId: referrer._id,
//             referrerCode: referrer.referralCode,
//             referrerName: referrer.name || referrer.restaurantName || referrer._id,
//             rewardAmount: rewardAmount,
//             rewardSource: referrerType === "user" ? "fixed ₹20" : "6% of admin commission",
//             deductedFromAdmin: true,
//             adminWalletAfterDeduction: admin ? admin.walletBalance : null,
//             referredUserId: user._id,
//             referredUserName: user.name || user.email,
//             referralCodeUsed: referralCode
//           };
          
//           console.log(`🎁 Referral reward PROCESSED: ₹${rewardAmount.toFixed(2)} to ${referrerType} "${referrer.name || referrer.restaurantName || referrer._id}" (code: ${referrer.referralCode})`);
//         } else {
//           console.log('⚠️ Referrer code found in user.referredBy but no matching referrer found in database');
//           console.log('📝 Store this info in order for manual investigation');
          
//           // Even if referrer not found, store the code in order for investigation
//           order.referredBy = referralCode;
//           order.referrerType = "unknown";
//           order.referralRewardPaid = 0;
//           order.referredUserName = user.name || user.email;
//           order.referralError = "Referrer code found but referrer not in database";
          
//           console.log('📋 Order updated with referral error info');
//         }
//       } else {
//         console.log('ℹ️ No referrer found for this user (user.referredBy is null/undefined)');
//       }
//     } else {
//       console.log('❌ User not found for order.userId:', order.userId);
//     }

//     // ========== UPDATE DELIVERY BOY WALLET ==========
//     console.log('\n🚴 DELIVERY BOY PAYMENT PROCESSING');
    
//     const deliveryBoyBalanceBefore = deliveryBoy.walletBalance || 0;
    
//     // Update the delivery boy's wallet
//     deliveryBoy.walletBalance = (deliveryBoy.walletBalance || 0) + deliveryCharge;
    
//     console.log('💰 Delivery boy wallet updated:', {
//       before: deliveryBoyBalanceBefore.toFixed(2),
//       added: deliveryCharge.toFixed(2),
//       after: deliveryBoy.walletBalance.toFixed(2),
//       deliveryBoyName: deliveryBoy.name
//     });

//     // Initialize if not exists
//     if (!deliveryBoy.walletTransactions || !Array.isArray(deliveryBoy.walletTransactions)) {
//       deliveryBoy.walletTransactions = [];
//       console.log('📝 Delivery boy wallet transactions array initialized');
//     }
    
//     // DeliveryBoy ke liye PROPER OBJECT push karo (JSON string nahi)
//     const deliveryTransaction = {
//       amount: deliveryCharge,
//       dateAdded: new Date(),
//       type: "delivery",
//       orderId: orderId,
//       description: `Delivery charge for order #${orderId.toString().substring(0, 8)}`
//     };
    
//     // Push as proper object
//     deliveryBoy.walletTransactions.push(deliveryTransaction);
//     console.log('📋 Delivery boy transaction added:', deliveryTransaction.description);

//     // **Update the delivery boy's currentOrderStatus to 'Delivered'**
//     deliveryBoy.currentOrderStatus = "Delivered";

//     // Set the delivery boy's currentOrder to false (mark as available again)
//     deliveryBoy.currentOrder = false;
    
//     console.log('🚴 Delivery boy status updated:', {
//       currentOrderStatus: "Delivered",
//       currentOrder: false,
//       available: true
//     });

//     // Save the updated order and delivery boy
//     await order.save();
//     console.log('💾 Order saved with all updates');
    
//     await deliveryBoy.save();
//     console.log('💾 Delivery boy saved with all updates');

//     console.log('\n✅ ALL PROCESSES COMPLETED SUCCESSFULLY');
//     console.log('📊 FINAL SUMMARY:');
//     console.log('- Order marked as Delivered');
//     console.log('- Payment distributed: Admin, Restaurant, Delivery Boy');
//     if (referralRewardDetails) {
//       console.log('- Referral reward processed:', {
//         type: referralRewardDetails.referrerType,
//         name: referralRewardDetails.referrerName,
//         code: referralRewardDetails.referrerCode,
//         amount: referralRewardDetails.rewardAmount.toFixed(2)
//       });
//     } else {
//       console.log('- No referral reward processed');
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Order marked as 'Delivered', payment status updated, and funds distributed.",
//       data: {
//         order,
//         paymentDistribution: {
//           subtotal: subtotal,
//           deliveryCharge: deliveryCharge,
//           totalPayable: totalPayable,
//           commissionPercentage: `${commissionPercentage}%`,
//           commissionAppliedOn: "subtotal",
//           adminCommission: adminCommission,
//           restaurantAmount: restaurantAmount,
//           deliveryCharge: deliveryCharge,
//           distribution: {
//             admin: `${commissionPercentage}% of subtotal`,
//             restaurant: `${100 - commissionPercentage}% of subtotal`,
//             deliveryBoy: "100% of delivery charge"
//           }
//         },
//         referralReward: referralRewardDetails,
//         adminUpdated: admin ? {
//           walletBalance: admin.walletBalance,
//           hasWalletBalanceField: admin.walletBalance !== undefined
//         } : null,
//         logs: {
//           userFound: !!user,
//           hadReferrer: !!(user && user.referredBy),
//           referrerType: referralRewardDetails?.referrerType || 'none',
//           referrerCode: referralRewardDetails?.referrerCode || 'none',
//           rewardAmount: referralRewardDetails?.rewardAmount || 0
//         }
//       },
//     });
//   } catch (error) {
//     console.error("❌❌❌ ERROR marking order as delivered:", error);
//     console.error("Error stack:", error.stack);
//     return res.status(500).json({
//       success: false,
//       message: "Server error.",
//       error: error.message,
//     });
//   }
// };






exports.markOrderAsDelivered = async (req, res) => {
  try {
    const { deliveryBoyId, orderId, paymentType } = req.body;

    console.log('🔵 MARK ORDER AS DELIVERED STARTED');
    console.log('📦 Order ID:', orderId);
    console.log('🚴 Delivery Boy ID:', deliveryBoyId);
    console.log('💰 Payment Type:', paymentType);

    // Validate the delivery boy
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      console.log('❌ Delivery boy not found:', deliveryBoyId);
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }
    console.log('✅ Delivery boy found:', deliveryBoy._id, '-', deliveryBoy.name);

    // Validate the order
    const order = await Order.findById(orderId).populate('restaurantId');
    if (!order) {
      console.log('❌ Order not found:', orderId);
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }
    console.log('✅ Order found:', order._id);
    console.log('📊 Order Details:', {
      orderStatus: order.orderStatus,
      deliveryStatus: order.deliveryStatus,
      userId: order.userId,
      subTotal: order.subTotal,
      deliveryCharge: order.deliveryCharge,
      totalPayable: order.totalPayable
    });

    // Ensure the order is in "Picked" status before proceeding to "Delivered"
    if (order.orderStatus !== "Picked" || order.deliveryStatus !== "Picked") {
      console.log('❌ Order status check failed:', {
        orderStatus: order.orderStatus,
        deliveryStatus: order.deliveryStatus,
        required: 'Picked'
      });
      return res.status(400).json({
        success: false,
        message: "Order is not in 'Picked' status.",
      });
    }
    console.log('✅ Order is in "Picked" status');

    // Mark order as delivered and update statuses
    order.orderStatus = "Delivered";
    order.deliveryStatus = "Delivered";
    console.log('📈 Order status updated to "Delivered"');

    // Store the paymentType in the order
    if (paymentType) {
      order.paymentType = paymentType;
      console.log('💰 Payment type added to order:', paymentType);
    }

    // Handle payment for COD orders (without UPI ID)
    if (order.paymentMethod === "COD") {
      order.paymentStatus = "Paid";
      console.log('💵 COD order - Payment status set to "Paid"');
    } else {
      order.paymentStatus = "Completed";
      console.log('💳 Non-COD order - Payment status set to "Completed"');
    }

    // ========== DISTRIBUTE PAYMENT TO ADMIN AND RESTAURANT ==========
    console.log('\n💸 PAYMENT DISTRIBUTION STARTED');
    
    // 1. Find the restaurant
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant) {
      console.log('❌ Restaurant not found for order:', order.restaurantId);
      return res.status(404).json({
        success: false,
        message: "Restaurant not found.",
      });
    }
    console.log('✅ Restaurant found:', restaurant._id, '-', restaurant.restaurantName);

    // 2. **FIXED: Now always use 20% commission from subtotal**
    const commissionPercentage = 20; // FIXED 20% commission
    
    // 3. **CHANGED: Calculate commission from SUBTOTAL, not totalPayable**
    const subtotal = order.subTotal || order.totalAmount || 0;
    
    // Delivery charge alag se rahega
    const deliveryCharge = order.deliveryCharge || 0;
    const totalPayable = order.totalPayable || 0;
    
    // Calculate amounts based on SUBTOTAL
    const adminCommission = (subtotal * commissionPercentage) / 100;
    const restaurantAmount = subtotal - adminCommission;
    
    console.log("📊 Payment Distribution Details:", {
      subtotal: subtotal.toFixed(2),
      deliveryCharge: deliveryCharge.toFixed(2),
      totalPayable: totalPayable.toFixed(2),
      commissionPercentage: `${commissionPercentage}%`,
      adminCommission: adminCommission.toFixed(2),
      restaurantAmount: restaurantAmount.toFixed(2)
    });

    // 4. Update Admin wallet (add commission) - FIXED
    const admin = await adminModel.findOne();
    
    if (admin) {
      console.log('👑 Admin found:', admin._id);
      
      // CRITICAL FIX: Check if walletBalance exists, if not create it
      if (admin.walletBalance === undefined) {
        admin.walletBalance = 0;
        console.log('⚠️ Admin wallet balance was undefined, set to 0');
      }
      
      const adminBalanceBefore = admin.walletBalance;
      
      // Now add commission
      admin.walletBalance = admin.walletBalance + adminCommission;
      
      console.log('💰 Admin wallet updated:', {
        before: adminBalanceBefore.toFixed(2),
        added: adminCommission.toFixed(2),
        after: admin.walletBalance.toFixed(2)
      });
      
      // Create transaction object
      const transactionObj = {
        amount: adminCommission,
        dateAdded: new Date().toISOString(),
        type: "commission",
        orderId: orderId.toString(),
        restaurantId: restaurant._id.toString(),
        restaurantName: restaurant.restaurantName,
        subtotal: subtotal,
        commissionPercentage: commissionPercentage,
        description: `Commission from order #${orderId.toString().substring(0, 8)} (20% of subtotal)`
      };
      
      // Initialize if not exists
      if (!admin.walletTransactions || !Array.isArray(admin.walletTransactions)) {
        admin.walletTransactions = [];
        console.log('📝 Admin wallet transactions array initialized');
      }
      
      // Admin ke liye JSON string push karo
      admin.walletTransactions.push(JSON.stringify(transactionObj));
      console.log('📋 Admin transaction added:', transactionObj.description);
      
      // Mark fields as modified
      admin.markModified('walletBalance');
      admin.markModified('walletTransactions');
      
      await admin.save();
      console.log('💾 Admin saved successfully');
    } else {
      console.log('❌ Admin not found in database');
    }

    // 5. Update Restaurant wallet (add restaurant's share)
    console.log('\n🏪 RESTAURANT PAYMENT PROCESSING');
    
    // Check and initialize restaurant wallet fields
    if (restaurant.walletBalance === undefined) {
      restaurant.walletBalance = 0;
      console.log('⚠️ Restaurant wallet balance was undefined, set to 0');
    }
    if (restaurant.totalEarnings === undefined) {
      restaurant.totalEarnings = 0;
      console.log('⚠️ Restaurant totalEarnings was undefined, set to 0');
    }
    if (restaurant.totalCommissionPaid === undefined) {
      restaurant.totalCommissionPaid = 0;
      console.log('⚠️ Restaurant totalCommissionPaid was undefined, set to 0');
    }
    
    const restaurantBalanceBefore = restaurant.walletBalance;
    const totalEarningsBefore = restaurant.totalEarnings;
    const totalCommissionBefore = restaurant.totalCommissionPaid;
    
    restaurant.walletBalance = restaurant.walletBalance + restaurantAmount;
    restaurant.totalEarnings = restaurant.totalEarnings + restaurantAmount;
    restaurant.totalCommissionPaid = restaurant.totalCommissionPaid + adminCommission;
    
    console.log('🏪 Restaurant wallet updated:', {
      walletBalance: {
        before: restaurantBalanceBefore.toFixed(2),
        added: restaurantAmount.toFixed(2),
        after: restaurant.walletBalance.toFixed(2)
      },
      totalEarnings: {
        before: totalEarningsBefore.toFixed(2),
        added: restaurantAmount.toFixed(2),
        after: restaurant.totalEarnings.toFixed(2)
      },
      totalCommissionPaid: {
        before: totalCommissionBefore.toFixed(2),
        added: adminCommission.toFixed(2),
        after: restaurant.totalCommissionPaid.toFixed(2)
      }
    });
    
    // Initialize if not exists
    if (!restaurant.walletTransactions || !Array.isArray(restaurant.walletTransactions)) {
      restaurant.walletTransactions = [];
      console.log('📝 Restaurant wallet transactions array initialized');
    }
    
    // Restaurant ke liye transaction object
    const restaurantTransaction = {
      amount: restaurantAmount,
      dateAdded: new Date().toISOString(),
      type: "order_payment",
      orderId: orderId.toString(),
      subtotal: subtotal,
      commissionDeducted: adminCommission,
      commissionPercentage: commissionPercentage,
      netAmount: restaurantAmount,
      description: `Payment for order #${orderId.toString().substring(0, 8)} (80% of subtotal)`
    };
    
    // Restaurant ke liye JSON string push karo
    restaurant.walletTransactions.push(JSON.stringify(restaurantTransaction));
    console.log('📋 Restaurant transaction added:', restaurantTransaction.description);
    
    await restaurant.save();
    console.log('💾 Restaurant saved successfully');

    // 6. Update order with commission details
    order.adminCommission = adminCommission;
    order.restaurantPayout = restaurantAmount;
    order.commissionPercentage = commissionPercentage;
    order.commissionAppliedOn = "subtotal"; // Indicate commission was applied on subtotal
    console.log('📋 Order commission details updated');

    // ========== NEW: REFERRAL REWARD LOGIC ==========
    console.log('\n🎁 REFERRAL REWARD PROCESSING STARTED');
    let referralRewardDetails = null;

    // Find the user who placed this order
    const user = await User.findById(order.userId);
    
    if (user) {
      console.log('👤 Order user found:', user._id, '-', user.name || user.email);
      console.log('🔍 Checking user.referredBy field:', user.referredBy);
      
      if (user.referredBy) {
        console.log('🎯 User has a referrer! Referrer CODE:', user.referredBy);
        console.log('📧 User email:', user.email);
        console.log('📞 User phone:', user.phone);
        
        // Check if this is user's first order
        const userOrderCount = await Order.countDocuments({ userId: user._id });
        const isFirstOrder = userOrderCount === 1; // Yeh order hi pehla order hai
        
        console.log('📊 User order count:', userOrderCount);
        console.log('🌟 Is this first order?', isFirstOrder);
        
        if (isFirstOrder) {
          console.log('🎉 FIRST ORDER DETECTED - Applying referral rewards');
          
          // Get referral reward settings from referralRewardSchema
          const referralRewardSetting = await ReferralReward.findOne({ 
            userType: "user" 
          });
          
          let userRewardValue = 20; // Default fallback value
          
          if (referralRewardSetting) {
            console.log('🎯 Referral reward setting found:', {
              userType: referralRewardSetting.userType,
              rewardType: referralRewardSetting.rewardType,
              rewardValue: referralRewardSetting.rewardValue
            });
            
            // Set reward value based on schema
            userRewardValue = referralRewardSetting.rewardValue || 20;
            console.log('💰 Using reward value from schema:', userRewardValue);
          } else {
            console.log('⚠️ No referral reward setting found, using default:', userRewardValue);
          }
          
          const referralCommissionPercentage = 6; // 6% of admin commission
          
          // Calculate reward amounts
          const referralRewardFromCommission = (adminCommission * referralCommissionPercentage) / 100;
          
          console.log('📐 Referral calculations:', {
            adminCommission: adminCommission.toFixed(2),
            referralPercentage: `${referralCommissionPercentage}%`,
            referralRewardFromCommission: referralRewardFromCommission.toFixed(2),
            userFixedReward: userRewardValue.toFixed(2)
          });
          
          // Get the referral code from user
          const referralCode = user.referredBy;
          
          console.log('🔎 Looking for referrer with CODE:', referralCode);
          
          // Try to find as Ambassador first (searching by referralCode field)
          let referrer = await Ambassador.findOne({ referralCode: referralCode });
          let referrerType = "ambassador";
          
          if (referrer) {
            console.log('🎖️ Referrer found as AMBASSADOR:', referrer._id);
            console.log('📛 Ambassador name:', referrer.name);
            console.log('📞 Ambassador phone:', referrer.phone);
            console.log('🔑 Ambassador referral code:', referrer.referralCode);
          } else {
            console.log('❌ Not found as Ambassador, trying Restaurant...');
            
            // If not found as Ambassador, try as Restaurant (searching by referralCode field)
            referrer = await Restaurant.findOne({ referralCode: referralCode });
            referrerType = "restaurant";
            
            if (referrer) {
              console.log('🏪 Referrer found as RESTAURANT:', referrer._id);
              console.log('🏬 Restaurant name:', referrer.restaurantName);
              console.log('🔑 Restaurant referral code:', referrer.referralCode);
            } else {
              console.log('❌ Not found as Restaurant, trying User...');
              
              // If still not found, try as User (searching by referralCode field)
              referrer = await User.findOne({ referralCode: referralCode });
              referrerType = "user";
              
              if (referrer) {
                console.log('👤 Referrer found as USER:', referrer._id);
                console.log('📛 User name:', referrer.name);
                console.log('📞 User phone:', referrer.phone);
                console.log('🔑 User referral code:', referrer.referralCode);
              } else {
                console.log('❌ Referrer not found in any collection with referralCode:', referralCode);
                console.log('ℹ️ Searching in: Ambassador.referralCode, Restaurant.referralCode, User.referralCode');
              }
            }
          }
          
          if (referrer) {
            console.log(`✅ Referrer confirmed as ${referrerType.toUpperCase()}:`, referrer._id);
            console.log(`🔑 Referrer code: ${referrer.referralCode}`);
            
            let rewardAmount = 0;
            let rewardDescription = "";
            
            // Determine reward based on referrer type
            if (referrerType === "ambassador" || referrerType === "restaurant") {
              // Ambassador or Restaurant gets 6% of admin commission
              rewardAmount = referralRewardFromCommission;
              rewardDescription = `6% of admin commission for referring user ${user._id} (${user.name || user.email})`;
              console.log(`💰 ${referrerType.toUpperCase()} reward: ${rewardAmount.toFixed(2)} (6% of admin commission)`);
            } else if (referrerType === "user") {
              // User gets value from referralRewardSchema (₹50 or whatever is set)
              rewardAmount = userRewardValue;
              rewardDescription = `₹${userRewardValue} reward from referral system for referring user ${user._id} (${user.name || user.email})`;
              console.log(`💰 USER reward: ${rewardAmount.toFixed(2)} (From referralRewardSchema)`);
            }
            
            // Update referrer's wallet
            const referrerWalletBefore = referrer.walletBalance || 0;
            
            if (referrer.walletBalance === undefined) {
              referrer.walletBalance = 0;
              console.log('⚠️ Referrer wallet balance was undefined, set to 0');
            }
            
            referrer.walletBalance = referrer.walletBalance + rewardAmount;
            
            console.log(`💰 Referrer wallet updated (${referrerType}):`, {
              before: referrerWalletBefore.toFixed(2),
              added: rewardAmount.toFixed(2),
              after: referrer.walletBalance.toFixed(2)
            });
            
            // Initialize wallet transactions if not exists
            if (!referrer.walletTransactions || !Array.isArray(referrer.walletTransactions)) {
              referrer.walletTransactions = [];
              console.log('📝 Referrer wallet transactions array initialized');
            }
            
            // Add transaction record
            const referralTransaction = {
              amount: rewardAmount,
              dateAdded: new Date(),
              type: "referral_reward",
              orderId: orderId,
              referredUserId: user._id,
              referredUserName: user.name || user.email,
              referredUserCode: user.referralCode || 'No code',
              orderAmount: subtotal,
              referralCodeUsed: referralCode,
              description: rewardDescription,
              isFirstOrder: true,
              rewardSource: referrerType === "user" ? "referralRewardSchema" : "6% commission"
            };
            
            // Check the model type to determine how to store the transaction
            if (referrerType === "user") {
              // For User model, store as proper object
              referrer.walletTransactions.push(referralTransaction);
              console.log('📋 User referral transaction added as object');
            } else {
              // For Ambassador/Restaurant, store as JSON string
              referrer.walletTransactions.push(JSON.stringify(referralTransaction));
              console.log('📋 Ambassador/Restaurant referral transaction added as JSON string');
            }
            
            // Save the referrer
            await referrer.save();
            console.log(`💾 Referrer (${referrerType}) saved successfully`);
            
            // **IMPORTANT: GIVE REWARD TO THE NEW USER WHO PLACED THE ORDER**
            console.log('\n🎁 REWARDING THE NEW USER WHO PLACED THE ORDER');
            const newUserReward = userRewardValue; // Same amount from referralRewardSchema
            
            if (user.walletBalance === undefined) {
              user.walletBalance = 0;
              console.log('⚠️ User wallet balance was undefined, set to 0');
            }
            
            const userWalletBefore = user.walletBalance;
            user.walletBalance = user.walletBalance + newUserReward;
            
            console.log('👤 New user wallet updated:', {
              before: userWalletBefore.toFixed(2),
              added: newUserReward.toFixed(2),
              after: user.walletBalance.toFixed(2),
              userName: user.name || user.email
            });
            
            // Initialize user wallet transactions if not exists
            if (!user.walletTransactions || !Array.isArray(user.walletTransactions)) {
              user.walletTransactions = [];
              console.log('📝 User wallet transactions array initialized');
            }
            
            // Add transaction record for new user
            const newUserTransaction = {
              amount: newUserReward,
              dateAdded: new Date(),
              type: "referral_signup_bonus",
              orderId: orderId,
              description: `Welcome bonus of ₹${newUserReward} for completing first order with referral code ${referralCode}`,
              isFirstOrder: true,
              referrerCode: referralCode,
              referrerType: referrerType
            };
            
            // User ke liye proper object push karo
            user.walletTransactions.push(newUserTransaction);
            console.log('📋 New user bonus transaction added');
            
            // Save the user
            await user.save();
            console.log('💾 New user saved with bonus');
            
            // Deduct the reward from admin's wallet
            if (admin) {
              // **Deduct BOTH: referrer reward + new user reward**
              const totalDeduction = rewardAmount + newUserReward;
              const adminBalanceBeforeDeduction = admin.walletBalance;
              admin.walletBalance = admin.walletBalance - totalDeduction;
              
              console.log('👑 Admin wallet deduction for referrals:', {
                before: adminBalanceBeforeDeduction.toFixed(2),
                referrerDeduction: rewardAmount.toFixed(2),
                newUserDeduction: newUserReward.toFixed(2),
                totalDeduction: totalDeduction.toFixed(2),
                after: admin.walletBalance.toFixed(2),
                referrerType: referrerType,
                referrerId: referrer._id,
                referrerCode: referrer.referralCode
              });
              
              // Add a transaction record for the deduction
              const adminDeductionTransaction = {
                amount: -totalDeduction,
                dateAdded: new Date().toISOString(),
                type: "referral_payout",
                orderId: orderId.toString(),
                referrerId: referrer._id.toString(),
                referrerType: referrerType,
                referrerName: referrer.name || referrer.restaurantName || referrer._id,
                referrerCode: referrer.referralCode,
                referredUserId: user._id.toString(),
                referredUserName: user.name || user.email,
                referralCodeUsed: referralCode,
                referrerReward: rewardAmount,
                newUserReward: newUserReward,
                description: `Referral rewards paid: ₹${rewardAmount.toFixed(2)} to ${referrerType} "${referrer.name || referrer.restaurantName || referrer._id}" + ₹${newUserReward.toFixed(2)} to new user "${user.name || user.email}" for first order #${orderId.toString().substring(0, 8)}`
              };
              
              admin.walletTransactions.push(JSON.stringify(adminDeductionTransaction));
              console.log('📋 Admin deduction transaction added');
              
              admin.markModified('walletBalance');
              admin.markModified('walletTransactions');
              await admin.save();
              console.log('💾 Admin saved after referral deduction');
            }
            
            // Update order with referral info
            order.referredBy = referralCode; // Store the referral code
            order.referredById = referrer._id; // Store the actual referrer ID
            order.referrerType = referrerType;
            order.referralRewardPaid = rewardAmount;
            order.newUserRewardPaid = newUserReward;
            order.referredUserName = user.name || user.email;
            order.referrerName = referrer.name || referrer.restaurantName || referrer._id;
            order.referrerCode = referrer.referralCode; // Store the referrer's code
            order.isFirstOrder = true; // Mark as first order
            
            console.log('📋 Order updated with referral info:', {
              referredByCode: referralCode,
              referredById: referrer._id,
              referrerType: referrerType,
              referrerRewardPaid: rewardAmount.toFixed(2),
              newUserRewardPaid: newUserReward.toFixed(2),
              referredUserName: user.name || user.email,
              referrerName: referrer.name || referrer.restaurantName || referrer._id,
              referrerCode: referrer.referralCode,
              isFirstOrder: true
            });
            
            // Prepare response details
            referralRewardDetails = {
              referrerType: referrerType,
              referrerId: referrer._id,
              referrerCode: referrer.referralCode,
              referrerName: referrer.name || referrer.restaurantName || referrer._id,
              rewardAmount: rewardAmount,
              newUserReward: newUserReward,
              rewardSource: referrerType === "user" ? "referralRewardSchema" : "6% of admin commission",
              deductedFromAdmin: true,
              adminWalletAfterDeduction: admin ? admin.walletBalance : null,
              referredUserId: user._id,
              referredUserName: user.name || user.email,
              referralCodeUsed: referralCode,
              isFirstOrder: true,
              userOrderCount: userOrderCount
            };
            
            console.log(`🎁 FIRST ORDER referral rewards PROCESSED:`);
            console.log(`   ₹${rewardAmount.toFixed(2)} to ${referrerType} "${referrer.name || referrer.restaurantName || referrer._id}" (code: ${referrer.referralCode})`);
            console.log(`   ₹${newUserReward.toFixed(2)} to new user "${user.name || user.email}"`);
          } else {
            console.log('⚠️ Referrer code found in user.referredBy but no matching referrer found in database');
            console.log('📝 Store this info in order for manual investigation');
            
            // Even if referrer not found, store the code in order for investigation
            order.referredBy = referralCode;
            order.referrerType = "unknown";
            order.referralRewardPaid = 0;
            order.referredUserName = user.name || user.email;
            order.referralError = "Referrer code found but referrer not in database";
            order.isFirstOrder = true;
            
            console.log('📋 Order updated with referral error info');
          }
        } else {
          console.log('ℹ️ Not user\'s first order. Skipping referral rewards.');
          console.log('ℹ️ Only first orders qualify for referral rewards.');
        }
      } else {
        console.log('ℹ️ No referrer found for this user (user.referredBy is null/undefined)');
      }
    } else {
      console.log('❌ User not found for order.userId:', order.userId);
    }

    // ========== UPDATE DELIVERY BOY WALLET ==========
    console.log('\n🚴 DELIVERY BOY PAYMENT PROCESSING');
    
    const deliveryBoyBalanceBefore = deliveryBoy.walletBalance || 0;
    
    // Update the delivery boy's wallet
    deliveryBoy.walletBalance = (deliveryBoy.walletBalance || 0) + deliveryCharge;
    
    console.log('💰 Delivery boy wallet updated:', {
      before: deliveryBoyBalanceBefore.toFixed(2),
      added: deliveryCharge.toFixed(2),
      after: deliveryBoy.walletBalance.toFixed(2),
      deliveryBoyName: deliveryBoy.name
    });

    // Initialize if not exists
    if (!deliveryBoy.walletTransactions || !Array.isArray(deliveryBoy.walletTransactions)) {
      deliveryBoy.walletTransactions = [];
      console.log('📝 Delivery boy wallet transactions array initialized');
    }
    
    // DeliveryBoy ke liye PROPER OBJECT push karo (JSON string nahi)
    const deliveryTransaction = {
      amount: deliveryCharge,
      dateAdded: new Date(),
      type: "delivery",
      orderId: orderId,
      description: `Delivery charge for order #${orderId.toString().substring(0, 8)}`
    };
    
    // Push as proper object
    deliveryBoy.walletTransactions.push(deliveryTransaction);
    console.log('📋 Delivery boy transaction added:', deliveryTransaction.description);

    // **Update the delivery boy's currentOrderStatus to 'Delivered'**
    deliveryBoy.currentOrderStatus = "Delivered";

    // Set the delivery boy's currentOrder to false (mark as available again)
    deliveryBoy.currentOrder = false;
    
    console.log('🚴 Delivery boy status updated:', {
      currentOrderStatus: "Delivered",
      currentOrder: false,
      available: true
    });

    // Save the updated order and delivery boy
    await order.save();
    console.log('💾 Order saved with all updates');
    
    await deliveryBoy.save();
    console.log('💾 Delivery boy saved with all updates');

    console.log('\n✅ ALL PROCESSES COMPLETED SUCCESSFULLY');
    console.log('📊 FINAL SUMMARY:');
    console.log('- Order marked as Delivered');
    console.log('- Payment distributed: Admin, Restaurant, Delivery Boy');
    if (referralRewardDetails) {
      console.log('- FIRST ORDER referral rewards processed:', {
        referrerType: referralRewardDetails.referrerType,
        referrerName: referralRewardDetails.referrerName,
        referrerCode: referralRewardDetails.referrerCode,
        referrerReward: referralRewardDetails.rewardAmount.toFixed(2),
        newUserReward: referralRewardDetails.newUserReward.toFixed(2),
        totalPaid: (referralRewardDetails.rewardAmount + referralRewardDetails.newUserReward).toFixed(2)
      });
    } else {
      console.log('- No referral reward processed (not first order or no referrer)');
    }

    return res.status(200).json({
      success: true,
      message: "Order marked as 'Delivered', payment status updated, and funds distributed.",
      data: {
        order,
        paymentDistribution: {
          subtotal: subtotal,
          deliveryCharge: deliveryCharge,
          totalPayable: totalPayable,
          commissionPercentage: `${commissionPercentage}%`,
          commissionAppliedOn: "subtotal",
          adminCommission: adminCommission,
          restaurantAmount: restaurantAmount,
          deliveryCharge: deliveryCharge,
          distribution: {
            admin: `${commissionPercentage}% of subtotal`,
            restaurant: `${100 - commissionPercentage}% of subtotal`,
            deliveryBoy: "100% of delivery charge"
          }
        },
        referralReward: referralRewardDetails,
        adminUpdated: admin ? {
          walletBalance: admin.walletBalance,
          hasWalletBalanceField: admin.walletBalance !== undefined
        } : null,
        logs: {
          userFound: !!user,
          hadReferrer: !!(user && user.referredBy),
          userOrderCount: userOrderCount || 0,
          isFirstOrder: !!(referralRewardDetails && referralRewardDetails.isFirstOrder),
          referrerType: referralRewardDetails?.referrerType || 'none',
          referrerCode: referralRewardDetails?.referrerCode || 'none',
          referrerReward: referralRewardDetails?.rewardAmount || 0,
          newUserReward: referralRewardDetails?.newUserReward || 0
        }
      },
    });
  } catch (error) {
    console.error("❌❌❌ ERROR marking order as delivered:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};
// Controller to generate UPI QR code
exports.generateUPIQRCode = async (req, res) => {
   try {
    const upiId = "juleeperween@ybl"; // Hardcoded UPI ID

    // Generate UPI URL for QR code
    const upiUrl = `upi://pay?pa=${upiId}&pn=Receiver&tn=Payment&cu=INR`;

    // Generate QR code as a Data URL (base64-encoded image)
    const qrCodeDataUrl = await QRCode.toDataURL(upiUrl);

    // Send the link with the data URL of the QR code image
    res.status(200).json({
      success: true,
      message: "QR code generated successfully!",
      qrCodeLink: qrCodeDataUrl,  // Return the base64 QR code data URL
    });
  } catch (error) {
    console.error("Error generating UPI QR code:", error);
    res.status(500).send("Failed to generate QR code");
  }
};


exports.getWalletBalanceForDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    // Validate if the delivery boy exists
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Ensure walletTransactions exists
    const walletTransactions = deliveryBoy.walletTransactions || [];

    const today = new Date();

    // Helper function to filter transactions based on date range
    const filterTransactionsByDate = (startDate, endDate) => {
      return walletTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.dateAdded);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    };

    // Get today's date (start of the day)
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // Get this week's start and end dates (assuming Monday as start of the week)
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1));  // Monday
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 7));    // Sunday

    // Get this month's start and end dates
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); // First day of the current month
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);  // Last day of the current month

    // Calculate today's earnings
    const todayEarnings = filterTransactionsByDate(startOfToday, endOfToday)
      .reduce((total, transaction) => total + transaction.amount, 0);

    // Calculate this week's earnings
    const weekEarnings = filterTransactionsByDate(startOfWeek, endOfWeek)
      .reduce((total, transaction) => total + transaction.amount, 0);

    // Calculate this month's earnings
    const monthEarnings = filterTransactionsByDate(startOfMonth, endOfMonth)
      .reduce((total, transaction) => total + transaction.amount, 0);

    // Helper function to get day of the week
    const getDayOfWeek = (date) => {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return daysOfWeek[date.getDay()];
    };

    // Calculate daily earnings for the last 7 days
    const dailyEarnings = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date();
      day.setDate(today.getDate() - i);

      const startOfDay = new Date(day.setHours(0, 0, 0, 0));
      const endOfDay = new Date(day.setHours(23, 59, 59, 999));

      const earningsForDay = filterTransactionsByDate(startOfDay, endOfDay)
        .reduce((total, transaction) => total + transaction.amount, 0);

      dailyEarnings.push({
        date: startOfDay.toISOString().split('T')[0],  // Format date as YYYY-MM-DD
        day: getDayOfWeek(startOfDay),  // Get the day of the week (e.g., Monday, Tuesday)
        earnings: earningsForDay,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet balance and filtered earnings fetched successfully.",
      data: {
        walletBalance: deliveryBoy.walletBalance || 0,
        todayEarnings: todayEarnings,
        weekEarnings: weekEarnings,
        monthEarnings: monthEarnings,
        dailyEarnings: dailyEarnings.reverse(),  // Reverse to show from day 1 to day 7
      },
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



exports.getAllDeliveredOrders = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;  // Extract deliveryBoyId from request parameters

    // Fetch orders where both the orderStatus and deliveryStatus are "Delivered" and deliveryBoyId is assigned
    const deliveredOrders = await Order.find({
      orderStatus: "Delivered",  // Order status is "Delivered"
      deliveryStatus: "Delivered",  // Delivery status is "Delivered"
      deliveryBoyId: deliveryBoyId  // Assigned to the specific delivery boy
    }).populate("restaurantId", "restaurantName locationName")
      .populate("userId", "name email")
      .populate("deliveryBoyId", "fullName mobileNumber");

    // If no orders found
    if (!deliveredOrders || deliveredOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No delivered orders found for this delivery boy."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivered orders fetched successfully.",
      data: deliveredOrders,
    });
  } catch (error) {
    console.error("Error fetching delivered orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



// Search Controller
exports.searchRestaurantsAndProducts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, message: "Query is required." });
    }

    const searchRegex = new RegExp(query, "i"); // Case-insensitive search

    // 1️⃣ Search Products
    const productResults = await RestaurantProduct.find({
      "recommended.name": searchRegex,
      status: "active"
    })
      .populate("restaurantId", "restaurantName locationName image")
      .lean();

    const formattedProductResults = productResults.map(prod => ({
      productId: prod._id,
      productName: prod.recommended.find(r => searchRegex.test(r.name))?.name,
      price: prod.recommended.find(r => searchRegex.test(r.name))?.price,
      restaurantId: prod.restaurantId?._id,
      restaurantName: prod.restaurantId?.restaurantName,
      restaurantLocation: prod.restaurantId?.locationName,
      restaurantImage: prod.restaurantId?.image?.url || null
    }));

    // 2️⃣ Search Restaurants
    const restaurantResults = await Restaurant.find({
      restaurantName: searchRegex,
      status: "active"
    })
      .lean();

    const formattedRestaurantResults = restaurantResults.map(rest => ({
      restaurantId: rest._id,
      restaurantName: rest.restaurantName,
      description: rest.description,
      rating: rest.rating,
      startingPrice: rest.startingPrice,
      locationName: rest.locationName,
      image: rest.image?.url || null
    }));

    // Return combined results
    return res.status(200).json({
      success: true,
      data: {
        products: formattedProductResults,
        restaurants: formattedRestaurantResults
      }
    });

  } catch (error) {
    console.error("searchRestaurantsAndProducts error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


exports.addReview = async (req, res) => {
  try {
    const { productId, stars, comment, userId } = req.body;

    // Validate inputs
    if (!productId || !mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ success: false, message: "Valid productId is required." });

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ success: false, message: "Stars must be between 1 and 5." });

    // Find the product containing the recommended item
    const product = await RestaurantProduct.findOne({ "recommended._id": productId });

    if (!product)
      return res.status(404).json({ success: false, message: "Recommended product not found." });

    // Find the index of the recommended item
    const recommendedIndex = product.recommended.findIndex(r => r._id.toString() === productId);

    if (recommendedIndex === -1)
      return res.status(404).json({ success: false, message: "Recommended product not found." });

    // Push the review
    product.recommended[recommendedIndex].reviews.push({
      userId,
      stars,
      comment
    });

    // Recalculate average rating
    const reviews = product.recommended[recommendedIndex].reviews;
    const totalStars = reviews.reduce((acc, r) => acc + r.stars, 0);
    const avgRating = totalStars / reviews.length;

    product.recommended[recommendedIndex].rating = parseFloat(avgRating.toFixed(2));

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Review added successfully",
      recommended: product.recommended[recommendedIndex]
    });

  } catch (err) {
    console.error("Add Review Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



// Edit a review inside recommended product
exports.editProductReview = async (req, res) => {
  try {
    const { productId, reviewId, stars, comment, userId } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ success: false, message: "Valid productId is required." });

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId))
      return res.status(400).json({ success: false, message: "Valid reviewId is required." });

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    // Find main product that contains recommended item
    const product = await RestaurantProduct.findOne({ "recommended._id": productId });
    if (!product)
      return res.status(404).json({ success: false, message: "Recommended product not found." });

    // recommended item index
    const recommendedIndex = product.recommended.findIndex(r => r._id.toString() === productId);
    if (recommendedIndex === -1)
      return res.status(404).json({ success: false, message: "Recommended product not found." });

    // find review
    const review = product.recommended[recommendedIndex].reviews.id(reviewId);
    if (!review)
      return res.status(404).json({ success: false, message: "Review not found." });

    // check review belongs to user
    if (review.userId.toString() !== userId)
      return res.status(403).json({ success: false, message: "You can only edit your own review." });

    // update fields
    if (stars) review.stars = stars;
    if (comment) review.comment = comment;

    // recalc rating
    const reviews = product.recommended[recommendedIndex].reviews;
    const avgRating = reviews.reduce((acc, r) => acc + r.stars, 0) / reviews.length;

    product.recommended[recommendedIndex].rating = parseFloat(avgRating.toFixed(2));

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      recommended: product.recommended[recommendedIndex]
    });

  } catch (err) {
    console.error("Edit Review Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



// Delete a review inside recommended product
exports.deleteProductReview = async (req, res) => {
  try {
    const { productId, reviewId, userId } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ success: false, message: "Valid productId is required." });

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId))
      return res.status(400).json({ success: false, message: "Valid reviewId is required." });

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    // Find the recommended item
    const product = await RestaurantProduct.findOne({ "recommended._id": productId });
    if (!product)
      return res.status(404).json({ success: false, message: "Recommended product not found." });

    const recommendedItem = product.recommended.find(r => r._id.toString() === productId);
    if (!recommendedItem)
      return res.status(404).json({ success: false, message: "Recommended product not found." });

    // Check if review belongs to the user
    const review = recommendedItem.reviews.find(r => r._id.toString() === reviewId);
    if (!review)
      return res.status(404).json({ success: false, message: "Review not found." });

    if (review.userId.toString() !== userId)
      return res.status(403).json({ success: false, message: "You can only delete your own review." });

    // Delete using $pull
    await RestaurantProduct.updateOne(
      { "recommended._id": productId },
      { $pull: { "recommended.$.reviews": { _id: reviewId } } }
    );

    // Recalculate updated rating
    const updatedProduct = await RestaurantProduct.findOne({ "recommended._id": productId });
    const updatedItem = updatedProduct.recommended.find(r => r._id.toString() === productId);

    const reviews = updatedItem.reviews;

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((acc, r) => acc + r.stars, 0) / reviews.length
        : 0;

    updatedItem.rating = parseFloat(avgRating.toFixed(2));

    await updatedProduct.save();

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      recommended: updatedItem
    });

  } catch (err) {
    console.error("Delete Review Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



exports.getSingleProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId is required." });
    }

    // Find the product containing the recommended item
    const product = await RestaurantProduct.findOne({ "recommended._id": productId })
      .populate({
        path: "restaurantId",
        select: "restaurantName locationName location image"
      })
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Recommended product not found." });
    }

    // Get the recommended item
    const recommendedItem = product.recommended.find(r => r._id.toString() === productId);

    if (!recommendedItem || recommendedItem.status !== "active") {
      return res.status(404).json({ success: false, message: "Recommended product not available." });
    }

    let userRating = 0;

    // Populate reviews' user info
    if (recommendedItem.reviews && recommendedItem.reviews.length > 0) {
      const userIds = recommendedItem.reviews.map(r => r.userId);
      const users = await User.find({ _id: { $in: userIds } })
        .select("firstName lastName profileImg")
        .lean();

      recommendedItem.reviews = recommendedItem.reviews.map(r => {
        const user = users.find(u => u._id.toString() === r.userId.toString());
        return {
          ...r,
          user: user
            ? {
                firstName: user.firstName,
                lastName: user.lastName,
                profileImg: user.profileImg
              }
            : null
        };
      });

      const totalStars = recommendedItem.reviews.reduce((sum, r) => sum + (r.stars || 0), 0);
      userRating = totalStars / recommendedItem.reviews.length;
    }

    return res.status(200).json({
      success: true,
      recommended: {
        ...recommendedItem,
      },
      restaurantProductId: product._id, // ✅ include parent RestaurantProduct ID
      restaurant: product.restaurantId, // ✅ include restaurant info
      userRating: parseFloat(userRating.toFixed(2)) // rounded to 2 decimals
    });

  } catch (err) {
    console.error("Get Single Product Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



// Add a review
exports.addRestaurantReview = async (req, res) => {
  try {
    const { restaurantId, stars, comment, userId } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId))
      return res.status(400).json({ success: false, message: "Valid restaurantId is required." });

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ success: false, message: "Stars must be between 1 and 5." });

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found." });

    restaurant.reviews.push({ userId, stars, comment });

    // Recalculate average rating
    const reviews = restaurant.reviews;
    restaurant.rating = parseFloat((reviews.reduce((acc, r) => acc + r.stars, 0) / reviews.length).toFixed(2));

    await restaurant.save();

    return res.status(200).json({ success: true, message: "Review added successfully", restaurant });

  } catch (err) {
    console.error("Add Review Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Edit a review
exports.editRestaurantReview = async (req, res) => {
  try {
    const { restaurantId, reviewId, stars, comment, userId } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId))
      return res.status(400).json({ success: false, message: "Valid restaurantId is required." });

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId))
      return res.status(400).json({ success: false, message: "Valid reviewId is required." });

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found." });

    const review = restaurant.reviews.id(reviewId);

    if (!review)
      return res.status(404).json({ success: false, message: "Review not found." });

    if (review.userId.toString() !== userId)
      return res.status(403).json({ success: false, message: "You can only edit your own review." });

    if (stars) review.stars = stars;
    if (comment) review.comment = comment;

    // Recalculate average rating
    const reviews = restaurant.reviews;
    restaurant.rating = parseFloat((reviews.reduce((acc, r) => acc + r.stars, 0) / reviews.length).toFixed(2));

    await restaurant.save();

    return res.status(200).json({ success: true, message: "Review updated successfully", restaurant });

  } catch (err) {
    console.error("Edit Review Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Delete a review using findByIdAndUpdate
exports.deleteRestaurantReview = async (req, res) => {
  try {
    const { restaurantId, reviewId, userId } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId))
      return res.status(400).json({ success: false, message: "Valid restaurantId is required." });

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId))
      return res.status(400).json({ success: false, message: "Valid reviewId is required." });

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });

    // Remove the review
    const restaurant = await Restaurant.findOneAndUpdate(
      { _id: restaurantId, "reviews._id": reviewId, "reviews.userId": userId },
      { $pull: { reviews: { _id: reviewId } } },
      { new: true } // return the updated document
    );

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Review or Restaurant not found, or user unauthorized." });
    }

    // Recalculate average rating
    const reviews = restaurant.reviews;
    restaurant.rating = reviews.length > 0
      ? parseFloat((reviews.reduce((acc, r) => acc + r.stars, 0) / reviews.length).toFixed(2))
      : 0;

    await restaurant.save();

    return res.status(200).json({ success: true, message: "Review deleted successfully", restaurant });

  } catch (err) {
    console.error("Delete Review Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



// Cancel Order
exports.cancelOrder = async (req, res) => {
  const { userId, orderId } = req.params;

  try {
    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid userId or orderId" });
    }

    // Fetch order
    const order = await Order.findOne({ _id: orderId, userId }).populate('userId', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check if order is already cancelled
    if (order.orderStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Order is already cancelled", data: order });
    }

    // Check cancellation time (1.5 minutes = 90,000ms)
    const now = new Date();
    const orderTime = new Date(order.createdAt);
    const diffMs = now - orderTime;

    if (diffMs > 90 * 1000) {
      return res.status(400).json({ success: false, message: "Cancellation time exceeded (1.5 minutes)", data: order });
    }

    let refundDetails = null;

    // Process refund if payment method is online and paymentStatus is Paid
    if (order.paymentMethod === "Online" && order.paymentStatus === "Paid") {
      if (!order.transactionId) {
        return res.status(500).json({ success: false, message: "Transaction ID missing. Cannot process refund.", data: order });
      }

      try {
        const refund = await razorpay.payments.refund(order.transactionId, {
          amount: Math.round(order.totalPayable * 100), // amount in paise
        });
        refundDetails = {
          refundId: refund.id,
          status: refund.status,
          amount: refund.amount / 100, // convert back to rupees
          currency: refund.currency,
        };
        console.log("Refund processed:", refundDetails);
      } catch (err) {
        console.error("Refund failed:", err);
        return res.status(500).json({ success: false, message: "Refund failed", error: err.message, data: order });
      }
    }

    // Update order status
    order.orderStatus = "Cancelled";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        totalPayable: order.totalPayable,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        refunded: refundDetails ? true : false,
        refundDetails: refundDetails,
        user: order.userId,
        products: order.products,
        cancelledAt: new Date(),
      },
    });

  } catch (error) {
    console.error("cancelOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};




exports.getOrdersByRestaurant = async (req, res) => {
  try {
    const ordersByRestaurant = await Order.aggregate([
      {
        // Join restaurant details
        $lookup: {
          from: "restaurants", // collection name in MongoDB
          localField: "restaurantId",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      {
        $unwind: "$restaurant",
      },
      {
        // Optionally join user info
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        // Join cart details
        $lookup: {
          from: "carts",
          localField: "cartId",
          foreignField: "_id",
          as: "cart",
        },
      },
      { $unwind: "$cart" },
      {
        // Populate products inside cart
        $lookup: {
          from: "restaurantproducts",
          localField: "cart.products.restaurantProductId",
          foreignField: "_id",
          as: "productsDetails",
        },
      },
      {
        // Group by restaurant
        $group: {
          _id: "$restaurant._id",
          restaurantName: { $first: "$restaurant.restaurantName" },
          locationName: { $first: "$restaurant.locationName" },
          orders: { $push: "$$ROOT" }, // all orders for this restaurant
          totalOrders: { $sum: 1 },
        },
      },
      {
        $sort: { restaurantName: 1 }, // optional: sort by name
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders grouped by restaurant fetched successfully.",
      data: ordersByRestaurant,
    });
  } catch (error) {
    console.error("getOrdersByRestaurant error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.getOrdersByPaymentStatus = async (req, res) => {
  try {
    // Hardcoded payment status (e.g., "Paid")
    const paymentStatus = "Paid"; // You can change this to any status you want

    // Fetch orders with hardcoded payment status
    const ordersByPayment = await Order.find({ paymentStatus: paymentStatus })
      .populate("restaurantId", "restaurantName locationName description") // Populate restaurant fields
      .populate("userId", "name email mobile") // Populate user fields
      .populate("cartId", "products") // Optionally populate cart (or remove this if not needed)
      .populate({
        path: "cartId",
        populate: {
          path: "products.restaurantProductId",
          select: "name price image", // Specify fields to populate for products
        },
      })
      .sort({ createdAt: -1 }); // Sort by creation date (latest first)

    if (ordersByPayment.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No orders found with ${paymentStatus} status.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Orders with ${paymentStatus} status fetched successfully.`,
      data: ordersByPayment,
    });
  } catch (error) {
    console.error("getOrdersByPaymentStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};