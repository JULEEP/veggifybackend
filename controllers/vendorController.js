
const Restaurant = require("../models/restaurantModel");
const Order = require("../models/orderModel");
const RestaurantProduct = require("../models/restaurantModel");
const moment = require("moment");
const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const Razorpay = require('razorpay'); // ✅ Import Razorpay
const VendorPlan = require("../models/VendorPlan");
const VendorPayment = require("../models/VendorPayment");
const nodemailer = require("nodemailer");

const dotenv = require("dotenv");
const VendorAccount = require("../models/VendorAccount");
const orderModel = require("../models/orderModel");
const crypto = require('crypto');


dotenv.config();




 const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `VEGIFFY! <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    return true;
  } catch (error) {
    console.log("Email Send Error:", error);
    return false;
  }
};




// Step 1: Vendor Login → generate OTP + send email
// Vendor login — generate OTP + send email
exports.vendorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }

    const vendor = await Restaurant.findOne({ email: email.toLowerCase() });
    if (!vendor) {
      return res.status(401).json({ 
        success: false, 
        message: "Account not found. Please check your email or register as a new vendor." 
      });
    }

    // Check if vendor is active
    if (vendor.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is not active yet. Please wait for admin approval or contact support.",
        vendorStatus: vendor.status,
        contactEmail: "vendor@vegiffy.in",
        whatsapp: "+91 6309100101"
      });
    }

    if (vendor.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: "Incorrect password. Please try again." 
      });
    }

    // Generate 4-digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    vendor.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)  // 5 min
    };

    await vendor.save();

    const emailSubject = "VEGIFFY Vendor Login OTP 🔑";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height:1.6; max-width: 600px; margin: auto; padding: 20px; color:#333;">
        <h2 style="color: #1e88e5;">Your Login OTP for VEGIFFY</h2>
        <p>Use the OTP below to login to your vendor account:</p>
        <p style="font-size: 32px; font-weight: bold; margin: 20px 0;">${otpCode}</p>
        <p>This OTP is valid for <strong>5 minutes</strong>.</p>
        <hr style="margin: 30px 0;" />
        <p>If you did not request this, please ignore this email or contact our support.</p>
        <p>Need help? Contact us at <a href="mailto:vendor@vegiffy.in">vendor@vegiffy.in</a></p>
      </div>
    `;

    const emailSent = await sendEmail(vendor.email, emailSubject, emailHtml);
    if (!emailSent) {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send OTP email. Please try again." 
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      vendorId: vendor._id
    });

  } catch (error) {
    console.error("Vendor login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { vendorId, otp } = req.body;

    if (!vendorId || !otp) {
      return res.status(400).json({
        success: false,
        message: "vendorId and otp are required"
      });
    }

    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    // ✅ MASTER OTP CHECK (1234)
    if (otp === "1234") {
      vendor.otp = null;
      await vendor.save();

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully (master OTP). Login complete.",
        vendor: {
          id: vendor._id,
          restaurantName: vendor.restaurantName,
          email: vendor.email,
          mobile: vendor.mobile,
          locationName: vendor.locationName,
          image: vendor.image?.url
        }
      });
    }

    // ❌ Normal OTP validation
    if (!vendor.otp || vendor.otp.code !== otp) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    if (new Date() > new Date(vendor.otp.expiresAt)) {
      return res.status(401).json({
        success: false,
        message: "OTP expired"
      });
    }

    // ✅ Clear OTP after successful verification
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
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};



