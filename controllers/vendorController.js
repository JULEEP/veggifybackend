
const Restaurant = require("../models/restaurantModel");
const Order = require("../models/orderModel");
const RestaurantProduct = require("../models/restaurantModel");
const moment = require("moment");
const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const Razorpay = require('razorpay'); // ✅ Import Razorpay
const VendorPlan = require("../models/VendorPlan");
const VendorPayment = require("../models/VendorPayment");




exports.vendorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const vendor = await Restaurant.findOne({ email: email.toLowerCase() });
    if (!vendor) {
      return res.status(401).json({ success: false, message: "Vendor not found" });
    }

    // Check password (plain text, or use bcrypt if hashed)
    if (vendor.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // Generate 4-digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString(); // 1000-9999

    // Set OTP expiry (5 minutes)
    vendor.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    };

    await vendor.save();

    // For testing/dev: send OTP in response as well
    console.log("OTP for login:", otpCode);

    res.status(200).json({
      success: true,
      message: "OTP sent to registered email/mobile",
      vendorId: vendor._id,
      otp: otpCode // ✅ sending OTP in response
    });

  } catch (err) {
    console.error("Vendor login error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



exports.verifyOtp = async (req, res) => {
  try {
    const { vendorId, otp } = req.body;

    if (!vendorId || !otp) {
      return res.status(400).json({ success: false, message: "vendorId and otp are required" });
    }

    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    if (!vendor.otp || vendor.otp.code !== otp) {
      return res.status(401).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > new Date(vendor.otp.expiresAt)) {
      return res.status(401).json({ success: false, message: "OTP expired" });
    }

    // Clear OTP after successful verification
    vendor.otp = null;
    await vendor.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. Login complete.",
      vendor: {
        id: vendor._id,
        restaurantName: vendor.restaurantName,
        email: vendor.email,
        mobile: vendor.mobile,
        locationName: vendor.locationName,
        image: vendor.image?.url
      }
    });

  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


exports.getOrdersByVendorId = async (req, res) => {
  const { vendorId } = req.params;

  try {
    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    // Vendor ka restaurantId ke liye pehle vendor (restaurant) find karo
    const vendor = await Restaurant.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const orders = await Order.find({ restaurantId: vendor._id })
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId", "firstName lastName email phoneNumber")
      .populate("deliveryBoyId", "fullName email mobileNumber") // <-- yahan populate kiya delivery boy ka
      .populate({
        path: "cartId",
        populate: {
          path: "products.restaurantProductId",
          model: "RestaurantProduct", // optional: expand product reference
        },
      });

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("getOrdersByVendorId error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.updateOrderById = async (req, res) => {
  const { orderId } = req.params;
  const updateData = req.body; // Data to update, like status, paymentStatus, etc.

  try {
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, {
      new: true, // return the updated document
      runValidators: true, // validate before update
    })
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId", "firstName lastName email phoneNumber")
      .populate({
        path: "cartId",
        populate: {
          path: "products.restaurantProductId",
          model: "RestaurantProduct",
        },
      });

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("updateOrderById error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.deleteOrderById = async (req, res) => {
  const { orderId } = req.params;

  try {
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const deletedOrder = await Order.findByIdAndDelete(orderId);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("deleteOrderById error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getVendorProfile = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required in params",
      });
    }

    // Find vendor by _id
    const vendor = await Restaurant.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor profile fetched successfully",
      vendor,
    });

  } catch (err) {
    console.error("Get vendor profile error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};



// Weekly Sales Helper
const getWeekSales = async (vendorId, startDate, endDate) => {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const data = await Order.aggregate([
    { $match: { restaurantId: vendorId, createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: { $dayOfWeek: "$createdAt" }, sales: { $sum: "$subTotal" } } },
  ]);
  
  console.log("Weekly Sales Aggregation Result:", data);

  return days.map((d, i) => {
    const match = data.find((x) => x._id === i + 1);
    return { name: d, sales: match?.sales ?? 0 };
  });
};

// Controller


exports.getDashboardData = async (req, res) => {
  const { vendorId } = req.params;
  if (!vendorId)
    return res
      .status(400)
      .json({ success: false, message: "Vendor ID is required" });

  try {
    const today = moment();
    const ranges = {
      todayStart: today.clone().startOf("day").toDate(),
      todayEnd: today.clone().endOf("day").toDate(),
      weekStart: today.clone().startOf("week").toDate(),
      weekEnd: today.clone().endOf("week").toDate(),
      lastWeekStart: today.clone().subtract(1, "week").startOf("week").toDate(),
      lastWeekEnd: today.clone().subtract(1, "week").endOf("week").toDate(),
      lastMonthStart: today.clone().subtract(1, "month").startOf("month").toDate(),
      lastMonthEnd: today.clone().subtract(1, "month").endOf("month").toDate(),
    };

    // 🔹 Orders
    const todayOrders = await Order.find({
      restaurantId: new mongoose.Types.ObjectId(vendorId),
      createdAt: { $gte: ranges.todayStart, $lte: ranges.todayEnd },
    });

    const totalOrders = await Order.countDocuments({
      restaurantId: new mongoose.Types.ObjectId(vendorId),
    });

    const completedOrders = await Order.countDocuments({
      restaurantId: new mongoose.Types.ObjectId(vendorId),
      orderStatus: "Delivered",
    });

    const agg = await Order.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(vendorId) } },
      { $group: { _id: null, total: { $sum: "$subTotal" } } },
    ]);
    const orderAmount = agg[0]?.total || 0;

    // 🔹 Restaurant Products
    const productsList = await RestaurantProduct.find({
      restaurantId: new mongoose.Types.ObjectId(vendorId),
    });

    const totalProducts = productsList.reduce(
      (sum, rp) => sum + (rp.recommended?.length ?? 0),
      0
    );

    // 🔹 Recent & Pending Orders
    const recentOrders = await Order.find({
      restaurantId: new mongoose.Types.ObjectId(vendorId),
    })
      .sort({ createdAt: -1 })
      .limit(10);

    const pendingOrders = await Order.find({
      restaurantId: new mongoose.Types.ObjectId(vendorId),
      orderStatus: "Pending",
    }).limit(10);

    // 🔹 Sales Data
    const salesData = {
      Today: [
        { name: "Today", sales: todayOrders.reduce((s, o) => s + o.subTotal, 0) },
      ],
      "This Week": await getWeekSales(vendorId, ranges.weekStart, ranges.weekEnd),
      "Last Week": await getWeekSales(
        vendorId,
        ranges.lastWeekStart,
        ranges.lastWeekEnd
      ),
      "Last Month": (
        await Order.aggregate([
          {
            $match: {
              restaurantId: new mongoose.Types.ObjectId(vendorId),
              createdAt: { $gte: ranges.lastMonthStart, $lte: ranges.lastMonthEnd },
            },
          },
          { $group: { _id: { $week: "$createdAt" }, sales: { $sum: "$subTotal" } } },
          { $sort: { _id: 1 } },
        ])
      ).map((w, i) => ({ name: `Week ${i + 1}`, sales: w.sales })),
    };

    return res.json({
      success: true,
      stats: { totalOrders, completedOrders, orderAmount, totalProducts },
      salesData,
      orders: recentOrders,
      pendingOrders,
      products: productsList, // full product data included
    });
  } catch (err) {
    console.error("Error in getDashboardData:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};


exports.getAllUsersByRestaurant = async (req, res) => {
  try {
    // Get the restaurant ID from the request params
    const { restaurantId } = req.params;

    // Check if restaurantId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        message: 'Invalid restaurant ID format.',
      });
    }

    // Find the restaurant by its ID using ObjectId
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        message: 'Restaurant not found with this ID',
      });
    }

    // Fetch all users who have the restaurant's referral code in their 'referredBy' field
    const users = await userModel.find({ referredBy: restaurant.referralCode });

    // If users are found, return their details
    if (users.length === 0) {
      return res.status(200).json({
        message: 'No users found for this restaurant',
        data: [],
      });
    }

    return res.status(200).json({
      message: 'Users found successfully',
      data: users,
    });

  } catch (err) {
    console.error('❌ Error fetching users by restaurant:', err);
    return res.status(500).json({
      message: 'Error fetching users for this restaurant',
      error: err.message,
    });
  }
};



