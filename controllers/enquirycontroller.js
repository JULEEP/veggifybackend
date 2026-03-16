// controllers/enquiryController.js
const Enquiry = require("../models/enquiry");
const SubAdmin = require("../models/SubAdmin");

// 📌 Create a new enquiry
exports.createEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.create(req.body);
    res.status(201).json({
      success: true,
      message: "Enquiry created successfully",
      data: enquiry,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 📌 Get all enquiries
exports.getAllEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: enquiries.length,
      data: enquiries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 📌 Get enquiry by ID
exports.getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }
    res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 📌 Update enquiry
exports.updateEnquiry = async (req, res) => {
  try {
    const { subAdminId } = req.body;  // Extract subAdminId from request body

    // Find the enquiry by id and update with the provided data
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    // Set note based on who is updating the enquiry
    let note = `Enquiry updated by Admin`; // Default note if no sub-admin is provided
    if (subAdminId) {
      const subAdmin = await SubAdmin.findById(subAdminId);
      if (subAdmin) {
        note = `Enquiry updated by Sub-admin: ${subAdmin.name}`;
      } else {
        return res.status(404).json({ success: false, message: "Sub-admin not found" });
      }
    }

    // Add note to the update data
    const updateData = { ...req.body, note };

    // Update the enquiry with the new data
    const updatedEnquiry = await Enquiry.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Enquiry updated successfully",
      data: updatedEnquiry,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 📌 Delete enquiry
exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
