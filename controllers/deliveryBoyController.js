const { DeliveryBoy, DeliveryAssignment } = require("../models/deliveryBoyModel");
const Restaurant = require("../models/restaurantModel");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const cloudinary = require("../config/cloudinary");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const notificationModel = require("../models/notificationModel");
const Withdrawal = require("../models/Withdrawal");


// Haversine formula
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Temporary OTP
const OTP = "1234";

// Step 1: Register Delivery Boy (store in token)
exports.registerDeliveryBoy = async (req, res) => {
  try {
    const { fullName, mobileNumber, vehicleType, email } = req.body;
    const aadharCard = req.files.aadharCard;
    const drivingLicense = req.files.drivingLicense;
    const profileImage = req.files.profileImage;  // Get the profile image from request files

    // Check if all required fields are provided
    if (!fullName || !mobileNumber || !vehicleType || !aadharCard || !drivingLicense || !profileImage) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    // Check if the mobile number is already registered
    const existingUser = await DeliveryBoy.findOne({ mobileNumber });
    if (existingUser) {
      return res.status(400).json({ message: "Mobile Number already registered." });
    }

    // Upload the documents and profile image to Cloudinary
    const aadharUpload = await cloudinary.uploader.upload(aadharCard.tempFilePath);
    const licenseUpload = await cloudinary.uploader.upload(drivingLicense.tempFilePath);
    const profileImageUpload = await cloudinary.uploader.upload(profileImage.tempFilePath); // Upload profile image

    // Prepare the token data with document status, delivery boy status, and profile image URL
    const tokenData = {
      fullName,
      mobileNumber,
      vehicleType,
      aadharCard: aadharUpload.secure_url,  // Cloudinary URL for Aadhar Card
      drivingLicense: licenseUpload.secure_url,  // Cloudinary URL for Driving License
      profileImage: profileImageUpload.secure_url, // Cloudinary URL for Profile Image
      documentStatus: {
        aadharCard: "pending",  // Default status for Aadhar Card
        drivingLicense: "pending"  // Default status for Driving License
      },
      deliveryBoyStatus: "pending", // Default delivery boy status
    };

    // Add email to token data if provided
    if (email) tokenData.email = email;

    // Save the DeliveryBoy data into the database
    const newDeliveryBoy = new DeliveryBoy(tokenData);
    await newDeliveryBoy.save();

    // Create a notification for the delivery boy registration
    const notificationMessage = `${fullName} has been successfully registered as a delivery boy.`;
    const notificationData = {
      deliveryBoyId: newDeliveryBoy._id,  // Now referring to deliveryBoyId instead of userId
      message: notificationMessage,
      notificationType: 'DeliveryBoyRegistration'
    };

    const newNotification = new notificationModel(notificationData);
    await newNotification.save();  // Save the notification to the database

    // Create a token for the registered delivery boy (used for verification)
    const token = jwt.sign(tokenData, "temporarySecret", { expiresIn: "5m" }); // 5-minute validity

    // Respond with the full data and the token
    res.status(201).json({
      message: "Delivery Boy registered successfully!",
      data: newDeliveryBoy, // Return the saved data
      token: token // Provide the JWT token for further verification
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



// Update Delivery Boy (Full Name and Email)
exports.updateDeliveryBoy = async (req, res) => {
  try {
    // Extract deliveryBoyId from the URL params
    const { deliveryBoyId } = req.params;

    // Extract fullName and email from the request body
    const { fullName, email } = req.body;

    // Validate if fullName and email are provided
    if (!fullName || !email) {
      return res.status(400).json({ message: "Both fullName and email are required." });
    }

    // Validate if deliveryBoyId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(deliveryBoyId)) {
      return res.status(400).json({ message: "Invalid deliveryBoyId." });
    }

    // Find the delivery boy by ID
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }

    // Update the delivery boy's fullName and email
    deliveryBoy.fullName = fullName;
    deliveryBoy.email = email;

    // Save the updated delivery boy details
    await deliveryBoy.save();

    // Send success response
    return res.status(200).json({
      message: "Delivery Boy updated successfully.",
      data: deliveryBoy,
    });
  } catch (error) {
    console.error("Error updating Delivery Boy:", error);
    return res.status(500).json({
      message: "Server error.",
      error: error.message,
    });
  }
};

// Step 2: Verify OTP and save in DB
exports.verifyOTP = async (req, res) => {
  try {
    const { token, otp } = req.body;
    if (!token || !otp) {
      return res.status(400).json({ message: "Token and OTP are required." });
    }
    if (otp !== OTP) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Decode token
    const decoded = jwt.verify(token, "temporarySecret");

    // Save in DB
    const newDeliveryBoy = new DeliveryBoy(decoded);
    await newDeliveryBoy.save();

    res.status(200).json({ message: "Delivery Boy Registered Successfully" });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Step 1: Request OTP for login
// Step 1: Request OTP for login
// 1. Request Login OTP
exports.requestLoginOTP = async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: "Mobile Number is required" });
    }

    // Check if delivery boy exists
    const deliveryBoy = await DeliveryBoy.findOne({ mobileNumber });
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy not found. Please register first." });
    }

    // Set OTP as a fixed value (1234)
    const otp = 1234;

    // Store OTP and expiry in database
    deliveryBoy.otp = otp;  // Save OTP
    deliveryBoy.otpExpiresAt = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
    await deliveryBoy.save();

    // For testing, send OTP in response (in real-world apps, this should be sent via SMS)
    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      otp,  // Send OTP in the response (for testing purposes)
    });
  } catch (error) {
    console.error("Request Login OTP Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// 2. Resend Login OTP
exports.resendLoginOTP = async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: "Mobile Number is required" });
    }

    // Find delivery boy by mobile number
    const deliveryBoy = await DeliveryBoy.findOne({ mobileNumber });
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy not found. Please register first." });
    }

    // Check if OTP exists and is still valid
    if (deliveryBoy.otp && deliveryBoy.otpExpiresAt && Date.now() < deliveryBoy.otpExpiresAt) {
      return res.status(400).json({ message: "OTP is still valid. Please wait until it expires." });
    }

    // Set OTP as a fixed value (1234)
    const otp = 1234;

    // Store the new OTP and expiry time in the database
    deliveryBoy.otp = otp;  // Save the new OTP
    deliveryBoy.otpExpiresAt = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
    await deliveryBoy.save();

    // For testing, send the OTP in the response (in a real-world app, this should be sent via SMS)
    res.status(200).json({
      success: true,
      message: "New OTP sent successfully",
      otp,  // Send OTP in the response (for testing purposes)
    });
  } catch (error) {
    console.error("Resend Login OTP Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// 3. Verify Login OTP
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { mobileNumber, otp } = req.body;  // Accept both mobileNumber and OTP in the request body

    if (!mobileNumber || !otp) {
      return res.status(400).json({ message: "Mobile Number and OTP are required." });
    }

    // Find the delivery boy using the mobile number
    const deliveryBoy = await DeliveryBoy.findOne({ mobileNumber });
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy not found." });
    }

    // If the OTP is expired, clear it from the database
    if (Date.now() > deliveryBoy.otpExpiresAt) {
      // OTP expired
      deliveryBoy.otp = null;  // Clear expired OTP
      deliveryBoy.otpExpiresAt = null;
      await deliveryBoy.save();
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Validate OTP by checking if it matches the one stored in the database
    if (parseInt(otp) !== deliveryBoy.otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP is valid — clear OTP fields for security reasons
    deliveryBoy.otp = null;
    deliveryBoy.otpExpiresAt = null;
    await deliveryBoy.save();

    // Create JWT token for future authenticated requests
    const authToken = jwt.sign(
      { id: deliveryBoy._id, mobileNumber: deliveryBoy.mobileNumber },
      "authSecret",
      { expiresIn: "7d" }
    );

    // Return success response with user details and JWT token
    res.status(200).json({
      success: true,
      message: "Login successful",
      deliveryBoy,  // Return delivery boy data
      authToken,    // Return the JWT token
    });
  } catch (error) {
    console.error("Verify Login OTP Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};


// Update email and/or image
exports.updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, longitude, latitude } = req.body;
    let imageUrl;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required." });
    }

    // If image is sent, upload to Cloudinary
    if (req.files && req.files.image) {
      const uploadRes = await cloudinary.uploader.upload(req.files.image[0].path);
      imageUrl = uploadRes.secure_url;
    }

    // Prepare update fields dynamically
    const updateFields = {};
    if (email) updateFields.email = email;
    if (imageUrl) updateFields.image = imageUrl;

    // Only update location if both coordinates are provided and valid
    if (longitude !== undefined && latitude !== undefined) {
      const lon = parseFloat(longitude);
      const lat = parseFloat(latitude);

      if (isNaN(lon) || isNaN(lat)) {
        return res.status(400).json({ message: "Longitude and latitude must be valid numbers." });
      }

      updateFields.location = {
        type: "Point",
        coordinates: [lon, lat] // GeoJSON format [longitude, latitude]
      };
    }

    const updatedDeliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedDeliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }

    res.status(200).json({
      success: true,
      data: updatedDeliveryBoy
    });
  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get full profile (all details in one object)
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required." });
    }

    const deliveryBoy = await DeliveryBoy.findById(userId).lean();
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }

    res.status(200).json({
      success: true,
      data: deliveryBoy  // already flat — no nesting
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update delivery boy location (longitude, latitude)
// Update delivery boy location with Socket.io
exports.updateLocation = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const { latitude, longitude } = req.body;

    console.log('📍 Update Location Called:', { deliveryBoyId, latitude, longitude });

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(deliveryBoyId)) {
      return res.status(400).json({ 
        success: false,
        message: "Valid deliveryBoyId is required." 
      });
    }

    // Validate coordinates
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ 
        success: false,
        message: "Latitude and Longitude must be numbers." 
      });
    }

    // Check if delivery boy exists
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({ 
        success: false,
        message: "Delivery boy not found." 
      });
    }

    // Update location using GeoJSON format
    const updatedDeliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      deliveryBoyId,
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          lastLocationUpdate: new Date()
        }
      },
      { new: true, runValidators: true }
    ).lean();

    // Prepare location data for Socket.io
    const locationData = {
      deliveryBoyId,
      latitude,
      longitude,
      timestamp: new Date(),
      deliveryBoyName: updatedDeliveryBoy.name,
      vehicleType: updatedDeliveryBoy.vehicleType
    };

    // Emit live location via Socket.io
    const io = global.io;
    
    if (io && typeof io.to === 'function') {
      // Emit to delivery boy's room
      const deliveryBoyRoom = `location_${deliveryBoyId}`;
      io.to(deliveryBoyRoom).emit('liveLocationUpdate', locationData);
      console.log(`📤 Location emitted to room: ${deliveryBoyRoom}`);
    } else {
      console.log('❌ Socket.io not available');
    }

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: updatedDeliveryBoy,
      socketEmitted: !!io
    });
  } catch (error) {
    console.error("Update Location Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server Error",
      error: error.message 
    });
  }
};

