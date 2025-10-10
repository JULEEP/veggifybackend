const Product = require("../models/productModel");
const Order = require("../models/orderModel");
const RestaurantProduct = require("../models/restaurantProductModel");
const User = require("../models/userModel");
const Cart = require("../models/cartModel");
const Restaurant = require("../models/restaurantModel");
const cloudinary = require('../config/cloudinary');
const {DeliveryBoy} = require("../models/deliveryBoyModel");
const mongoose = require("mongoose");
const fs = require("fs");

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
const calculateDistance = (coord1, coord2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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

// 2. Get Wishlist
exports.getWishlist = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).populate("myWishlist");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ wishlist: user.myWishlist });
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

// Create Order
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

        // Get cart by userId (instead of cartId)
        const cart = await Cart.findOne({ userId })
            .populate('products.restaurantProductId');

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
            { 
                _id: userId,
                "address._id": addressId 
            },
            {
                name: 1, 
                email: 1,
                location: 1,
                address: { 
                    $elemMatch: { _id: addressId } 
                }
            }
        );

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User or address not found." 
            });
        }

        const selectedAddress = user.address[0];
        if (!selectedAddress || !user.location || !user.location.coordinates) {
            return res.status(400).json({ 
                success: false, 
                message: "User location or selected address not found." 
            });
        }

        // Get restaurantId from cart
        const restaurantId = cart.restaurantId;
        if (!restaurantId) {
            return res.status(400).json({ 
                success: false, 
                message: "Restaurant not found in cart." 
            });
        }

        // Get restaurant details
        const restaurant = await Restaurant.findById(restaurantId, "locationName restaurantName location");
        if (!restaurant) {
            return res.status(404).json({ 
                success: false, 
                message: "Restaurant not found." 
            });
        }

        // Calculate distance using user's location coordinates
        const [userLon, userLat] = user.location.coordinates;
        const [restLon, restLat] = restaurant.location.coordinates;
        const distanceKm = parseFloat(calculateDistanceKm(userLat, userLon, restLat, restLon).toFixed(3));

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
                // Half variation
                if (recommendedItem.addons.variation?.type.includes("Half") && prod.addOn.variation === "Half") {
                    addOnClean.variation = "Half";
                    unitPrice = recommendedItem.calculatedPrice?.half || 
                               Math.round(unitPrice * (recommendedItem.vendorHalfPercentage / 100));
                }
                
                // Plates
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
                ...(Object.keys(addOnClean).length > 0 ? { addOn: addOnClean } : {})
            });
        }

        // Calculate delivery charge
      let deliveryCharge = 0; // Delivery is free for now


        // Apply coupon from cart
        const couponDiscount = cart.couponDiscount || 0;
        const appliedCoupon = cart.appliedCoupon || null;
        const totalPayable = subTotal + deliveryCharge - couponDiscount;

        // Auto-set payment status based on payment method
        const paymentStatus = paymentMethod === "COD" ? "Pending" : "Paid";

        // Create order data
        const orderData = {
            userId,
            cartId: cart._id, // Use cart's _id
            restaurantId,
            restaurantLocation: restaurant.locationName || "",
            deliveryAddress: selectedAddress, // Full address object
            paymentMethod,
            paymentStatus,
            orderStatus: "Pending",
            totalItems,
            subTotal,
            deliveryCharge,
            couponDiscount,
            appliedCoupon,
            totalPayable,
            products: cleanProducts,
            distanceKm
        };

        // Create order
        const order = await Order.create(orderData);
        const populatedOrder = await Order.findById(order._id)
            .populate("restaurantId", "restaurantName locationName")
            .populate("userId", "name email");

        // Optional: Clear cart after successful order creation
        // await Cart.findOneAndUpdate(
        //     { userId }, 
        //     { 
        //         products: [], 
        //         subTotal: 0, 
        //         deliveryCharge: 0, 
        //         couponDiscount: 0, 
        //         finalAmount: 0, 
        //         totalItems: 0,
        //         appliedCoupon: null 
        //     }
        // );

        return res.status(201).json({
            success: true,
            message: paymentStatus === "Paid" ? "Payment successful and order created" : "Order created successfully",
            data: populatedOrder
        });

    } catch (error) {
        console.error("createOrder error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
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
      .populate("userId") // all user fields
      .populate({
        path: "cartId",
        populate: [
          { path: "userId", select: "name email phone" },  // user inside cart
          { path: "restaurantId", select: "restaurantName locationName" }, // restaurant inside cart
          {
            path: "products.restaurantProductId",
            select: "name price image",  // product details inside cart products array
          },
          { path: "appliedCouponId", select: "code discountPercentage" } // coupon details if needed
        ],
      });

    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("getAllOrders error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
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
        if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: "Valid userId is required." });

        const orders = await Order.find({ userId }).populate("restaurantId", "restaurantName locationName");
        return res.status(200).json({ success: true, data: orders });
    } catch (error) {
        console.error("getOrderByUserId error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
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
// Vendor accept order
const haversineDistance = (coords1, coords2) => {
  const toRad = x => (x * Math.PI) / 180;
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
  return R * c;
};

exports.vendorAcceptOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Step 1: Find and update order status to "Accepted"
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Step 2: Get user's delivery location
    const user = await User.findById(order.userId);
    if (!user || !user.location || !user.location.coordinates) {
      return res.status(400).json({ success: false, message: "User location not available" });
    }

    const userCoords = user.location.coordinates;

    // Step 3: Find active delivery boys within 10 km of user
    const nearbyDeliveryBoys = await DeliveryBoy.find({
      isActive: true,
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: userCoords,
          },
          $maxDistance: 10000 // 10 km in meters
        }
      }
    });

    if (!nearbyDeliveryBoys.length) {
      return res.status(404).json({ success: false, message: "No delivery boy found within 10 km" });
    }

    const assignedDeliveryBoy = nearbyDeliveryBoys[0];

    // Step 4: Calculate pickup and drop distances
    const restaurantCoords = order.restaurantLocation?.coordinates || [0, 0];
    const pickupDistance = haversineDistance(assignedDeliveryBoy.location.coordinates, restaurantCoords);
    const dropDistance = haversineDistance(restaurantCoords, userCoords);
    const totalDistance = pickupDistance + dropDistance;

    // Step 5: Update order with assignment and distances
    order.orderStatus = "Accepted";
    order.deliveryBoyId = assignedDeliveryBoy._id;
    order.deliveryStatus = "Assigned";
    order.acceptedAt = new Date();
    order.distanceKm = parseFloat(totalDistance.toFixed(2)); // optional rounding

    await order.save();

    // Step 6: Respond to client
    res.status(200).json({
      success: true,
      message: "Order accepted and delivery boy assigned",
      order,
      deliveryBoy: assignedDeliveryBoy
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