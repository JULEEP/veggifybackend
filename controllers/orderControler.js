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
    // 1. Get the user's wishlist (array of recommended._id)
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myWishlist = user.myWishlist; // array of recommended._id
    if (!myWishlist || myWishlist.length === 0) {
      return res.status(404).json({ message: "Wishlist is empty" });
    }

    // 2. Find only the recommended items
    const wishlistItems = await Promise.all(
      myWishlist.map(async (recId) => {
        const product = await RestaurantProduct.findOne(
          { "recommended._id": recId },
          { recommended: { $elemMatch: { _id: recId } } } // only the matched recommended
        ).populate("recommended.category"); // populate category if needed

        // Return only the recommended object
        return product?.recommended[0] || null;
      })
    );

    // Filter out nulls if any recommended._id was not found
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




exports.createOrder = async (req, res) => {
  try {
    const { userId, paymentMethod, addressId } = req.body;

    // Basic validations
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Valid userId is required." });
    if (!mongoose.Types.ObjectId.isValid(addressId))
      return res.status(400).json({ success: false, message: "Valid addressId is required." });
    if (!["COD", "Online"].includes(paymentMethod))
      return res.status(400).json({ success: false, message: "Invalid payment method." });

    // Get cart by userId
    const cart = await Cart.findOne({ userId }).populate('products.restaurantProductId');
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found for this user."
      });
    }

    // Check if cart has products
    if (!cart.products || cart.products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Add products to create order."
      });
    }

    // Get user with specific address
    const user = await User.findOne(
      { _id: userId, "addresses._id": addressId },
      {
        name: 1,
        email: 1,
        location: 1,
        referredBy: 1, // Get the referral code if available
        addresses: { $elemMatch: { _id: addressId } }
      }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User or address not found."
      });
    }

    const selectedAddress = user.addresses[0];
    if (!selectedAddress || !user.location || !user.location.coordinates) {
      return res.status(400).json({
        success: false,
        message: "User location or selected address not found."
      });
    }

    // Get restaurant details from cart
    const restaurantId = cart.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: "Restaurant not found in cart."
      });
    }

    const restaurant = await Restaurant.findById(restaurantId, "restaurantName location");
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found."
      });
    }

    // Process products from cart
    const cleanProducts = [];
    let subTotal = 0;
    let totalItems = 0;

    for (const prod of cart.products) {
      const restaurantProduct = prod.restaurantProductId;
      const recommendedItem = restaurantProduct?.recommended?.id(prod.recommendedId);

      if (!recommendedItem) continue;

      let unitPrice = recommendedItem.price || 0;
      const addOnClean = {};

      // Handle addons and variations
      if (recommendedItem.addons && prod.addOn) {
        if (recommendedItem.addons.variation?.type.includes("Half") && prod.addOn.variation === "Half") {
          addOnClean.variation = "Half";
          unitPrice = recommendedItem.calculatedPrice?.half ||
            Math.round(unitPrice * (recommendedItem.vendorHalfPercentage / 100));
        }

        if (recommendedItem.addons.plates && prod.addOn.plateitems > 0) {
          addOnClean.plateitems = prod.addOn.plateitems;
          const plateCost = prod.addOn.plateitems * (recommendedItem.vendor_Platecost || 0);
          unitPrice += plateCost;
        }
      }

      const productTotal = unitPrice * prod.quantity;
      subTotal += productTotal;
      totalItems += prod.quantity;

      cleanProducts.push({
        restaurantProductId: prod.restaurantProductId._id,
        recommendedId: prod.recommendedId,
        quantity: prod.quantity,
        name: recommendedItem.name,
        basePrice: unitPrice,
        image: recommendedItem.image || "",
        ...(Object.keys(addOnClean).length > 0 ? { addOn: addOnClean } : {}), // Add addons if any
      });
    }

    // **Calculate distanceKm** (using Haversine formula)
    const userCoords = user.location.coordinates; // Assuming [longitude, latitude]
    const restaurantCoords = restaurant.location.coordinates; // Assuming [longitude, latitude]

    const distanceKm = haversineDistance(
      [userCoords[0], userCoords[1]],
      [restaurantCoords[0], restaurantCoords[1]]
    );

    // **Get the DeliveryBoy's baseDeliveryCharge** (Assuming we can fetch the nearest available delivery boy)
    const nearestDeliveryBoy = await DeliveryBoy.findOne({ status: 'Available' }).sort({ createdAt: 1 });
    const baseDeliveryCharge = nearestDeliveryBoy ? nearestDeliveryBoy.baseDeliveryCharge : 5; // Default base charge if no delivery boy found

    // Calculate the actual delivery charge and round to nearest whole number
    const calculatedDeliveryCharge = Math.round(baseDeliveryCharge * distanceKm); // Round to nearest integer

    // Apply coupon from cart
    const couponDiscount = cart.couponDiscount || 0;
    const appliedCoupon = cart.appliedCoupon || null;
    const totalPayable = subTotal + calculatedDeliveryCharge - couponDiscount;

    // Round the total payable value to 2 decimal places
    const roundedTotalPayable = totalPayable.toFixed(2); // Ensure 2 decimals

    // Auto-set payment status based on payment method
    const paymentStatus = paymentMethod === "COD" ? "Pending" : "Paid";

    // Create order data with restaurant location directly
    const orderData = {
      userId,
      cartId: cart._id, // Use cart's _id
      restaurantId,
      restaurantLocation: restaurant.location, // Save the restaurant's location here (directly from restaurant)
      deliveryAddress: selectedAddress, // Full address object
      paymentMethod,
      paymentStatus,
      orderStatus: "Pending",
      totalItems,
      subTotal,
      deliveryCharge: calculatedDeliveryCharge,
      couponDiscount,
      appliedCoupon,
      totalPayable: roundedTotalPayable,  // Use the rounded totalPayable here
      products: cleanProducts,
      distanceKm,
    };

    // Create order
    const order = await Order.create(orderData);
    const populatedOrder = await Order.findById(order._id)
      .populate("restaurantId", "restaurantName") // Just populate restaurantName if needed
      .populate("userId", "name email");

    // Optional: Clear cart after successful order creation
    await Cart.findOneAndUpdate(
      { userId },
      {
        products: [],
        subTotal: 0,
        deliveryCharge: 0,
        couponDiscount: 0,
        finalAmount: 0,
        totalItems: 0,
        appliedCoupon: null,
      }
    );

    return res.status(201).json({
      success: true,
      message: paymentStatus === "Paid" ? "Payment successful and order created" : "Order created successfully",
      data: populatedOrder,
    });

  } catch (error) {
    console.error("createOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
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
      orderStatus: "Completed"
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

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required."
      });
    }

    // Fetch all accepted orders for the user
    const acceptedOrders = await Order.find({
      userId,
      orderStatus: "Accepted"
    })
      .populate("restaurantId", "restaurantName locationName")
      .populate("deliveryBoyId", "fullName mobileNumber");

    const result = acceptedOrders.map(order => {
      const pickupTime = order.acceptedAt ? new Date(order.acceptedAt) : null;

      // Estimate delivery time (e.g., +30 mins)
      const deliveryTime = pickupTime ? new Date(pickupTime.getTime() + 30 * 60000) : null;

      const pickupTimeStr = pickupTime
        ? pickupTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "";

      const deliveryTimeStr = deliveryTime
        ? deliveryTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "";

      return {
        message: "Vendor Accepted Your Order From",
        restaurantName: order.restaurantId?.restaurantName || "Unknown Restaurant",
        restaurantLocation: order.restaurantId?.locationName || "Unknown Location",

        orderDetails: {
          totalItems: order.totalItems || 0,
          subTotal: `₹${order.subTotal.toFixed(2)}`,
          deliveryCharge: `₹${order.deliveryCharge.toFixed(2)}`,
          totalPayable: `₹${order.totalPayable.toFixed(2)}`
        },

        deliveryFlow: {
          restaurant: {
            name: order.restaurantId?.restaurantName || "Restaurant",
            time: pickupTimeStr
          },
          user: {
            address: order.deliveryAddress?.street || "Your Address",
            time: deliveryTimeStr
          }
        },

        riderDetails:
          order.deliveryStatus === "Picked"
            ? {
              name: order.deliveryBoyId?.fullName || "Delivery Boy",
              contact: order.deliveryBoyId?.mobileNumber || "N/A"
            }
            : null
      };
    });

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
    const { orderStatus } = req.body;  // Extract orderStatus from the request body

    // Step 1: Find the order by orderId
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Step 2: Verify if the restaurantId in the order matches the provided vendorId
    if (order.restaurantId.toString() !== vendorId) {
      return res.status(403).json({ success: false, message: "Unauthorized action: Vendor ID does not match the order's restaurant" });
    }

    // Step 3: Get the restaurant location from the order
    const restaurantCoords = order.restaurantLocation?.coordinates || [0, 0];
    if (restaurantCoords.length === 0) {
      return res.status(400).json({ success: false, message: "Restaurant location not available" });
    }

  // Step 4: Find active delivery boys within 10 km of the restaurant's location