// Get delivery boy live location
exports.getLiveLocation = async (req, res) => {
  try {
    const { deliveryBoyId, userId } = req.params;

    console.log('🎯 Get Live Location Called:', { deliveryBoyId, userId });

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(deliveryBoyId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false,
        message: "Valid deliveryBoyId and userId are required." 
      });
    }

    // Check if user exists
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ 
        success: false,
        message: "User not found." 
      });
    }

    // Get delivery boy location
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId)
      .select('name vehicleType location lastLocationUpdate phone')
      .lean();

    if (!deliveryBoy) {
      return res.status(404).json({ 
        success: false,
        message: "Delivery boy not found." 
      });
    }

    const locationData = {
      deliveryBoyId,
      userId,
      latitude: deliveryBoy.location?.coordinates[1] || null,
      longitude: deliveryBoy.location?.coordinates[0] || null,
      lastUpdate: deliveryBoy.lastLocationUpdate,
      deliveryBoyName: deliveryBoy.name,
      vehicleType: deliveryBoy.vehicleType,
      phone: deliveryBoy.phone,
      isOnline: deliveryBoy.lastLocationUpdate && 
                (new Date() - new Date(deliveryBoy.lastLocationUpdate)) < 5 * 60 * 1000 // 5 minutes threshold
    };

    // Emit via Socket.io if someone is listening
    const io = global.io;
    if (io && typeof io.to === 'function') {
      const userRoom = `user_${userId}`;
      io.to(userRoom).emit('currentLocation', locationData);
    }

    res.status(200).json({
      success: true,
      message: "Live location retrieved successfully",
      data: locationData
    });
  } catch (error) {
    console.error("Get Live Location Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server Error",
      error: error.message 
    });
  }
};