// Get all orders for a vendor (restaurant) but only show orders created 2 min ago or earlier
exports.getOrdersByVendorId = async (req, res) => {
  const { vendorId } = req.params;

  try {
    // Validate vendorId
    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Vendor ID is required",
      });
    }

    // Fetch vendor (restaurant)
    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Current time minus 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // Fetch orders created at least 2 min ago
    const orders = await Order.find({
      restaurantId: vendor._id,
      createdAt: { $lte: twoMinutesAgo }, // filter orders older than 2 minutes
    })
      .sort({ createdAt: -1 }) // newest first
      .populate("restaurantId", "restaurantName location")
      .populate("userId", "firstName lastName email phoneNumber")
      .populate("deliveryBoyId", "fullName email mobileNumber") // optional
      .populate({
        path: "cartId",
        populate: {
          path: "products.restaurantProductId",
          model: "RestaurantProduct",
        },
      });

    return res.status(200).json({
      success: true,
      message: `Orders for ${vendor.restaurantName} fetched successfully`,
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



// const razorpay = new Razorpay({
//  key_id: 'rzp_test_BxtRNvflG06PTV',
//  key_secret: 'RecEtdcenmR7Lm4AIEwo4KFr',
// });


const razorpay = new Razorpay({
 key_id: 'rzp_live_RppTI8LWcKMPyz',
 key_secret: 'K4LC6Csyw5CAYNF1fibZiLsB',
});



// Capture Vendor Payment — FIXED VERSION
exports.captureVendorPayment = async (req, res) => {
  try {
    console.log('🔔 [Payment Capture] Function called');
    console.log('📦 Request params:', req.params);
    console.log('📦 Request body:', req.body);

    const { vendorId } = req.params;
    const { planId, transactionId, paymentMethod = 'razorpay', bankDetails } = req.body;

    // 1️⃣ Basic validation
    if (!vendorId) {
      console.log('❌ Validation failed: Vendor ID missing');
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    if (!planId) {
      console.log('❌ Validation failed: planId missing');
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }
    console.log('✅ Basic validation passed');

    // 2️⃣ Find vendor
    console.log('🔍 Looking for vendor...', vendorId);
    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      console.log('❌ Vendor not found');
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }
    console.log('✅ Vendor found:', vendor.restaurantName);

    // 3️⃣ Find plan
    console.log('🔍 Looking for plan...', planId);
    const plan = await VendorPlan.findById(planId);
    if (!plan) {
      console.log('❌ Plan not found');
      return res.status(404).json({
        success: false,
        message: "Vendor plan not found",
      });
    }
    console.log('✅ Plan found:', plan.name, 'Price:', plan.price);

    // 4️⃣ Check payment method
    if (paymentMethod === 'bank_transfer' || paymentMethod === 'bank') {
      // Handle bank transfer - keep status as pending but set dates
      console.log('🏦 Processing bank transfer payment');
      console.log('📦 Bank details received:', bankDetails);
      
      // Calculate GST
      const baseAmount = plan.price;
      const gstRate = 18;
      const gstAmount = (baseAmount * gstRate) / 100;
      const totalAmount = baseAmount + gstAmount;
      
      // Generate a transaction ID for bank payment
      const bankTransactionId = `BANK_${Date.now()}_${vendor.restaurantName.replace(/\s+/g, '_')}`;
      
      // Prepare dates - Bank transfer mein bhi dates set karo
      const purchaseDate = new Date();
      const expiryDate = new Date(
        purchaseDate.getTime() + plan.validity * 24 * 60 * 60 * 1000
      );
      
      // Save payment - Bank transfer ke liye bhi isPurchased: true rakho
      const payment = new VendorPayment({
        vendorId,
        planId,
        transactionId: bankTransactionId,
        paymentMethod: 'bank_transfer',
        isPurchased: true, // ✅ Bank transfer ke liye bhi true
        planPurchaseDate: purchaseDate, // ✅ Date set karo
        expiryDate: expiryDate, // ✅ Expiry date set karo
        amount: baseAmount,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        status: "pending_verification", // ✅ Sirf status pending rakhna hai
        verificationNotes: "Awaiting admin verification - Bank transfer",
        submittedAt: purchaseDate,
        verifiedAt: null, // ❌ VerifiedAt null rahega (admin verify karega)
        verifiedBy: null, // ❌ VerifiedBy null rahega
        // Store bank details
        bankDetails: bankDetails || {
          accountName: "VEGIFFY PRIVATE LIMITED",
          accountNumber: "50200067111965",
          bankName: "HDFC Bank",
          ifscCode: "HDFC0001252"
        }
      });

      await payment.save();
      console.log('✅ Bank payment saved with dates set (status: pending_verification)');

      // Update restaurant with plan but status pending
      await Restaurant.findByIdAndUpdate(
        vendorId,
        {
          currentPlan: planId,
          planExpiry: expiryDate,
          planStatus: "pending_verification", // ✅ Status pending
          planPurchaseDate: purchaseDate,
          isPlanActive: false, // ❌ Active nahi hai abhi
          $push: {
            myPlans: {
              planId: planId,
              purchaseDate: purchaseDate,
              expiryDate: expiryDate,
              isPurchased: true, // ✅ Purchased true
              status: "pending_verification", // ✅ Status pending
              transactionId: bankTransactionId,
              paymentMethod: 'bank_transfer',
              bankDetails: bankDetails
            },
          },
        },
        { new: true }
      );
      console.log('✅ Restaurant updated with plan (pending verification)');

      // Response for bank payment
      return res.status(200).json({
        success: true,
        message: "Bank payment submitted. Your plan will be activated after verification (1-2 hours).",
        data: {
          payment: {
            id: payment._id,
            transactionId: payment.transactionId,
            status: payment.status,
            isPurchased: payment.isPurchased,
            planPurchaseDate: payment.planPurchaseDate,
            expiryDate: payment.expiryDate,
            submittedAt: payment.submittedAt,
            verificationStatus: "pending",
            bankDetails: payment.bankDetails
          },
          vendor: {
            id: vendor._id,
            restaurantName: vendor.restaurantName,
          },
          plan: {
            id: plan._id,
            name: plan.name,
            price: plan.price,
            validity: plan.validity,
          },
          verification: {
            estimatedTime: "1-2 hours",
            contactEmail: "vendor@vegiffy.in"
          }
        },
      });

    } else {
      // Handle Razorpay/UPI payment - auto complete
      console.log('💳 Processing Razorpay/UPI payment...', transactionId);
      
      // Razorpay ke liye transactionId required hai
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: "transactionId is required for Razorpay/UPI payments",
        });
      }
      
      try {
        const paymentDetails = await razorpay.payments.fetch(transactionId);
        console.log('✅ Razorpay payment details:', {
          id: paymentDetails.id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          status: paymentDetails.status,
          captured: paymentDetails.captured
        });

        // Check if payment is already captured
        if (paymentDetails.captured) {
          console.log('⚠️ Payment already captured');
          return res.status(400).json({
            success: false,
            message: "Payment already captured",
            data: { paymentId: paymentDetails.id }
          });
        }

        // Capture payment
        const authorizedAmount = paymentDetails.amount;
        const capturedPayment = await razorpay.payments.capture(
          transactionId,
          authorizedAmount,
          "INR"
        );

        console.log('✅ Payment captured successfully:', {
          id: capturedPayment.id,
          amount: capturedPayment.amount,
          status: capturedPayment.status,
        });

        // Calculate GST
        const baseAmount = plan.price;
        const gstRate = 18;
        const gstAmount = (baseAmount * gstRate) / 100;
        const totalAmountInINR = authorizedAmount / 100;

        // Prepare dates
        const purchaseDate = new Date();
        const expiryDate = new Date(
          purchaseDate.getTime() + plan.validity * 24 * 60 * 60 * 1000
        );

        // Save payment
        let payment = await VendorPayment.findOne({ vendorId, planId });
        
        const paymentData = {
          vendorId,
          planId,
          transactionId,
          razorpayPaymentId: capturedPayment.id,
          paymentMethod: paymentMethod,
          isPurchased: true,
          planPurchaseDate: purchaseDate,
          expiryDate,
          amount: baseAmount,
          gstAmount: gstAmount,
          totalAmount: totalAmountInINR,
          razorpayAmount: authorizedAmount,
          status: "completed", // ✅ Razorpay ke liye completed
          verifiedAt: purchaseDate, // ✅ Auto-verified
          verifiedBy: "system", // ✅ System verified
        };

        if (!payment) {
          payment = new VendorPayment(paymentData);
        } else {
          Object.assign(payment, paymentData);
        }

        await payment.save();
        console.log('✅ Payment record saved');

        // Update restaurant - Active status
        await Restaurant.findByIdAndUpdate(
          vendorId,
          {
            currentPlan: planId,
            planExpiry: expiryDate,
            planStatus: "active", // ✅ Razorpay ke liye active
            planPurchaseDate: purchaseDate,
            isPlanActive: true, // ✅ Active hai
            $push: {
              myPlans: {
                planId: planId,
                purchaseDate: purchaseDate,
                expiryDate: expiryDate,
                isPurchased: true,
                status: "active", // ✅ Active status
                transactionId: transactionId,
                paymentMethod: paymentMethod
              },
            },
          },
          { new: true }
        );
        console.log('✅ Restaurant updated with active plan');

        // Final response for Razorpay
        return res.status(200).json({
          success: true,
          message: "Payment captured successfully, vendor plan activated",
          data: {
            payment: {
              id: payment._id,
              transactionId: payment.transactionId,
              baseAmount: payment.amount,
              gstAmount: payment.gstAmount,
              totalAmount: payment.totalAmount,
              status: payment.status,
              isPurchased: payment.isPurchased,
              purchaseDate: payment.planPurchaseDate,
              expiryDate: payment.expiryDate,
            },
            vendor: {
              id: vendor._id,
              restaurantName: vendor.restaurantName,
            },
            plan: {
              id: plan._id,
              name: plan.name,
              price: plan.price,
              validity: plan.validity,
            },
          },
        });

      } catch (razorpayError) {
        console.error('❌ Razorpay API Error:', razorpayError);
        
        if (razorpayError.error && razorpayError.error.description) {
          return res.status(400).json({
            success: false,
            message: `Payment capture failed: ${razorpayError.error.description}`,
          });
        }
        
        throw razorpayError;
      }
    }

  } catch (err) {
    console.error("❌ Error capturing vendor payment:", err);
    
    let statusCode = 500;
    let errorMessage = "Server error while capturing payment";
    
    if (err.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = "Validation error: " + err.message;
    }
    
    if (err.statusCode) {
      statusCode = err.statusCode;
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: err.message || err.toString(),
    });
  }
};