const nearbyDeliveryBoys = await DeliveryBoy.find({
  location: {
    $nearSphere: {
      $geometry: {
        type: "Point",
        coordinates: restaurantCoords,  // restaurant coordinates
      },
      $maxDistance: 10000 // 10 km in meters
    }
  },
  //isActive: true,        // Ensure delivery boy is active
  //currentOrder: false    // Ensure delivery boy does not have an active order
});


    if (!nearbyDeliveryBoys.length) {
      return res.status(404).json({ success: false, message: "No delivery boys found within 10 km or all are busy" });
    }

    // Step 5: Collect the available delivery boys' information (No need to calculate distance for charge)
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

    // Step 6: Update order status with the provided value from the request body
    order.orderStatus = orderStatus || "Pending";  // Default to "Pending" if no orderStatus is provided
    order.deliveryStatus = "Pending"; // Always set deliveryStatus to "Pending"
    order.acceptedAt = new Date();
    order.distanceKm = 0;  // Distance calculation could be added here if necessary

    // Step 7: Add the available delivery boys to the order
    order.availableDeliveryBoys = deliveryBoysInfo;  // Store available delivery boys in the order

    // Step 8: Return the delivery charge from the order directly
    const deliveryCharge = order.deliveryCharge || 0;  // Assuming deliveryCharge is stored in the order

    // Save the order with updated availableDeliveryBoys
    await order.save();

    // Step 9: Respond with available delivery boys, the updated order status, and the delivery charge
    res.status(200).json({
      success: true,
      message: "Order accepted, delivery boys available for this order",
      order,
      availableDeliveryBoys: deliveryBoysInfo, // List of available delivery boys with details
      deliveryCharge,  // Show the delivery charge directly from the order
      count: deliveryBoysInfo.length, // Number of delivery boys available
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

    // Step 1: Find the orders where deliveryBoyId is in availableDeliveryBoys and deliveryStatus is 'Pending'
    const orders = await Order.find({
      "availableDeliveryBoys.deliveryBoyId": deliveryBoyId,  // Check if deliveryBoyId is in availableDeliveryBoys array
      deliveryStatus: "Pending"  // Only consider orders with deliveryStatus 'Pending'
    })
      .populate("restaurantId")  // Optionally, populate restaurantId to get full restaurant data
      .select('-availableDeliveryBoys');  // Exclude availableDeliveryBoys from the response

    // Step 2: If no orders are found
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this delivery boy with 'Pending' status."
      });
    }

    // Step 3: Return the full order data where the deliveryBoyId is present and deliveryStatus is 'Pending'
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
      .populate("userId", "name email")
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