const razorpay = new Razorpay({
 key_id: 'rzp_test_BxtRNvflG06PTV',
 key_secret: 'RecEtdcenmR7Lm4AIEwo4KFr',
});

// Capture Vendor Payment
exports.captureVendorPayment = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { planId, transactionId } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required in params",
      });
    }

    if (!planId || !transactionId) {
      return res.status(400).json({
        success: false,
        message: "planId and transactionId are required",
      });
    }

    console.log('🔍 Searching for vendor:', vendorId);
    console.log('🔍 Searching for plan:', planId);

    // 1️⃣ FIND VENDOR IN RESTAURANT MODEL
    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      console.log('❌ Vendor not found:', vendorId);
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }
    console.log('✅ Vendor found:', vendor.restaurantName);

    // 2️⃣ Fetch the vendor plan
    let plan;
    try {
      // Search the plan by planId directly (mongoose will automatically handle ObjectId conversion)
      plan = await VendorPlan.findById(planId);

      if (!plan) {
        console.log('❌ Plan not found with ID:', planId);

        // List all available plans for debugging
        const allPlans = await VendorPlan.find({});
        console.log('📋 Available plans:', allPlans.map(p => ({ id: p._id, name: p.name })));

        return res.status(404).json({
          success: false,
          message: "Vendor plan not found",
          availablePlans: allPlans.map(p => ({ id: p._id, name: p.name, price: p.price }))
        });
      }
    } catch (planError) {
      console.error('❌ Error finding plan:', planError);
      return res.status(500).json({
        success: false,
        message: "Error finding vendor plan",
        error: planError.message,
      });
    }

    console.log('✅ Plan found:', plan.name, 'Price:', plan.price);

    // 3️⃣ Capture the payment manually with Razorpay
    let capturedPayment;
    try {
      console.log('💳 Capturing payment with Razorpay...');
      capturedPayment = await razorpay.payments.capture(
        transactionId,
        plan.price * 100, // Convert to paise (Razorpay expects the amount in paise)
        "INR"
      );

      if (!capturedPayment || capturedPayment.status !== "captured") {
        console.log('❌ Razorpay capture failed:', capturedPayment);
        return res.status(400).json({
          success: false,
          message: "Payment capture failed",
        });
      }
      console.log('✅ Payment captured successfully:', capturedPayment.id);
    } catch (razorpayError) {
      console.error('❌ Razorpay capture error:', razorpayError);
      return res.status(400).json({
        success: false,
        message: "Payment capture failed - Razorpay error",
        error: razorpayError.error?.description || razorpayError.message,
      });
    }

    // 4️⃣ Find existing payment or create a new one
    let payment = await VendorPayment.findOne({ vendorId, planId });

    const purchaseDate = new Date();
