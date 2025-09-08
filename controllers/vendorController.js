
const Restaurant = require("../models/restaurantModel");
const Order = require("../models/orderModel");
const RestaurantProduct = require("../models/restaurantModel");
const moment = require("moment");



exports.vendorLogin = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number is required"
      });
    }

    // Find vendor by mobile
    const vendor = await Restaurant.findOne({ mobile });

    if (!vendor) {
      return res.status(401).json({
        success: false,
        message: "Vendor not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor login successful",
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
    console.error("Vendor login error:", err);
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
  if (!vendorId) return res.status(400).json({ success: false, message: "Vendor ID is required" });

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

    // Fetch data
    const todayOrders = await Order.find({ restaurantId: vendorId, createdAt: { $gte: ranges.todayStart, $lte: ranges.todayEnd } });
    console.log("Today Orders:", todayOrders);

    const totalOrders = await Order.countDocuments({ restaurantId: vendorId });
    console.log("Total Orders Count:", totalOrders);

    const completedOrders = await Order.countDocuments({ restaurantId: vendorId, orderStatus: "Completed" });
    console.log("Completed Orders Count:", completedOrders);

    const agg = await Order.aggregate([
      { $match: { restaurantId: vendorId } },
      { $group: { _id: null, total: { $sum: "$subTotal" } } },
    ]);
    const orderAmount = agg[0]?.total || 0;
    console.log("Total Order Amount (Sum of subTotals):", orderAmount);

    const productsList = await RestaurantProduct.find({ restaurantId: vendorId });
    console.log("Fetched Restaurant Products:", productsList);

    const totalProducts = productsList.reduce((sum, rp) => sum + (rp.recommended?.length ?? 0), 0);
    console.log("Total Products (count from recommended array):", totalProducts);

    const recentOrders = await Order.find({ restaurantId: vendorId }).sort({ createdAt: -1 }).limit(10);
    console.log("Recent Orders:", recentOrders);

    const pendingOrders = await Order.find({ restaurantId: vendorId, orderStatus: "Pending" }).limit(10);
    console.log("Pending Orders:", pendingOrders);

    // Sales data
    const salesData = {
      Today: [{ name: "Today", sales: todayOrders.reduce((s, o) => s + o.subTotal, 0) }],
      "This Week": await getWeekSales(vendorId, ranges.weekStart, ranges.weekEnd),
      "Last Week": await getWeekSales(vendorId, ranges.lastWeekStart, ranges.lastWeekEnd),
      "Last Month": (
        await Order.aggregate([
          { $match: { restaurantId: vendorId, createdAt: { $gte: ranges.lastMonthStart, $lte: ranges.lastMonthEnd } } },
          { $group: { _id: { $week: "$createdAt" }, sales: { $sum: "$subTotal" } } },
          { $sort: { _id: 1 } },
        ])
      ).map((w, i) => ({ name: `Week ${i + 1}`, sales: w.sales })),
    };
    console.log("Sales Data:", salesData);

    return res.json({
      success: true,
      stats: { totalOrders, completedOrders, orderAmount, totalProducts },
      salesData,
      orders: recentOrders,
      pendingOrders,
    });
  } catch (err) {
    console.error("Error in getDashboardData:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