// Assign order to nearby delivery boys
exports.assignOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ success: false, message: "Valid orderId is required." });

    const order = await Order.findById(orderId).populate("restaurantId userId");
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    // Check if already assigned to a delivery boy
    const existingAssignment = await DeliveryAssignment.findOne({
      orderId: order._id,
      status: { $in: ["Accepted", "Picked", "Delivered"] } // already taken
    });

    if (existingAssignment) {
      return res.status(200).json({
        success: true,
        message: "Order already assigned to a delivery boy",
        data: existingAssignment
      });
    }

    // Optionally also check for pending assignments to avoid duplicate pushes
    const pendingAssignments = await DeliveryAssignment.find({
      orderId: order._id,
      status: "Pending"
    });

    if (pendingAssignments.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Order is already sent to delivery boys",
        data: pendingAssignments
      });
    }

    // Proceed with assigning to nearby delivery boys
    const restaurantLoc = order.restaurantId.location.coordinates;
    const userLoc = order.userId.location.coordinates;

    const deliveryBoys = await DeliveryBoy.find({ "location.coordinates": { $exists: true } });

    const assignments = [];
    for (const boy of deliveryBoys) {
      if (!boy.location?.coordinates) continue;

      const [boyLon, boyLat] = boy.location.coordinates;
      const pickupDistance = parseFloat(calculateDistanceKm(boyLat, boyLon, restaurantLoc[1], restaurantLoc[0]).toFixed(2));
      const dropDistance = parseFloat(calculateDistanceKm(restaurantLoc[1], restaurantLoc[0], userLoc[1], userLoc[0]).toFixed(2));

      if (pickupDistance <= 8) {
        const assignment = await DeliveryAssignment.create({
          orderId: order._id,
          deliveryBoyId: boy._id,
          restaurantId: order.restaurantId._id,
          userId: order.userId._id,
          pickupDistance,
          dropDistance
        });
        assignments.push(assignment);
      }
    }

    return res.status(201).json({
      success: true,
      message: assignments.length > 0
        ? "Order assigned to nearby delivery boys (8km)"
        : "No delivery boys available within 8km",
      data: assignments
    });

  } catch (error) {
    console.error("assignOrder error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.acceptOrder = async (req, res) => {
 try {
    const { assignmentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(assignmentId))
      return res.status(400).json({ success: false, message: "Valid assignmentId is required." });

    const assignment = await DeliveryAssignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ success: false, message: "Assignment not found." });

    if (assignment.status !== "Pending") {
      return res.status(400).json({ success: false, message: `Order already ${assignment.status}` });
    }

    // Fetch order with user, user address, restaurant, and order items
    const order = await Order.findById(assignment.orderId)
      .populate({
        path: "userId",
        select: "location" // include address/location
      })
      .populate({
        path: "restaurantId",
        select: "restaurantName location address" // restaurant info + address
      })
      .lean();

    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    // Accept the assignment for this delivery boy
    assignment.status = "Accepted";
    assignment.acceptedAt = new Date();
    assignment.orderDetails = order;               // full order info including items
    assignment.userDetails = order.userId;        // user info + address
    assignment.restaurantDetails = order.restaurantId; // restaurant info + address
    await assignment.save();

    // Cancel all other delivery assignments for the same order
    await DeliveryAssignment.updateMany(
      { orderId: assignment.orderId, _id: { $ne: assignment._id }, status: "Pending" },
      { $set: { status: "Canceled", canceledAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "Order accepted successfully. Other pending assignments canceled.",
      data: assignment
    });

  } catch (error) {
    console.error("acceptOrder error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
exports.assignDeliveryAndTrack = async (req, res) => {
   try {
    const { deliveryBoyId, status } = req.body;

    // Validate deliveryBoyId
    if (!mongoose.Types.ObjectId.isValid(deliveryBoyId))
      return res.status(400).json({ success: false, message: "Valid deliveryBoyId is required." });

    // Validate status if provided
    const allowedStatuses = ["Accepted", "Picked", "Delivered"];
    if (status && !allowedStatuses.includes(status))
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowedStatuses.join(", ")}` });

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy || !deliveryBoy.location?.coordinates) {
      return res.status(404).json({ success: false, message: "Delivery boy location not found." });
    }

    const [boyLon, boyLat] = deliveryBoy.location.coordinates;

    // Fetch active assignment
    const assignment = await DeliveryAssignment.findOne({
      deliveryBoyId,
      status: { $in: ["Accepted"] }
    }).populate("restaurantId userId");

    if (!assignment) {
      return res.status(200).json({ success: true, message: "No active delivery." });
    }

    // Update status if provided
    if (status) assignment.status = status;

    // Calculate distances using DB-stored location
    const restLoc = assignment.restaurantId.location.coordinates;
    const userLoc = assignment.userId.location.coordinates;

    const pickupDistance = parseFloat(calculateDistanceKm(boyLat, boyLon, restLoc[1], restLoc[0]).toFixed(2));
    const dropDistance = parseFloat(calculateDistanceKm(restLoc[1], restLoc[0], userLoc[1], userLoc[0]).toFixed(2));

    assignment.pickupDistance = pickupDistance;
    assignment.dropDistance = dropDistance;

    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Delivery assignment updated successfully",
      data: assignment
    });

  } catch (error) {
    console.error("assignDeliveryAndTrack error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { assignmentId, status } = req.body;
    if (!["Picked", "Delivered"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status." });

    const assignment = await DeliveryAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
    if (assignment.status === "Cancelled")
      return res.status(400).json({ success: false, message: "Order cancelled." });

    assignment.status = status;
    if (status === "Delivered") assignment.deliveredAt = new Date();
    await assignment.save();

    return res.status(200).json({ success: true, message: `Order ${status}`, data: assignment });

  } catch (error) {
    console.error("updateDeliveryStatus error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


exports.getDailyStats = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayOrders = await DeliveryAssignment.countDocuments({ createdAt: { $gte: startOfDay } });
    const cancelledOrders = await DeliveryAssignment.countDocuments({ status: "Cancelled", updatedAt: { $gte: startOfDay } });
    const completedOrders = await DeliveryAssignment.countDocuments({ status: "Delivered", deliveredAt: { $gte: startOfDay } });

    return res.status(200).json({
      success: true,
      data: { todayOrders, cancelledOrders, completedOrders }
    });

  } catch (error) {
    console.error("getDailyStats error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};




exports.getAllDeliveryBoys = async (req, res) => {
  try {
    const deliveryBoys = await DeliveryBoy.find(); // Fetch all delivery boys from the database

    if (deliveryBoys.length === 0) {
      return res.status(404).json({ message: "No delivery boys found." });
    }

    res.status(200).json({
      message: "Delivery boys fetched successfully.",
      data: deliveryBoys
    });
  } catch (error) {
    console.error("Error fetching delivery boys:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



exports.getAllActiveDeliveryBoys = async (req, res) => {
  try {
    // Fetch all delivery boys where the status is 'active'
    const deliveryBoys = await DeliveryBoy.find({ status: 'active' });

    if (deliveryBoys.length === 0) {
      return res.status(404).json({ message: "No active delivery boys found." });
    }

    res.status(200).json({
      message: "Active delivery boys fetched successfully.",
      data: deliveryBoys
    });
  } catch (error) {
    console.error("Error fetching active delivery boys:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


exports.deleteDeliveryBoy = async (req, res) => {
  const { id } = req.params; // Extract delivery boy ID from the request params

  try {
    // Find and remove the delivery boy by ID
    const deletedDeliveryBoy = await DeliveryBoy.findByIdAndDelete(id);

    if (!deletedDeliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }

    res.status(200).json({
      message: "Delivery boy deleted successfully.",
      data: deletedDeliveryBoy
    });
  } catch (error) {
    console.error("Error deleting delivery boy:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



exports.getAllNotifications = async (req, res) => {
  try {
    // Fetch all notifications from the database
    const notifications = await notificationModel.find()
      .sort({ createdAt: -1 }) // Sorting by latest notifications first
      .populate('deliveryBoyId', 'fullName mobileNumber') // Optional: Populate DeliveryBoy details
      .exec();

    // If no notifications are found
    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ message: "No notifications found." });
    }

    // Return the notifications
    res.status(200).json({
      message: "Notifications fetched successfully.",
      notifications
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    // Check if notificationId is provided
    if (!notificationId) {
      return res.status(400).json({ message: "Notification ID is required." });
    }

    // Find and delete the notification
    const deletedNotification = await notificationModel.findByIdAndDelete(notificationId);

    // If no notification is found to delete
    if (!deletedNotification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    // Successfully deleted the notification
    res.status(200).json({
      message: "Notification deleted successfully.",
      deletedNotification
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};




exports.setBaseDeliveryCharge = async (req, res) => {
  try {
    const { baseDeliveryCharge } = req.body;

    if (!baseDeliveryCharge || isNaN(baseDeliveryCharge) || parseFloat(baseDeliveryCharge) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid delivery charge amount"
      });
    }

    const chargeAmount = parseFloat(baseDeliveryCharge);

    console.log('Setting base delivery charge to:', chargeAmount);

    // Update all delivery boys with the new base delivery charge
    const result = await DeliveryBoy.updateMany(
      {},
      { $set: { baseDeliveryCharge: chargeAmount } }
    );

    console.log('MongoDB Update Result:', result);

    // Verify updates
    const updatedCount = await DeliveryBoy.countDocuments({ baseDeliveryCharge: chargeAmount });

    console.log('Verified updated count:', updatedCount);

    res.status(200).json({
      success: true,
      message: `Base delivery charge updated to ₹${chargeAmount} for all ${result.modifiedCount} delivery boys`,
      data: {
        modifiedCount: result.modifiedCount,
        verifiedCount: updatedCount,
        baseDeliveryCharge: chargeAmount
      }
    });

  } catch (error) {
    console.error("Error setting base delivery charge:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


// Add individual delivery charge update
exports.updateDeliveryBoyCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const { baseDeliveryCharge } = req.body;

    if (!baseDeliveryCharge || isNaN(baseDeliveryCharge) || parseFloat(baseDeliveryCharge) < 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid delivery charge amount"
      });
    }

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      id,
      { baseDeliveryCharge: parseFloat(baseDeliveryCharge) },
      { new: true }
    );

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Delivery charge updated successfully",
      data: deliveryBoy
    });

  } catch (error) {
    console.error("Error updating delivery charge:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};



// Controller to add account details, including UPI ID
// Controller to add account details, including UPI ID
exports.addAccountDetails = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const { accountNumber, bankName, accountHolderName, ifscCode, upiId } = req.body;

    // Validate the account details
    if (!accountNumber || !bankName || !accountHolderName || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required account details (account number, bank name, etc.).",
      });
    }

    // Find the delivery boy by ID
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Ensure myAccountDetails is initialized as an array before pushing
    if (!deliveryBoy.myAccountDetails) {
      deliveryBoy.myAccountDetails = [];
    }

    // Push the new account details into the delivery boy's account details array
    deliveryBoy.myAccountDetails.push({
      accountNumber,
      bankName,
      accountHolderName,
      ifscCode,
      upiId,  // Store UPI ID as part of the account details
    });

    // Log the details that are being added to the array
    console.log('Added Account Details:', {
      accountNumber,
      bankName,
      accountHolderName,
      ifscCode,
      upiId
    });

    // Log the updated myAccountDetails array
    console.log('Updated myAccountDetails:', deliveryBoy.myAccountDetails);

    // Save the updated delivery boy document
    const updatedDeliveryBoy = await deliveryBoy.save();

    return res.status(200).json({
      success: true,
      message: "Account details added successfully.",
      data: updatedDeliveryBoy.myAccountDetails,  // Return the updated account details
    });
  } catch (error) {
    console.error("Error adding account details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



// Controller to get account details for a specific delivery boy
exports.getAccountDetails = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    // Find the delivery boy by ID
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Return the delivery boy's account details
    return res.status(200).json({
      success: true,
      message: "Account details fetched successfully.",
      data: deliveryBoy.myAccountDetails,
    });
  } catch (error) {
    console.error("Error fetching account details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



// Controller to handle withdrawal requests
exports.withdrawAmount = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const { amount, accountDetails } = req.body;  // Account details should be an object with account info

    // Validate amount and account details
    if (!amount || !accountDetails || !accountDetails.accountNumber || !accountDetails.bankName) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required withdrawal details including amount and account information.",
      });
    }

    // Find the delivery boy by ID
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Check if the withdrawal amount is greater than the wallet balance
    if (amount > deliveryBoy.walletBalance) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance to complete this withdrawal.",
      });
    }

    // Deduct the withdrawal amount from the delivery boy's wallet
    deliveryBoy.walletBalance -= amount;
    await deliveryBoy.save();  // Save the updated wallet balance

    // Create a new withdrawal request entry in the Withdrawal model
    const newWithdrawal = new Withdrawal({
      deliveryBoyId,
      amount,
      accountDetails,
      status: 'Pending',  // Status of the withdrawal is 'Pending' initially
    });

    // Save the withdrawal request
    await newWithdrawal.save();

    return res.status(200).json({
      success: true,
      message: "Withdrawal request created successfully. Status: Pending.",
      data: newWithdrawal,
    });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};




// Admin controller to get all withdrawal requests
exports.getAllWithdrawals = async (req, res) => {
  try {
    // Fetch all withdrawal requests
    const withdrawals = await Withdrawal.find()
      .populate('deliveryBoyId', 'name email')  // Optional: Populate delivery boy's name and email
      .sort({ dateRequested: -1 });  // Sort by most recent requests

    if (!withdrawals || withdrawals.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No withdrawal requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Withdrawal requests fetched successfully.",
      data: withdrawals,
    });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

// Admin controller to update withdrawal status (Approve/Reject)
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { withdrawalId } = req.params;  // Extract the withdrawalId from the URL params
    const { status } = req.body;  // Extract the status ('Approved' or 'Rejected') from the body

    // Validate status
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. It must be either 'Approved' or 'Rejected'.",
      });
    }

    // Find the withdrawal request by ID
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found.",
      });
    }

    // If status is 'Approved', deduct amount from delivery boy's wallet
    if (status === 'Approved') {
      const deliveryBoy = await DeliveryBoy.findById(withdrawal.deliveryBoyId);
      if (!deliveryBoy) {
        return res.status(404).json({
          success: false,
          message: "Delivery boy not found.",
        });
      }

      // Check if the delivery boy has enough balance
      if (deliveryBoy.walletBalance < withdrawal.amount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance for the withdrawal.",
        });
      }

      // Deduct the withdrawal amount from the delivery boy's wallet
      deliveryBoy.walletBalance -= withdrawal.amount;

      // Save the updated delivery boy's wallet balance
      await deliveryBoy.save();
    }

    // Update the withdrawal request status
    withdrawal.status = status;

    // Save the updated withdrawal status
    await withdrawal.save();

    // Return the success response
    return res.status(200).json({
      success: true,
      message: `Withdrawal request ${status} successfully.`,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};


exports.getDeliveryBoyProfile = async (req, res) => {
  try {
    // Extract the deliveryBoyId from the request parameters
    const { deliveryBoyId } = req.params;

    // Find the delivery boy by the provided ID
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);

    // Check if the delivery boy exists
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Return the delivery boy's details in the response
    return res.status(200).json({
      success: true,
      message: "Delivery boy profile retrieved successfully.",
      data: deliveryBoy,
    });
  } catch (error) {
    console.error("Error retrieving delivery boy profile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



exports.updateProfileImage = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    
    // Check if the profile image is provided
    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({
        success: false,
        message: "Please provide a profile image.",
      });
    }

    const profileImage = req.files.profileImage;  // Access file uploaded via `req.files`

    // Upload the profile image to Cloudinary
    const uploadedImage = await cloudinary.uploader.upload(profileImage.tempFilePath, {
      folder: 'deliveryBoy/profileImages',
    });

    // Find the delivery boy by ID
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Update the profile image URL in the database
    deliveryBoy.profileImage = uploadedImage.secure_url;
    await deliveryBoy.save();

    return res.status(200).json({
      success: true,
      message: "Profile image updated successfully.",
      data: {
        profileImage: uploadedImage.secure_url,  // Return the updated profile image URL
      },
    });
  } catch (error) {
    console.error("Error updating profile image:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



exports.getDeliveryBoyDashboard = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const { period } = req.query; // optional query param: today | week | month | year

    // Validate if the delivery boy exists
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    const walletTransactions = deliveryBoy.walletTransactions || [];
    const today = new Date();

    // ===== Helper functions =====
    const filterTransactionsByDate = (startDate, endDate) => {
      return walletTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.dateAdded);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    };

    const getDayOfWeek = (date) => {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return daysOfWeek[date.getDay()];
    };

    // ===== Orders statistics =====
    const completedOrdersCount = await Order.countDocuments({
      deliveryBoyId,
      orderStatus: "Delivered",
      deliveryStatus: "Delivered",
    });

    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const todayOrdersCount = await Order.countDocuments({
      deliveryBoyId,
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    });

    const cancelledOrdersCount = await Order.countDocuments({
      deliveryBoyId,
      orderStatus: "Cancelled",
    });

    // ===== Earnings =====
    const todayEarnings = filterTransactionsByDate(startOfToday, endOfToday)
      .reduce((total, transaction) => total + transaction.amount, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as start
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekEarnings = filterTransactionsByDate(startOfWeek, endOfWeek)
      .reduce((total, transaction) => total + transaction.amount, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthEarnings = filterTransactionsByDate(startOfMonth, endOfMonth)
      .reduce((total, transaction) => total + transaction.amount, 0);

    // ===== Dynamic Earnings Array based on 'period' query =====
    let earningsArray = [];

    if (period === "today") {
      earningsArray.push({
        date: startOfToday.toISOString().split('T')[0],
        day: getDayOfWeek(startOfToday),
        earnings: todayEarnings,
      });
    } else if (period === "week") {
      for (let i = 0; i < 7; i++) {
        const day = new Date();
        day.setDate(today.getDate() - i);
        const startOfDay = new Date(day.setHours(0, 0, 0, 0));
        const endOfDay = new Date(day.setHours(23, 59, 59, 999));
        const earningsForDay = filterTransactionsByDate(startOfDay, endOfDay)
          .reduce((total, transaction) => total + transaction.amount, 0);

        earningsArray.push({
          date: startOfDay.toISOString().split('T')[0],
          day: getDayOfWeek(startOfDay),
          earnings: earningsForDay,
        });
      }
      earningsArray.reverse(); // So earliest day comes first
    } else if (period === "month") {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(today.getFullYear(), today.getMonth(), i);
        const startOfDay = new Date(day.setHours(0, 0, 0, 0));
        const endOfDay = new Date(day.setHours(23, 59, 59, 999));
        const earningsForDay = filterTransactionsByDate(startOfDay, endOfDay)
          .reduce((total, transaction) => total + transaction.amount, 0);

        earningsArray.push({
          date: startOfDay.toISOString().split('T')[0],
          day: getDayOfWeek(startOfDay),
          earnings: earningsForDay,
        });
      }
    } else if (period === "year") {
      for (let m = 0; m < 12; m++) {
        const startOfMonth = new Date(today.getFullYear(), m, 1);
        const endOfMonth = new Date(today.getFullYear(), m + 1, 0, 23, 59, 59, 999);
        const earningsForMonth = filterTransactionsByDate(startOfMonth, endOfMonth)
          .reduce((total, transaction) => total + transaction.amount, 0);

        const monthName = startOfMonth.toLocaleString('default', { month: 'long' });
        earningsArray.push({
          month: monthName,
          earnings: earningsForMonth,
        });
      }
    }

    // ===== Response =====
    return res.status(200).json({
      success: true,
      message: "Delivery boy dashboard fetched successfully.",
      data: {
         currentOrderStatus: deliveryBoy.currentOrderStatus, // Added this at the top
        completedOrdersCount,
        todayOrdersCount,
        cancelledOrdersCount,
        walletBalance: deliveryBoy.walletBalance || 0,
        todayEarnings,
        weekEarnings,
        monthEarnings,
        earningsArray, // dynamic field depending on period
      },
    });

  } catch (error) {
    console.error("Error fetching delivery boy dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};



// Controller to update delivery boy's status (e.g., 'active', 'inactive', 'blocked', etc.)
exports.updateDeliveryBoyStatus = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params; // Extract the deliveryBoyId from the URL params
    const { deliveryBoyStatus } = req.body; // Extract the new status from the body

    // Validate the input status (you can add your own valid statuses here)
    const validStatuses = ['active', 'inactive', 'blocked']; 
    if (!validStatuses.includes(deliveryBoyStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Valid statuses are: 'active', 'inactive', 'blocked'.",
      });
    }

    // Find the delivery boy by ID
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found.",
      });
    }

    // Update the delivery boy's status
    deliveryBoy.deliveryBoyStatus = deliveryBoyStatus;
    await deliveryBoy.save(); // Save the updated delivery boy status

    // Return success response with only the deliveryBoyStatus
    return res.status(200).json({
      success: true,
      message: `Delivery boy status updated to ${deliveryBoyStatus} successfully.`,
      data: { deliveryBoyStatus }, // Only return the updated status
    });
  } catch (error) {
    console.error("Error updating delivery boy status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};