// 3️⃣ Calculate expiry date based on plan validity in years
const validityInMilliseconds = plan.validity * 365 * 24 * 60 * 60 * 1000; // Validity in years
const expiryDate = new Date(purchaseDate.getTime() + validityInMilliseconds); // Adding validity to the current purchase date

    if (!payment) {
      // Create new payment record
      payment = new VendorPayment({
        vendorId,
        planId,
        transactionId,
        razorpayPaymentId: capturedPayment.id,
        isPurchased: true,
        planPurchaseDate: purchaseDate,
        expiryDate,
        amount: plan.price,
        status: 'completed',
      });
    } else {
      // Update existing payment record
      payment.transactionId = transactionId;
      payment.razorpayPaymentId = capturedPayment.id;
      payment.isPurchased = true;
      payment.planPurchaseDate = purchaseDate;
      payment.expiryDate = expiryDate;
      payment.amount = plan.price;
      payment.status = 'completed';
    }

    await payment.save();
    console.log('💾 Payment record saved:', payment._id);

    // 5️⃣ Update vendor's plan status in Restaurant model
    await Restaurant.findByIdAndUpdate(vendorId, {
      currentPlan: planId,
      planExpiry: expiryDate,
      planStatus: 'active',
      planPurchaseDate: purchaseDate,
      isPlanActive: true,
    }, { new: true });

    console.log('✅ Vendor plan activated successfully');

    // 6️⃣ Respond with success data
    res.status(200).json({
      success: true,
      message: "Payment captured successfully, vendor plan activated",
      data: {
        payment: {
          id: payment._id,
          transactionId: payment.transactionId,
          amount: payment.amount,
          status: payment.status,
          purchaseDate: payment.planPurchaseDate,
          expiryDate: payment.expiryDate,
        },
        vendor: {
          id: vendor._id,
          restaurantName: vendor.restaurantName,
          email: vendor.email,
          mobile: vendor.mobile,
          locationName: vendor.locationName,
        },
        plan: {
          id: plan._id,
          name: plan.name,
          price: plan.price,
          validity: plan.validity,
          benefits: plan.benefits,
        },
        expiryDate: expiryDate,
      },
    });

  } catch (err) {
    console.error('❌ Error capturing vendor payment:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while capturing payment',
      error: err.message,
    });
  }
};