exports.updateVendorPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params; // VendorPayment ID
    const { status } = req.body; // new status

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment id is required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // 1️⃣ Find payment
    const payment = await VendorPayment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Vendor payment not found",
      });
    }

    // 2️⃣ Update status
    payment.status = status;

    // If admin verifies bank payment
    if (status === "completed" || status === "verified") {
      payment.verifiedAt = new Date();
      payment.verifiedBy = "admin";
    }

    await payment.save();

    // 3️⃣ Fetch vendor
    const vendor = await Restaurant.findById(payment.vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // 4️⃣ Update vendor plan status (optional but correct)
    let vendorPlanStatus = vendor.planStatus;

    if (status === "completed" || status === "verified") {
      vendorPlanStatus = "active";
      vendor.isPlanActive = true;
    } else if (status === "rejected") {
      vendorPlanStatus = "rejected";
      vendor.isPlanActive = false;
    }

    await Restaurant.findByIdAndUpdate(vendor._id, {
      planStatus: vendorPlanStatus,
      isPlanActive: vendor.isPlanActive,
    });

    // 5️⃣ Send Email to Vendor
    const subject = `Payment Status Update - ${status.toUpperCase()}`;

    const html = `
  <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; padding:25px; border-radius:8px;">
      
      <h2 style="color:#2e7d32; text-align:center;">
        🎉 Congratulations ${vendor.restaurantName}!
      </h2>

      <p style="font-size:15px; color:#333;">
        We are happy to inform you that your payment has been <strong>successfully verified</strong>.
      </p>

      <p style="font-size:15px; color:#333;">
        ✅ Your subscription plan is now <strong>ACTIVE</strong> and your vendor panel has been fully unlocked.
      </p>

      <div style="background:#f1f8e9; padding:15px; border-radius:6px; margin:20px 0;">
        <p style="margin:0; font-size:14px;">
          <strong>Plan Status:</strong> Active
        </p>
        <p style="margin:6px 0 0; font-size:14px;">
          <strong>Access:</strong> Vendor Dashboard Enabled
        </p>
      </div>

      <p style="font-size:14px; color:#555;">
        You can now start managing your business, orders, and services directly from your panel.
      </p>

      <p style="font-size:14px; color:#555;">
        If you need any assistance, feel free to contact our support team.
      </p>

      <p style="margin-top:30px; font-size:14px; color:#333;">
        Regards,<br/>
        <strong>Vegiffy Team</strong>
      </p>
    </div>
  </div>
`;


    if (vendor.email) {
      await sendEmail(vendor.email, subject, html);
    }

    // 6️⃣ Response
    return res.status(200).json({
      success: true,
      message: "Payment status updated and vendor notified",
      data: {
        paymentId: payment._id,
        status: payment.status,
        vendor: {
          id: vendor._id,
          name: vendor.restaurantName,
          email: vendor.email,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error updating vendor payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.deleteVendorPayment = async (req, res) => {
  try {
    const { id } = req.params; // VendorPayment ID

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment id is required",
      });
    }

    // 1️⃣ Find payment
    const payment = await VendorPayment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Vendor payment not found",
      });
    }

    // 2️⃣ Fetch vendor
    const vendor = await Restaurant.findById(payment.vendorId);

    // 3️⃣ Delete payment
    await VendorPayment.findByIdAndDelete(id);

    // 4️⃣ Update vendor plan status (rollback)
    if (vendor) {
      await Restaurant.findByIdAndUpdate(vendor._id, {
        planStatus: "inactive",
        isPlanActive: false,
        currentPlan: null,
        planExpiry: null,
        planPurchaseDate: null,
      });
    }

    // 5️⃣ Send email to vendor (optional but recommended)
    if (vendor?.email) {
      const subject = "Payment Record Removed";

      const html = `
        <div style="font-family: Arial, sans-serif;">
          <h3>Hello ${vendor.restaurantName},</h3>
          <p>Your payment record has been removed by the administrator.</p>
          <p>Your subscription plan is currently <strong>inactive</strong>.</p>
          <p>If this was done by mistake or you have any questions, please contact support.</p>
          <br/>
          <p>Regards,<br/><strong>Vegiffy Team</strong></p>
        </div>
      `;

      await sendEmail(vendor.email, subject, html);
    }

    // 6️⃣ Response
    return res.status(200).json({
      success: true,
      message: "Vendor payment deleted successfully",
      data: {
        paymentId: id,
        vendor: vendor
          ? {
              id: vendor._id,
              name: vendor.restaurantName,
              email: vendor.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("❌ Error deleting vendor payment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// Admin verification function for bank payments
exports.verifyBankPayment = async (req, res) => {
  try {
    const { paymentId, action, adminId, notes } = req.body;
    
    if (!paymentId || !action || !adminId) {
      return res.status(400).json({
        success: false,
        message: "paymentId, action, and adminId are required"
      });
    }

    // Find the payment
    const payment = await VendorPayment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    if (action === 'approve') {
      // Update payment status to completed
      payment.status = 'completed';
      payment.verificationNotes = notes || 'Payment verified and approved by admin';
      payment.verifiedAt = new Date();
      payment.verifiedBy = adminId;
      
      await payment.save();

      // Update restaurant to active
      await Restaurant.findByIdAndUpdate(
        payment.vendorId,
        {
          planStatus: "active",
          isPlanActive: true,
          $set: {
            "myPlans.$[elem].status": "active"
          }
        },
        {
          arrayFilters: [{ "elem.transactionId": payment.transactionId }],
          new: true
        }
      );

      // Send notification to vendor
      // ... notification logic ...

      return res.status(200).json({
        success: true,
        message: "Payment verified and vendor plan activated",
        data: { payment }
      });

    } else if (action === 'reject') {
      // Reject payment
      payment.status = 'rejected';
      payment.verificationNotes = notes || 'Payment rejected by admin';
      payment.verifiedAt = new Date();
      payment.verifiedBy = adminId;
      
      await payment.save();

      // Update restaurant
      await Restaurant.findByIdAndUpdate(
        payment.vendorId,
        {
          planStatus: "rejected",
          isPlanActive: false,
          $set: {
            "myPlans.$[elem].status": "rejected"
          }
        },
        {
          arrayFilters: [{ "elem.transactionId": payment.transactionId }],
          new: true
        }
      );

      // Send rejection notification to vendor
      // ... notification logic ...

      return res.status(200).json({
        success: true,
        message: "Payment rejected",
        data: { payment }
      });
    }

  } catch (err) {
    console.error("❌ Error verifying bank payment:", err);
    res.status(500).json({
      success: false,
      message: "Server error while verifying payment",
      error: err.message
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



// 1) Forgot Password → send OTP to vendor email
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const vendor = await Restaurant.findOne({ email: email.toLowerCase() });
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found with this email" });
    }

    // Generate 4‑digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    vendor.resetPasswordOTP = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // OTP valid 15 min
    };

    await vendor.save();

    const subject = "VEGIFFY Password Reset OTP 🔐";
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Use the OTP below to reset your password:</p>
        <h1>${otpCode}</h1>
        <p>This OTP is valid for 15 minutes.</p>
        <p>If you didn't request this, ignore this email or contact support.</p>
      </div>
    `;

    const emailSent = await sendEmail(vendor.email, subject, html);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: "Failed to send OTP email" });
    }

    res.status(200).json({ success: true, message: "OTP sent to your email" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// 2) Reset Password using Email + OTP + New Password
exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Email, OTP, newPassword & confirmPassword required" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "newPassword and confirmPassword do not match" });
    }

    const vendor = await Restaurant.findOne({ email: email.toLowerCase() });
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const otpData = vendor.resetPasswordOTP;
    if (!otpData || otpData.code !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    if (new Date() > new Date(otpData.expiresAt)) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    // ✅ OTP ok → change password (plain text)
    vendor.password = newPassword;
    vendor.resetPasswordOTP = undefined; // clear/reset OTP

    await vendor.save();

    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("resetPasswordWithOtp error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



// Add new account
exports.addAccount = async (req, res) => {
  try {
    const {
      vendorId,
      accountHolderName,
      accountNumber,
      bankName,
      ifscCode,
      branchName,
      accountType,
      phoneNumber,
      email,
      isPrimary
    } = req.body;

    // Validate vendor exists
    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    // Check if account already exists for this vendor
    const existingAccount = await VendorAccount.findOne({
      vendorId,
      accountNumber,
      ifscCode
    });

   

    // If setting as primary, update existing primary accounts
    if (isPrimary) {
      await VendorAccount.updateMany(
        { vendorId, isPrimary: true },
        { $set: { isPrimary: false } }
      );
    }

    // Create new account
    const account = await VendorAccount.create({
      vendorId,
      accountHolderName,
      accountNumber,
      bankName,
      ifscCode,
      branchName,
      accountType,
      phoneNumber,
      email,
      isPrimary,
      status: 'active',
      verified: false
    });

    // Add account ID to restaurant's myAccounts array
    await Restaurant.findByIdAndUpdate(
      vendorId,
      { 
        $addToSet: { myAccounts: account._id }
      },
      { new: true }
    );

    // ✅ FIXED: Return account object directly instead of calling getFullDetails()
    res.status(201).json({
      success: true,
      data: account, // Simply return the account object
      message: "Account added successfully"
    });

  } catch (error) {
    console.error("Add account error:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Account number or IFSC code already exists"
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
// Get all accounts for vendor
// Get all accounts for vendor
exports.getVendorAccounts = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Validate vendor exists
    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // ✅ FIX HERE
    const accounts = await VendorAccount.find({
      vendorId: vendorId,
    });

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });

  } catch (error) {
    console.error("Get accounts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get account by ID
exports.getAccountById = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await VendorAccount.findById(id).populate('vendorId', 'restaurantName email mobile');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found"
      });
    }

    res.json({
      success: true,
      data: account.getFullDetails()
    });

  } catch (error) {
    console.error("Get account by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// Update account
// Update account
exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await VendorAccount.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    res.json({
      success: true,
      data: account, // 👈 direct account object
      message: "Account updated successfully",
    });

  } catch (error) {
    console.error("Update account error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete account
// Delete account
exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await VendorAccount.findById(id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Agar restaurant ke andar myAccounts array hai
    await Restaurant.findByIdAndUpdate(
      account.vendorId,
      {
        $pull: { myAccounts: account._id },
      }
    );

    await VendorAccount.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });

  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



exports.getRestaurantNotifications = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Validate vendor exists
    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Get notifications
    const restaurant = await Restaurant.findById(vendorId)
      .select('notifications restaurantName');

    const notifications = restaurant.notifications || [];
    const count = notifications.length;

    if (count === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: "No notifications available",
      });
    }

    res.json({
      success: true,
      data: notifications,
      count: count,
      message: `${count} notification${count === 1 ? '' : 's'} found`,
    });

  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};




exports.getAllOrdersByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // ✅ Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID format",
      });
    }

    // ✅ Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Get users referred by this restaurant
    const users = await userModel.find({
      referredBy: restaurant.referralCode,
    }).select("_id");

    if (!users || users.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No users found for this restaurant",
        data: [],
      });
    }

    const userIds = users.map((u) => u._id);

    // ✅ Fetch orders of those users
    const orders = await orderModel
      .find({
        userId: { $in: userIds },
        restaurantId: restaurantId,
      })
      .populate("restaurantId", "restaurantName locationName")
      .populate("userId", "name email phone")
      .populate({
        path: "cartId",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "restaurantId", select: "restaurantName locationName" },
          {
            path: "products.restaurantProductId",
            select: "name price image",
          },
          { path: "appliedCouponId", select: "code discountPercentage" },
        ],
      })
      .populate(
        "deliveryBoyId",
        "fullName mobileNumber vehicleType email deliveryBoyStatus"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully for restaurant",
      totalOrders: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("getAllOrdersByRestaurant error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};





// Setup Nodemailer transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pms226803@gmail.com',
    pass: 'nrasbifqxsxzurrm',
  },
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});

// Account deletion request
// DELETE ACCOUNT REQUEST (VENDOR)
exports.deleteRestaurantAccount = async (req, res) => {
  const { email, reason } = req.body;

  // 🔴 Validation
  if (!email || !reason) {
    return res.status(400).json({
      message: "Email and deletion reason are required",
    });
  }

  try {
    // ✅ Find restaurant by email
    const restaurant = await Restaurant.findOne({ email });

    if (!restaurant) {
      return res.status(404).json({
        message: "Vendor not found with this email",
      });
    }

    // 🔐 Generate token
    const token = crypto.randomBytes(20).toString("hex");
    const deleteLink = `${process.env.VENDOR_BASE_URL}/confirm-delete-account/${token}`;

    // Save token in restaurant
    restaurant.deleteToken = token;
    restaurant.deleteTokenExpiration = Date.now() + 60 * 60 * 1000; // 1 hour

    await restaurant.save();

    // 📧 Send Email
    const mailOptions = {
      from: "pms226803@gmail.com",
      to: email,
      subject: "Confirm Account Deletion",
      text: `Hi ${restaurant.restaurantName},

We received your account deletion request.

To confirm deletion, click the link below:
${deleteLink}

Reason:
${reason}

If you did not request this, please ignore this email.

Regards,
Vegiffy Team`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message:
        "Account deletion link sent successfully. Please check your email.",
    });

  } catch (error) {
    console.error("Delete restaurant error:", error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};


// Confirm account deletion
exports.confirmDeleteRestaurantAccount = async (req, res) => {
  const { token } = req.params;

  try {
    const restaurant = await Restaurant.findOne({
      deleteToken: token,
      deleteTokenExpiration: { $gt: Date.now() },
    });

    await Restaurant.findByIdAndDelete(restaurant._id);

    return res.status(200).json({
      message: "Your restaurant account has been deleted successfully",
    });

  } catch (error) {
    console.error("Confirm delete error:", error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};


// Delete user by ID (admin)
// ADMIN DELETE VENDOR
exports.deleteRestaurantByAdmin = async (req, res) => {
  const { vendorId } = req.params;

  try {
    const restaurant = await Restaurant.findById(vendorId);

    if (!restaurant) {
      return res.status(404).json({
        message: "Vendor not found",
      });
    }

    await Restaurant.findByIdAndDelete(vendorId);

    return res.status(200).json({
      message: "Vendor deleted successfully",
    });

  } catch (error) {
    console.error("Admin delete vendor error:", error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};


