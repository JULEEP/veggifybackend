
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
const SubAdmin = require("../models/SubAdmin");
const cloudinary = require("cloudinary");
const Reel = require("../models/Reel");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const adminModel = require("../models/adminModel");



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

    // ❌ REMOVED: status active/inactive check

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
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
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
        <p>If you did not request this, please ignore this email.</p>
        <p>Need help? Contact <a href="mailto:vendor@vegiffy.in">vendor@vegiffy.in</a></p>
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
      vendorId: vendor._id,
      otp: otpCode
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

    // ⏱️ Current time minus 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

    // Fetch orders created at least 30 sec ago
    const orders = await Order.find({
      restaurantId: vendor._id,
      createdAt: { $lte: thirtySecondsAgo },
    })
      .sort({ createdAt: -1 })
      .populate("restaurantId", "restaurantName location")
      .populate("userId", "firstName lastName email phoneNumber")
      .populate("riderId", "fullName mobileNumber vehicleType email isActive")
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
  const updateData = req.body;

  try {
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, {
      new: true,
      runValidators: true,
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

    // ✅ Sirf Accepted aur Rejected ke liye notification
    try {
      let notificationTitle = "";
      let notificationMessage = "";

      // Agar orderStatus update ho raha hai
      if (updateData.orderStatus) {
        if (updateData.orderStatus === 'Accepted') {
          notificationTitle = "✅ Order Accepted";
          notificationMessage = `Your order #${updatedOrder.orderNumber || updatedOrder._id.toString().slice(-6)} has been accepted by the restaurant`;
        } 
        else if (updateData.orderStatus === 'Rejected') {
          notificationTitle = "❌ Order Rejected";
          notificationMessage = `Your order #${updatedOrder.orderNumber || updatedOrder._id.toString().slice(-6)} has been rejected by the restaurant`;
        }
      }

      // Sirf notification tab bhejo agar Accepted ya Rejected hai
      if (notificationTitle && notificationMessage) {
        const userNotification = {
          type: 'order_updated',
          title: notificationTitle,
          message: notificationMessage,
          timestamp: new Date(),
          status: 'unread'
        };

        await User.findByIdAndUpdate(
          updatedOrder.userId,
          {
            $push: {
              notifications: {
                $each: [userNotification],
                $position: 0,
                $slice: 50
              }
            }
          }
        );
        
        console.log(`User notification sent for order ${updateData.orderStatus}`);
      }
    } catch (userNotifError) {
      console.error('User notification failed:', userNotifError.message);
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



// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload directories (SAME PATTERN AS deleteProfileImage)
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const PROFILE_IMAGES_DIR = path.join(UPLOADS_DIR, 'profile_images');
const VENDORS_DIR = path.join(UPLOADS_DIR, 'vendors');
const PAYMENT_SCREENSHOTS_DIR = path.join(VENDORS_DIR, 'payment_screenshots');

// Ensure directories exist (SAME PATTERN)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PROFILE_IMAGES_DIR)) {
  fs.mkdirSync(PROFILE_IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(VENDORS_DIR)) {
  fs.mkdirSync(VENDORS_DIR, { recursive: true });
}
if (!fs.existsSync(PAYMENT_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PAYMENT_SCREENSHOTS_DIR, { recursive: true });
}

// Helper function to delete local file (SAME AS deleteProfileImage)
const deleteLocalFile = (fileUrl) => {
  if (fileUrl) {
    const filePath = path.join(__dirname, '../uploads', fileUrl.split('/uploads')[1]);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted file: ${filePath}`);
      return true;
    }
  }
  return false;
};

// Delete Profile Image (NO CLOUDINARY)
const deleteProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.profileImg && !user.image) {
      return res.status(400).json({ message: 'No profile image to delete' });
    }

    // Get the image URL (handle both field names)
    const imageUrl = user.profileImg || user.image;

    // Delete local image file
    const deleted = deleteLocalFile(imageUrl);
    
    if (deleted) {
      console.log(`✅ Profile image deleted from storage`);
    } else {
      console.log(`⚠️ Image file not found at path, continuing...`);
    }

    // Remove image field from user document
    user.profileImg = undefined;
    user.image = undefined;
    await user.save();

    res.status(200).json({ 
      message: 'Profile image deleted successfully ✅' 
    });

  } catch (error) {
    console.error("Delete profile image error:", error);
    res.status(500).json({ 
      message: 'Failed to delete profile image ❌', 
      error: error.message 
    });
  }
};

// // Capture Vendor Payment — FIXED WITH LOCAL FILE UPLOAD (NO CLOUDINARY)
// exports.captureVendorPayment = async (req, res) => {
//   try {
//     console.log('🔔 [Vendor Payment Capture] Function called');
//     console.log('📦 Request params:', req.params);
//     console.log('📦 Request body:', req.body);
//     console.log('📁 Files:', req.files);

//     const { vendorId } = req.params;
//     const { planId, transactionId, paymentMethod = 'razorpay', bankDetails } = req.body;

//     // 1️⃣ Basic validation
//     if (!vendorId) {
//       console.log('❌ Validation failed: Vendor ID missing');
//       return res.status(400).json({
//         success: false,
//         message: "Vendor ID is required",
//       });
//     }

//     if (!planId) {
//       console.log('❌ Validation failed: planId missing');
//       return res.status(400).json({
//         success: false,
//         message: "planId is required",
//       });
//     }
//     console.log('✅ Basic validation passed');

//     // 2️⃣ Find vendor
//     console.log('🔍 Looking for vendor...', vendorId);
//     const vendor = await Restaurant.findById(vendorId);
//     if (!vendor) {
//       console.log('❌ Vendor not found');
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found",
//       });
//     }
//     console.log('✅ Vendor found:', vendor.restaurantName);

//     // 3️⃣ Find plan
//     console.log('🔍 Looking for plan...', planId);
//     const plan = await VendorPlan.findById(planId);
//     if (!plan) {
//       console.log('❌ Plan not found');
//       return res.status(404).json({
//         success: false,
//         message: "Vendor plan not found",
//       });
//     }
//     console.log('✅ Plan found:', plan.name, 'Price:', plan.price);

//     // 4️⃣ Check payment method
//     if (paymentMethod === 'bank_transfer' || paymentMethod === 'bank') {
//       // Handle bank transfer - screenshot upload ke saath (LOCAL STORAGE)
//       console.log('🏦 Processing bank transfer payment');
      
//       // Parse bank details
//       let bankDetailsData = {};
//       if (bankDetails) {
//         try {
//           if (typeof bankDetails === 'string') {
//             bankDetailsData = JSON.parse(bankDetails);
//           } else if (typeof bankDetails === 'object') {
//             bankDetailsData = bankDetails;
//           }
//         } catch (error) {
//           console.warn('⚠️ Bank details parse error:', error.message);
//         }
//       }
      
//       // Default bank details agar nahi hai
//       if (!bankDetailsData.accountName) {
//         bankDetailsData = {
//           accountName: "VEGIFFY PRIVATE LIMITED",
//           accountNumber: "50200067111965",
//           bankName: "HDFC Bank",
//           ifscCode: "HDFC0001252",
//           branch: "Sector 62, Noida",
//           upiId: "vegiffy@hdfcbank"
//         };
//       }
      
//       console.log('📦 Bank details:', bankDetailsData);

//       // Check for payment screenshot - LOCAL FILE STORAGE
//       let uploadedScreenshotUrl = "";
      
//       if (req.files && req.files.paymentScreenshot) {
//         const paymentScreenshot = req.files.paymentScreenshot;

//         // Validate file type
//         const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/webp'];
//         if (!validImageTypes.includes(paymentScreenshot.mimetype)) {
//           return res.status(400).json({
//             success: false,
//             message: "Invalid file type for payment screenshot. Only JPG, PNG, PDF, WebP allowed.",
//           });
//         }

//         // Validate file size (max 5MB)
//         const maxSize = 5 * 1024 * 1024; // 5MB
//         if (paymentScreenshot.size > maxSize) {
//           return res.status(400).json({
//             success: false,
//             message: "File size too large. Maximum size is 5MB.",
//           });
//         }

//         // Save locally (NO CLOUDINARY)
//         try {
//           console.log('📤 Saving payment screenshot locally...');
          
//           // Create directory if it doesn't exist (already created above but double check)
//           if (!fs.existsSync(PAYMENT_SCREENSHOTS_DIR)) {
//             fs.mkdirSync(PAYMENT_SCREENSHOTS_DIR, { recursive: true });
//           }
          
//           // Generate unique filename
//           const timestamp = Date.now();
//           const fileExtension = path.extname(paymentScreenshot.name) || '.jpg';
//           const filename = `vendor_payment_${vendorId}_${timestamp}${fileExtension}`;
//           const filePath = path.join(PAYMENT_SCREENSHOTS_DIR, filename);
          
//           // Save file
//           if (paymentScreenshot.tempFilePath) {
//             // If file is from temp path (express-fileupload)
//             fs.copyFileSync(paymentScreenshot.tempFilePath, filePath);
//             // Clean up temp file
//             fs.unlinkSync(paymentScreenshot.tempFilePath);
//           } else if (paymentScreenshot.data) {
//             // If file is from buffer (multer)
//             fs.writeFileSync(filePath, paymentScreenshot.data);
//           } else if (paymentScreenshot.path) {
//             // If file has direct path
//             fs.copyFileSync(paymentScreenshot.path, filePath);
//           }
          
//           // Create URL for the saved file
//           uploadedScreenshotUrl = `/uploads/vendors/payment_screenshots/${filename}`;
//           console.log('✅ File saved locally:', uploadedScreenshotUrl);
//           console.log('📁 File path:', filePath);
//         } catch (uploadError) {
//           console.error('❌ Local file save error:', uploadError);
//           // Continue without screenshot, don't block payment
//           console.log('⚠️ Continuing without screenshot upload');
//         }
//       } else {
//         console.log('⚠️ No payment screenshot provided');
//       }
      
//       // Calculate GST
//       const baseAmount = plan.price;
//       const gstRate = 18;
//       const gstAmount = (baseAmount * gstRate) / 100;
//       const totalAmount = baseAmount + gstAmount;
      
//       // Generate a transaction ID for bank payment
//       const bankTransactionId = `BANK_${Date.now()}_${vendor.restaurantName.replace(/\s+/g, '_')}`;
      
//       // Prepare dates
//       const purchaseDate = new Date();
//       const expiryDate = new Date(
//         purchaseDate.getTime() + plan.validity * 24 * 60 * 60 * 1000
//       );
      
//       // Save payment - Ambassador ke jaise fields add kiye
//       const payment = new VendorPayment({
//         vendorId,
//         planId,
//         transactionId: bankTransactionId,
//         paymentMethod: 'bank_transfer',
//         isPurchased: true,
//         planPurchaseDate: purchaseDate,
//         expiryDate: expiryDate,
//         amount: baseAmount,
//         gstAmount: gstAmount,
//         totalAmount: totalAmount,
//         status: "pending_verification",
//         verificationNotes: uploadedScreenshotUrl ? 
//           "Payment screenshot uploaded, awaiting admin verification" : 
//           "Bank payment submitted, awaiting admin verification",
//         submittedAt: purchaseDate,
//         verifiedAt: null,
//         verifiedBy: null,
//         bankDetails: bankDetailsData,
//         paymentScreenshot: uploadedScreenshotUrl, // ✅ Local file URL
//         screenshotUploadedAt: uploadedScreenshotUrl ? purchaseDate : null,
//         isActive: false
//       });

//       await payment.save();
//       console.log('✅ Bank payment saved with screenshot option');

//       // Update restaurant with plan but status pending
//       await Restaurant.findByIdAndUpdate(
//         vendorId,
//         {
//           currentPlan: planId,
//           planExpiry: expiryDate,
//           planStatus: "pending_verification",
//           planPurchaseDate: purchaseDate,
//           isPlanActive: false,
//           $push: {
//             myPlans: {
//               planId: planId,
//               purchaseDate: purchaseDate,
//               expiryDate: expiryDate,
//               isPurchased: true,
//               status: "pending_verification",
//               transactionId: bankTransactionId,
//               paymentMethod: 'bank_transfer',
//               bankDetails: bankDetailsData,
//               paymentScreenshot: uploadedScreenshotUrl, // ✅ Local file URL
//               screenshotUploadedAt: uploadedScreenshotUrl ? purchaseDate : null
//             },
//           },
//         },
//         { new: true }
//       );
//       console.log('✅ Restaurant updated with plan (pending verification)');

//       // Response for bank payment
//       return res.status(200).json({
//         success: true,
//         message: uploadedScreenshotUrl ? 
//           "Bank payment submitted with screenshot. Plan will activate after verification." : 
//           "Bank payment submitted. Plan will activate after verification.",
//         data: {
//           payment: {
//             id: payment._id,
//             transactionId: payment.transactionId,
//             status: payment.status,
//             isPurchased: payment.isPurchased,
//             planPurchaseDate: payment.planPurchaseDate,
//             expiryDate: payment.expiryDate,
//             submittedAt: payment.submittedAt,
//             verificationStatus: "pending",
//             bankDetails: payment.bankDetails,
//             paymentScreenshot: payment.paymentScreenshot // ✅ Local file URL
//           },
//           vendor: {
//             id: vendor._id,
//             restaurantName: vendor.restaurantName,
//           },
//           plan: {
//             id: plan._id,
//             name: plan.name,
//             price: plan.price,
//             validity: plan.validity,
//           },
//           verification: {
//             estimatedTime: "1-2 hours",
//             contactEmail: "vendor@vegiffy.in",
//             screenshotUploaded: !!uploadedScreenshotUrl
//           }
//         },
//       });

//     } else {
//       // Handle Razorpay/UPI payment - auto complete
//       console.log('💳 Processing Razorpay/UPI payment...', transactionId);
      
//       if (!transactionId) {
//         return res.status(400).json({
//           success: false,
//           message: "transactionId is required for Razorpay/UPI payments",
//         });
//       }
      
//       try {
//         const paymentDetails = await razorpay.payments.fetch(transactionId);
//         console.log('✅ Razorpay payment details:', {
//           id: paymentDetails.id,
//           amount: paymentDetails.amount,
//           currency: paymentDetails.currency,
//           status: paymentDetails.status,
//           captured: paymentDetails.captured
//         });

//         if (paymentDetails.captured) {
//           console.log('⚠️ Payment already captured');
//           return res.status(400).json({
//             success: false,
//             message: "Payment already captured",
//             data: { paymentId: paymentDetails.id }
//           });
//         }

//         // Capture payment
//         const authorizedAmount = paymentDetails.amount;
//         const capturedPayment = await razorpay.payments.capture(
//           transactionId,
//           authorizedAmount,
//           "INR"
//         );

//         console.log('✅ Payment captured successfully:', {
//           id: capturedPayment.id,
//           amount: capturedPayment.amount,
//           status: capturedPayment.status,
//         });

//         // Calculate GST
//         const baseAmount = plan.price;
//         const gstRate = 18;
//         const gstAmount = (baseAmount * gstRate) / 100;
//         const totalAmountInINR = authorizedAmount / 100;

//         // Prepare dates
//         const purchaseDate = new Date();
//         const expiryDate = new Date(
//           purchaseDate.getTime() + plan.validity * 24 * 60 * 60 * 1000
//         );

//         // Save payment
//         let payment = await VendorPayment.findOne({ vendorId, planId });
        
//         const paymentData = {
//           vendorId,
//           planId,
//           transactionId,
//           razorpayPaymentId: capturedPayment.id,
//           paymentMethod: paymentMethod,
//           isPurchased: true,
//           planPurchaseDate: purchaseDate,
//           expiryDate,
//           amount: baseAmount,
//           gstAmount: gstAmount,
//           totalAmount: totalAmountInINR,
//           razorpayAmount: authorizedAmount,
//           status: "completed",
//           verifiedAt: purchaseDate,
//           verifiedBy: "system",
//           isActive: true
//         };

//         if (!payment) {
//           payment = new VendorPayment(paymentData);
//         } else {
//           Object.assign(payment, paymentData);
//         }

//         await payment.save();
//         console.log('✅ Payment record saved');

//         // Update restaurant - Active status
//         await Restaurant.findByIdAndUpdate(
//           vendorId,
//           {
//             currentPlan: planId,
//             planExpiry: expiryDate,
//             planStatus: "active",
//             planPurchaseDate: purchaseDate,
//             isPlanActive: true,
//             $push: {
//               myPlans: {
//                 planId: planId,
//                 purchaseDate: purchaseDate,
//                 expiryDate: expiryDate,
//                 isPurchased: true,
//                 status: "active",
//                 transactionId: transactionId,
//                 paymentMethod: paymentMethod,
//                 isActive: true
//               },
//             },
//           },
//           { new: true }
//         );
//         console.log('✅ Restaurant updated with active plan');

//         // Final response for Razorpay
//         return res.status(200).json({
//           success: true,
//           message: "Payment captured successfully, vendor plan activated",
//           data: {
//             payment: {
//               id: payment._id,
//               transactionId: payment.transactionId,
//               baseAmount: payment.amount,
//               gstAmount: payment.gstAmount,
//               totalAmount: payment.totalAmount,
//               status: payment.status,
//               isPurchased: payment.isPurchased,
//               purchaseDate: payment.planPurchaseDate,
//               expiryDate: payment.expiryDate,
//               isActive: payment.isActive
//             },
//             vendor: {
//               id: vendor._id,
//               restaurantName: vendor.restaurantName,
//             },
//             plan: {
//               id: plan._id,
//               name: plan.name,
//               price: plan.price,
//               validity: plan.validity,
//             },
//           },
//         });

//       } catch (razorpayError) {
//         console.error('❌ Razorpay API Error:', razorpayError);
        
//         if (razorpayError.error && razorpayError.error.description) {
//           return res.status(400).json({
//             success: false,
//             message: `Payment capture failed: ${razorpayError.error.description}`,
//           });
//         }
        
//         throw razorpayError;
//       }
//     }

//   } catch (err) {
//     console.error("❌ Error capturing vendor payment:", err);
    
//     let statusCode = 500;
//     let errorMessage = "Server error while capturing payment";
    
//     if (err.name === 'ValidationError') {
//       statusCode = 400;
//       errorMessage = "Validation error: " + err.message;
//     }
    
//     if (err.statusCode) {
//       statusCode = err.statusCode;
//     }

//     return res.status(statusCode).json({
//       success: false,
//       message: errorMessage,
//       error: err.message || err.toString(),
//     });
//   }
// };



// Capture Vendor Payment — FIXED WITH LOCAL FILE UPLOAD (NO CLOUDINARY)
exports.captureVendorPayment = async (req, res) => {
  try {
    console.log('🔔 [Vendor Payment Capture] Function called');
    console.log('📦 Request params:', req.params);
    console.log('📦 Request body:', req.body);
    console.log('📁 Files:', req.files);

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

    // ------------------------------------------------------------------
    // ✅ NEW: Check if vendor already has an active subscription for this plan
    // ------------------------------------------------------------------
    const existingActivePayment = await VendorPayment.findOne({
      vendorId: vendorId,
      planId: planId,
      status: { $in: ['completed', 'active'] },   // active/completed plan
      expiryDate: { $gt: new Date() }             // still valid
    });

    if (existingActivePayment) {
      const expiryDateFormatted = existingActivePayment.expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      console.log(`⚠️ Vendor already has an active plan (ID: ${planId}) expiring on ${expiryDateFormatted}`);
      return res.status(400).json({
        success: false,
        message: `You already have an active subscription to the "${plan.name}" plan. It expires on ${expiryDateFormatted}. You cannot purchase the same plan again until it expires.`
      });
    }
    // ------------------------------------------------------------------

    // 4️⃣ Check payment method
    if (paymentMethod === 'bank_transfer' || paymentMethod === 'bank') {
      // Handle bank transfer - screenshot upload ke saath (LOCAL STORAGE)
      console.log('🏦 Processing bank transfer payment');
      
      // Parse bank details
      let bankDetailsData = {};
      if (bankDetails) {
        try {
          if (typeof bankDetails === 'string') {
            bankDetailsData = JSON.parse(bankDetails);
          } else if (typeof bankDetails === 'object') {
            bankDetailsData = bankDetails;
          }
        } catch (error) {
          console.warn('⚠️ Bank details parse error:', error.message);
        }
      }
      
      // Default bank details agar nahi hai
      if (!bankDetailsData.accountName) {
        bankDetailsData = {
          accountName: "VEGIFFY PRIVATE LIMITED",
          accountNumber: "50200067111965",
          bankName: "HDFC Bank",
          ifscCode: "HDFC0001252",
          branch: "Sector 62, Noida",
          upiId: "vegiffy@hdfcbank"
        };
      }
      
      console.log('📦 Bank details:', bankDetailsData);

      // Check for payment screenshot - LOCAL FILE STORAGE
      let uploadedScreenshotUrl = "";
      
      if (req.files && req.files.paymentScreenshot) {
        const paymentScreenshot = req.files.paymentScreenshot;

        // Validate file type
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/webp'];
        if (!validImageTypes.includes(paymentScreenshot.mimetype)) {
          return res.status(400).json({
            success: false,
            message: "Invalid file type for payment screenshot. Only JPG, PNG, PDF, WebP allowed.",
          });
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (paymentScreenshot.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: "File size too large. Maximum size is 5MB.",
          });
        }

        // Save locally (NO CLOUDINARY)
        try {
          console.log('📤 Saving payment screenshot locally...');
          
          // Create directory if it doesn't exist (already created above but double check)
          if (!fs.existsSync(PAYMENT_SCREENSHOTS_DIR)) {
            fs.mkdirSync(PAYMENT_SCREENSHOTS_DIR, { recursive: true });
          }
          
          // Generate unique filename
          const timestamp = Date.now();
          const fileExtension = path.extname(paymentScreenshot.name) || '.jpg';
          const filename = `vendor_payment_${vendorId}_${timestamp}${fileExtension}`;
          const filePath = path.join(PAYMENT_SCREENSHOTS_DIR, filename);
          
          // Save file
          if (paymentScreenshot.tempFilePath) {
            // If file is from temp path (express-fileupload)
            fs.copyFileSync(paymentScreenshot.tempFilePath, filePath);
            // Clean up temp file
            fs.unlinkSync(paymentScreenshot.tempFilePath);
          } else if (paymentScreenshot.data) {
            // If file is from buffer (multer)
            fs.writeFileSync(filePath, paymentScreenshot.data);
          } else if (paymentScreenshot.path) {
            // If file has direct path
            fs.copyFileSync(paymentScreenshot.path, filePath);
          }
          
          // Create URL for the saved file
          uploadedScreenshotUrl = `/uploads/vendors/payment_screenshots/${filename}`;
          console.log('✅ File saved locally:', uploadedScreenshotUrl);
          console.log('📁 File path:', filePath);
        } catch (uploadError) {
          console.error('❌ Local file save error:', uploadError);
          // Continue without screenshot, don't block payment
          console.log('⚠️ Continuing without screenshot upload');
        }
      } else {
        console.log('⚠️ No payment screenshot provided');
      }
      
      // Calculate GST
      const baseAmount = plan.price;
      const gstRate = 18;
      const gstAmount = (baseAmount * gstRate) / 100;
      const totalAmount = baseAmount + gstAmount;
      
      // Generate a transaction ID for bank payment
      const bankTransactionId = `BANK_${Date.now()}_${vendor.restaurantName.replace(/\s+/g, '_')}`;
      
      // Prepare dates
      const purchaseDate = new Date();
      const expiryDate = new Date(
        purchaseDate.getTime() + plan.validity * 24 * 60 * 60 * 1000
      );
      
      // Save payment - Ambassador ke jaise fields add kiye
      const payment = new VendorPayment({
        vendorId,
        planId,
        transactionId: bankTransactionId,
        paymentMethod: 'bank_transfer',
        isPurchased: true,
        planPurchaseDate: purchaseDate,
        expiryDate: expiryDate,
        amount: baseAmount,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        status: "pending_verification",
        verificationNotes: uploadedScreenshotUrl ? 
          "Payment screenshot uploaded, awaiting admin verification" : 
          "Bank payment submitted, awaiting admin verification",
        submittedAt: purchaseDate,
        verifiedAt: null,
        verifiedBy: null,
        bankDetails: bankDetailsData,
        paymentScreenshot: uploadedScreenshotUrl, // ✅ Local file URL
        screenshotUploadedAt: uploadedScreenshotUrl ? purchaseDate : null,
        isActive: false
      });

      await payment.save();
      console.log('✅ Bank payment saved with screenshot option');

      // Update restaurant with plan but status pending
      await Restaurant.findByIdAndUpdate(
        vendorId,
        {
          currentPlan: planId,
          planExpiry: expiryDate,
          planStatus: "pending_verification",
          planPurchaseDate: purchaseDate,
          isPlanActive: false,
          $push: {
            myPlans: {
              planId: planId,
              purchaseDate: purchaseDate,
              expiryDate: expiryDate,
              isPurchased: true,
              status: "pending_verification",
              transactionId: bankTransactionId,
              paymentMethod: 'bank_transfer',
              bankDetails: bankDetailsData,
              paymentScreenshot: uploadedScreenshotUrl, // ✅ Local file URL
              screenshotUploadedAt: uploadedScreenshotUrl ? purchaseDate : null
            },
          },
        },
        { new: true }
      );
      console.log('✅ Restaurant updated with plan (pending verification)');

      // Response for bank payment
      return res.status(200).json({
        success: true,
        message: uploadedScreenshotUrl ? 
          "Bank payment submitted with screenshot. Plan will activate after verification." : 
          "Bank payment submitted. Plan will activate after verification.",
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
            bankDetails: payment.bankDetails,
            paymentScreenshot: payment.paymentScreenshot // ✅ Local file URL
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
            contactEmail: "vendor@vegiffy.in",
            screenshotUploaded: !!uploadedScreenshotUrl
          }
        },
      });

    } else {
      // Handle Razorpay/UPI payment - auto complete
      console.log('💳 Processing Razorpay/UPI payment...', transactionId);
      
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
          status: "completed",
          verifiedAt: purchaseDate,
          verifiedBy: "system",
          isActive: true
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
            planStatus: "active",
            planPurchaseDate: purchaseDate,
            isPlanActive: true,
            $push: {
              myPlans: {
                planId: planId,
                purchaseDate: purchaseDate,
                expiryDate: expiryDate,
                isPurchased: true,
                status: "active",
                transactionId: transactionId,
                paymentMethod: paymentMethod,
                isActive: true
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
              isActive: payment.isActive
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
    const { status, subAdminId } = req.body || {}; // ✅ subAdminId optional

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

    /* ---------------- FIND PAYMENT ---------------- */
    const payment = await VendorPayment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Vendor payment not found",
      });
    }

    /* ---------------- CREATOR INFO ---------------- */
    let note = "Updated by Admin";
    let updatedBy = null;

    if (subAdminId) {
      const subAdmin = await SubAdmin.findById(subAdminId);
      if (!subAdmin) {
        return res.status(404).json({
          success: false,
          message: "Sub-admin not found",
        });
      }

      note = `Updated by Sub-admin: ${subAdmin.name}`;
      updatedBy = subAdminId;
    }

    /* ---------------- UPDATE PAYMENT ---------------- */
    payment.status = status;
    payment.note = note;
    payment.updatedBy = updatedBy;

    if (status === "completed" || status === "verified") {
      payment.verifiedAt = new Date();
      payment.verifiedBy = subAdminId ? "sub-admin" : "admin";
    }

    await payment.save();

    /* ---------------- FIND VENDOR ---------------- */
    const vendor = await Restaurant.findById(payment.vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    /* ---------------- UPDATE VENDOR PLAN ---------------- */
    let vendorPlanStatus = vendor.planStatus;
    let isPlanActive = vendor.isPlanActive;

    if (status === "completed" || status === "verified") {
      vendorPlanStatus = "active";
      isPlanActive = true;
    } else if (status === "rejected") {
      vendorPlanStatus = "rejected";
      isPlanActive = false;
    }

    await Restaurant.findByIdAndUpdate(vendor._id, {
      planStatus: vendorPlanStatus,
      isPlanActive,
    });

    /* ---------------- SEND EMAIL ---------------- */
    const subject = `Payment Status Update - ${status.toUpperCase()}`;

    const html = `
      <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; padding:25px; border-radius:8px;">
          <h2 style="color:#2e7d32; text-align:center;">
            🎉 Congratulations ${vendor.restaurantName}!
          </h2>

          <p>Your payment has been <strong>${status}</strong>.</p>

          <p>
            Plan Status:
            <strong>${vendorPlanStatus.toUpperCase()}</strong>
          </p>

          <p style="margin-top:20px;">
            Updated by: <strong>${subAdminId ? "Sub-admin" : "Admin"}</strong>
          </p>

          <p style="margin-top:30px;">
            Regards,<br/>
            <strong>Vegiffy Team</strong>
          </p>
        </div>
      </div>
    `;

    if (vendor.email) {
      await sendEmail(vendor.email, subject, html);
    }

    /* ---------------- RESPONSE ---------------- */
    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: {
        paymentId: payment._id,
        status: payment.status,
        note: payment.note,
        updatedBy: subAdminId ? "sub-admin" : "admin",
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


// Get Vendor Payment Details by Vendor ID (ONLY COMPLETED)
exports.getVendorPaymentDetails = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    // ✅ Sirf completed status wala record
    const paymentDetails = await VendorPayment.findOne({
      vendorId,
      status: "completed",
      isPurchased: true
    });

    if (!paymentDetails) {
      return res.status(404).json({
        success: false,
        message: "No completed payment found for this vendor",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor completed payment details fetched successfully",
      data: paymentDetails,
    });

  } catch (err) {
    console.error("❌ Error fetching vendor payment details:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor payment details",
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



exports.deleteRestaurantNotifications = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "notificationIds array is required in body",
      });
    }

    // Validate vendor exists
    const restaurant = await Restaurant.findById(vendorId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Filter out notifications which are NOT in notificationIds
    restaurant.notifications = restaurant.notifications.filter(
      notif => !notificationIds.includes(notif._id.toString())
    );

    // Save updated restaurant
    await restaurant.save();

    res.json({
      success: true,
      message: `${notificationIds.length} notification${notificationIds.length === 1 ? '' : 's'} deleted successfully`,
      data: restaurant.notifications,
    });

  } catch (error) {
    console.error("Delete notifications error:", error);
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



// Create Reel with all fields
exports.createReel = async (req, res) => {
  try {
    console.log('🎥 [Reel Upload] Function called');
    console.log('📦 Params:', req.params);
    console.log('📁 Files:', req.files);
    console.log('📝 Body:', req.body);

    const { vendorId } = req.params;
    const { title, description, deepLink, isHot, status } = req.body;

    // 1️⃣ Vendor ID check
    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID chahiye"
      });
    }

    // 2️⃣ File check - video zaroori hai
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: "Video file bhejna zaroori hai"
      });
    }

    const videoFile = req.files.video;

    // 3️⃣ Validate video file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp'];
    if (!validTypes.includes(videoFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Sirf video files allowed hain (MP4, MOV, AVI, WEBM, 3GP)"
      });
    }

    // 4️⃣ Validate video file size (100MB)
    if (videoFile.size > 100 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Video size 100MB se kam hona chahiye"
      });
    }

    // 5️⃣ Vendor exist karta hai?
    const vendor = await Restaurant.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor nahi mila"
      });
    }

    // 6️⃣ Make sure uploads/reels folder exists
    const reelsDir = path.join(__dirname, '../uploads/reels');
    if (!fs.existsSync(reelsDir)) {
      fs.mkdirSync(reelsDir, { recursive: true });
    }

    // 7️⃣ Unique filename for video
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const videoExt = path.extname(videoFile.name);
    const videoFilename = `reel_video_${vendorId}_${uniqueSuffix}${videoExt}`;
    const videoPath = path.join(reelsDir, videoFilename);

    // 8️⃣ Save video file
    await videoFile.mv(videoPath);
    console.log('✅ Video saved:', videoPath);

    // 9️⃣ Handle thumbnail if uploaded
    let thumbFilename = '';
    let thumbUrl = '';
    
    if (req.files && req.files.thumbnail) {
      const thumbFile = req.files.thumbnail;
      
      // Validate thumbnail image type
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (validImageTypes.includes(thumbFile.mimetype)) {
        
        // Validate thumbnail size (5MB)
        if (thumbFile.size <= 5 * 1024 * 1024) {
          const thumbExt = path.extname(thumbFile.name);
          thumbFilename = `reel_thumb_${vendorId}_${uniqueSuffix}${thumbExt}`;
          const thumbPath = path.join(reelsDir, thumbFilename);
          
          await thumbFile.mv(thumbPath);
          console.log('✅ Thumbnail saved:', thumbPath);
        }
      }
    }

    // 🔟 Generate URLs
    const baseUrl = 'https://api.vegiffy.in';
    const videoUrl = `${baseUrl}/uploads/reels/${videoFilename}`;
    thumbUrl = thumbFilename ? `${baseUrl}/uploads/reels/${thumbFilename}` : '';

    // 1️⃣1️⃣ Create Reel in database
    const reelData = {
      vendorId,
      videoUrl,
      thumbUrl,
      title: title || '',
      description: description || '',
      deepLink: deepLink || '',
  status: 'pending', // ✅ default pending
      isHot: isHot === 'true' || isHot === true
    };

    const reel = new Reel(reelData);
    await reel.save();

    // 1️⃣2️⃣ Also save reference in vendor (optional)
    if (!vendor.reels) {
      vendor.reels = [];
    }
    
    vendor.reels.push({
      reelId: reel._id,
      videoUrl,
      uploadedAt: new Date()
    });
    
    await vendor.save();

    // 1️⃣3️⃣ Success response
    return res.status(201).json({
      success: true,
      message: "Reel create ho gayi",
      data: reel
    });

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({
      success: false,
      message: "Kuch gadbad ho gayi",
      error: err.message
    });
  }
};



exports.updateReel = async (req, res) => {
  try {
    console.log("🎥 [Reel Update] Function called");

    const { reelId } = req.params;
    const { title, description, deepLink, isHot, status } = req.body;

    if (!reelId) {
      return res.status(400).json({
        success: false,
        message: "Reel ID required"
      });
    }

    // 1️⃣ Find reel
    const reel = await Reel.findById(reelId);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found"
      });
    }

    const reelsDir = path.join(__dirname, "../uploads/reels");

    // 2️⃣ Update video (optional)
    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      const validTypes = [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
        "video/3gpp"
      ];

      if (!validTypes.includes(videoFile.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Invalid video format"
        });
      }

      if (videoFile.size > 100 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: "Video must be under 100MB"
        });
      }

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const videoExt = path.extname(videoFile.name);
      const videoFilename = `reel_video_${reel.vendorId}_${uniqueSuffix}${videoExt}`;
      const videoPath = path.join(reelsDir, videoFilename);

      await videoFile.mv(videoPath);

      const baseUrl = "https://api.vegiffy.in";
      reel.videoUrl = `${baseUrl}/uploads/reels/${videoFilename}`;
    }

    // 3️⃣ Update thumbnail (optional)
    if (req.files && req.files.thumbnail) {
      const thumbFile = req.files.thumbnail;

      const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

      if (validImageTypes.includes(thumbFile.mimetype) && thumbFile.size <= 5 * 1024 * 1024) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const thumbExt = path.extname(thumbFile.name);
        const thumbFilename = `reel_thumb_${reel.vendorId}_${uniqueSuffix}${thumbExt}`;
        const thumbPath = path.join(reelsDir, thumbFilename);

        await thumbFile.mv(thumbPath);

        const baseUrl = "https://api.vegiffy.in";
        reel.thumbUrl = `${baseUrl}/uploads/reels/${thumbFilename}`;
      }
    }

    // 4️⃣ Update text fields
    if (title !== undefined) reel.title = title;
    if (description !== undefined) reel.description = description;
    if (deepLink !== undefined) reel.deepLink = deepLink;
    if (isHot !== undefined) reel.isHot = isHot === "true" || isHot === true;
    if (status !== undefined) reel.status = status;

    // 5️⃣ Save updated reel
    await reel.save();

    return res.status(200).json({
      success: true,
      message: "Reel updated successfully",
      data: reel
    });

  } catch (err) {
    console.error("❌ Reel Update Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


// Create Reel for Admin
exports.createAdminReel = async (req, res) => {
  try {
    console.log('🎥 [Admin Reel Upload] Function called');
    console.log('📦 Params:', req.params);
    console.log('📁 Files:', req.files);
    console.log('📝 Body:', req.body);

    const { adminId } = req.params;
    const { title, description, deepLink, isHot, status } = req.body;

    // 1️⃣ Admin ID check
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID chahiye"
      });
    }

    // 2️⃣ File check - video zaroori hai
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: "Video file bhejna zaroori hai"
      });
    }

    const videoFile = req.files.video;

    // 3️⃣ Validate video file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp'];
    if (!validTypes.includes(videoFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Sirf video files allowed hain (MP4, MOV, AVI, WEBM, 3GP)"
      });
    }

    // 4️⃣ Validate video file size (100MB)
    if (videoFile.size > 100 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Video size 100MB se kam hona chahiye"
      });
    }

    // 5️⃣ Admin exist karta hai?
    const admin = await adminModel.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin nahi mila"
      });
    }

    // 6️⃣ uploads/reels folder check
    const reelsDir = path.join(__dirname, '../uploads/reels');
    if (!fs.existsSync(reelsDir)) {
      fs.mkdirSync(reelsDir, { recursive: true });
    }

    // 7️⃣ Unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const videoExt = path.extname(videoFile.name);
    const videoFilename = `admin_reel_video_${adminId}_${uniqueSuffix}${videoExt}`;
    const videoPath = path.join(reelsDir, videoFilename);

    // 8️⃣ Save video
    await videoFile.mv(videoPath);
    console.log('✅ Video saved:', videoPath);

    // 9️⃣ Thumbnail handle
    let thumbFilename = '';
    let thumbUrl = '';

    if (req.files && req.files.thumbnail) {
      const thumbFile = req.files.thumbnail;

      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (validImageTypes.includes(thumbFile.mimetype)) {

        if (thumbFile.size <= 5 * 1024 * 1024) {
          const thumbExt = path.extname(thumbFile.name);
          thumbFilename = `admin_reel_thumb_${adminId}_${uniqueSuffix}${thumbExt}`;
          const thumbPath = path.join(reelsDir, thumbFilename);

          await thumbFile.mv(thumbPath);
          console.log('✅ Thumbnail saved:', thumbPath);
        }
      }
    }

    // 🔟 Generate URLs
    const baseUrl = 'https://api.vegiffy.in';
    const videoUrl = `${baseUrl}/uploads/reels/${videoFilename}`;
    thumbUrl = thumbFilename ? `${baseUrl}/uploads/reels/${thumbFilename}` : '';

    // 1️⃣1️⃣ Create Reel
    const reelData = {
      adminId,
      videoUrl,
      thumbUrl,
      title: title || '',
      description: description || '',
      deepLink: deepLink || '',
      status:'pending',
      isHot: isHot === 'true' || isHot === true
    };

    const reel = new Reel(reelData);
    await reel.save();

    // 1️⃣2️⃣ Save reference in admin (optional)
    if (!admin.reels) {
      admin.reels = [];
    }

    admin.reels.push({
      reelId: reel._id,
      videoUrl,
      uploadedAt: new Date()
    });

    await admin.save();

    // 1️⃣3️⃣ Response
    return res.status(201).json({
      success: true,
      message: "Admin reel create ho gayi",
      data: reel
    });

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({
      success: false,
      message: "Kuch gadbad ho gayi",
      error: err.message
    });
  }
};

// ------------------------
// GET All Reels
// ------------------------
// Get all reels with populated vendor details
exports.getAllReels = async function (req, res) {
  try {
    const reels = await Reel.find({ status: "active" }) // ✅ yahi add kiya
      .populate({
        path: 'vendorId',
        select: 'restaurantName logo' // Sirf restaurantName aur logo chahiye
      })
      .sort({ createdAt: -1 });

    // Transform data to match required format
    const formattedReels = reels.map(reel => {
      const reelObj = reel.toObject();
      
      return {
        _id: reelObj._id,
        videoUrl: reelObj.videoUrl,
        thumbUrl: reelObj.thumbUrl || '',
        title: reelObj.title || '',
        description: reelObj.description || '',
        restaurantName: reelObj.vendorId?.restaurantName || 'Unknown Restaurant',
        restaurantId: reelObj.vendorId?._id || reelObj.vendorId,
        deepLink: reelObj.deepLink || '',
        createdAt: reelObj.createdAt,
        updatedAt: reelObj.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      message: "Reels fetched successfully",
      data: formattedReels,
    });

  } catch (error) {
    console.error("Error fetching reels:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ------------------------
// GET Reels by Vendor ID
// ------------------------
exports.getReelsByVendor = async function (req, res) {
  try {
    const vendorId = req.params.vendorId;
    if (!vendorId) {
      return res.status(400).json({ success: false, message: "vendorId is required" });
    }

    const reels = await Reel.find({ vendorId }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "Vendor reels fetched successfully",
      data: reels,
    });
  } catch (error) {
    console.error("Error fetching vendor reels:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ------------------------
// UPDATE Reel by ID
// ------------------------
// ==================== UPDATE REEL ====================
exports.updateReel = async (req, res) => {
  try {
    console.log('✏️ [UPDATE] Function called');
    console.log('📦 Params:', req.params);
    console.log('📝 Body:', req.body);
    console.log('📁 Files:', req.files);

    const { reelId } = req.params;
    const { title, description, deepLink, isHot, status } = req.body;

    // 1️⃣ Reel exist karti hai?
    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel nahi mili"
      });
    }

    // 2️⃣ Update fields (jo bheja hai wahi update karo)
    if (title !== undefined) reel.title = title;
    if (description !== undefined) reel.description = description;
    if (deepLink !== undefined) reel.deepLink = deepLink;
    if (status !== undefined) reel.status = status;
    if (isHot !== undefined) reel.isHot = isHot === 'true' || isHot === true;

    // 3️⃣ Agar naya thumbnail upload kiya hai to
    if (req.files && req.files.thumbnail) {
      const thumbFile = req.files.thumbnail;
      
      // Validate thumbnail
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (validImageTypes.includes(thumbFile.mimetype)) {
        
        if (thumbFile.size <= 5 * 1024 * 1024) {
          // Purana thumbnail delete karo
          if (reel.thumbUrl) {
            const oldThumbPath = path.join(__dirname, '../uploads/reels', path.basename(reel.thumbUrl));
            if (fs.existsSync(oldThumbPath)) {
              fs.unlinkSync(oldThumbPath);
              console.log('✅ Old thumbnail deleted');
            }
          }

          // Naya thumbnail save karo
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const thumbExt = path.extname(thumbFile.name);
          const thumbFilename = `reel_thumb_${reel.vendorId}_${uniqueSuffix}${thumbExt}`;
          const thumbPath = path.join(__dirname, '../uploads/reels', thumbFilename);
          
          await thumbFile.mv(thumbPath);
          
          const baseUrl = 'https://api.vegiffy.in';
          reel.thumbUrl = `${baseUrl}/uploads/reels/${thumbFilename}`;
          console.log('✅ New thumbnail saved:', thumbFilename);
        }
      }
    }

    // 4️⃣ Save karo
    await reel.save();
    console.log('✅ Reel updated:', reel._id);

    return res.status(200).json({
      success: true,
      message: "Reel update ho gayi",
      data: reel
    });

  } catch (err) {
    console.error("❌ Update Error:", err);
    return res.status(500).json({
      success: false,
      message: "Kuch gadbad ho gayi",
      error: err.message
    });
  }
};
// ------------------------
// DELETE Reel by ID
// ------------------------
exports.deleteReel = async function (req, res) {
  try {
    const reelId = req.params.reelId;
    if (!reelId) {
      return res.status(400).json({ success: false, message: "reelId is required" });
    }

    const reel = await Reel.findByIdAndDelete(reelId);
    if (!reel) return res.status(404).json({ success: false, message: "Reel not found" });

    res.status(200).json({
      success: true,
      message: "Reel deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reel:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getAllReelsAdmin = async function (req, res) {
  try {
    const reels = await Reel.find()
      .populate({
        path: 'vendorId',
        select: 'restaurantName' // ✅ sirf ye field (id by default aata hai)
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "All reels fetched (Admin)",
      data: reels, // ✅ full reels + limited vendor
    });

  } catch (error) {
    console.error("Error fetching reels (Admin):", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};