exports.markOrderAsDelivered = async (req, res) => {
  try {
    const { deliveryBoyId, orderId, paymentType } = req.body;

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

    // Ensure the order is in "Picked" status before proceeding to "Delivered"
    if (order.orderStatus !== "Picked" || order.deliveryStatus !== "Picked") {
      return res.status(400).json({
        success: false,
        message: "Order is not in 'Picked' status.",
      });
    }

    // Mark order as delivered and update statuses
    order.orderStatus = "Delivered";
    order.deliveryStatus = "Delivered";

    // Store the paymentType in the order
    if (paymentType) {
      order.paymentType = paymentType;  // Store payment type in order
    }

    // Handle payment for COD orders (without UPI ID)
    if (order.paymentMethod === "COD") {
      order.paymentStatus = "Paid";  // Update payment status to Paid
    } else {
      // For other payment methods, mark as completed
      order.paymentStatus = "Completed";
    }

    // Update the delivery boy's wallet
    const deliveryCharge = order.deliveryCharge || 0;
    const today = new Date();
    const dateAdded = today.toISOString();

    deliveryBoy.walletBalance = (deliveryBoy.walletBalance || 0) + deliveryCharge;

    // Add transaction history
    deliveryBoy.walletTransactions.push({
      amount: deliveryCharge,
      dateAdded: dateAdded,
      type: "delivery",
      orderId: orderId,
    });

    // **Update the delivery boy's currentOrderStatus to 'Delivered'**
    deliveryBoy.currentOrderStatus = "Delivered";  // Set the delivery boy's current order status

    // Set the delivery boy's currentOrder to false (mark as available again)
    deliveryBoy.currentOrder = false;

    // Save the updated order and delivery boy
    await order.save();
    await deliveryBoy.save();

    return res.status(200).json({
      success: true,
      message: "Order marked as 'Delivered', payment status updated, and delivery charge added to rider's wallet.",
      data: order,
    });
  } catch (error) {
    console.error("Error marking order as delivered:", error);
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