// Get Vendor Payment Details by Vendor ID
exports.getVendorPaymentDetails = async (req, res) => {
  try {
    const { vendorId } = req.params; // Get the vendorId from the route params

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    // Find the payment details by vendorId
    const paymentDetails = await VendorPayment.findOne({ vendorId });

    if (!paymentDetails) {
      return res.status(404).json({
        success: false,
        message: "Payment details not found for this vendor",
      });
    }

    // Respond with payment details
    res.status(200).json({
      success: true,
      message: "Vendor payment details fetched successfully",
      data: paymentDetails,
    });

  } catch (err) {
    console.error('❌ Error fetching vendor payment details:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching vendor payment details',
      error: err.message,
    });
  }
};


// Get All Vendor Payments
// Get All Vendor Payments with populated vendor and plan details
exports.getAllVendorPayments = async (req, res) => {
  try {
    // Fetch all payment records from the VendorPayment model and populate vendorId and planId
    const payments = await VendorPayment.find()
      .populate('vendorId', 'restaurantName email mobile locationName') // Populate vendorId with selected fields
      .populate('planId', 'name price validity benefits'); // Populate planId with selected fields

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No vendor payments found",
      });
    }

    // Respond with all the payments, now including vendor and plan details
    res.status(200).json({
      success: true,
      message: "All vendor payments fetched successfully",
      data: payments,
    });

  } catch (err) {
    console.error('❌ Error fetching all vendor payments:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching all vendor payments',
      error: err.message,
    });
  }
};



exports.getVendorStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required in params",
      });
    }

    // Find vendor by _id and only select the status field
    const vendor = await Restaurant.findById(vendorId).select('status');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor status fetched successfully",
      status: vendor.status,  // Send only the status
    });

  } catch (err) {
    console.error("Get vendor status error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};



// Update Vendor Status Controller
exports.updateVendorStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status } = req.body;

    // Validate vendorId
    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Validate status
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'inactive'"
      });
    }

    // Find vendor by ID
    const vendor = await Restaurant.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    // Update vendor status
    vendor.status = status;
    await vendor.save();

    res.status(200).json({
      success: true,
      message: `Vendor status updated to ${status} successfully`,
      vendor: {
        id: vendor._id,
        restaurantName: vendor.restaurantName,
        status: vendor.status,
        email: vendor.email,
        mobile: vendor.mobile
      }
    });

  } catch (err) {
    console.error("Update vendor status error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};