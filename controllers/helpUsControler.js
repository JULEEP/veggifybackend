const HelpUs = require('../models/helpUsModel');
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");

dotenv.config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// POST: Submit issue
const submitHelpUs = async (req, res) => {
  try {
    const { userId } = req.params; // <-- yahan se userId liya
    const { name, email, issueType, description } = req.body;
    
    // Check if an image is uploaded
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "Image is required" });
    }

    const image = req.files.image; // Access the uploaded image file

    // Upload the image to Cloudinary
    cloudinary.uploader.upload(image.tempFilePath, { 
      folder: "help_issues",  // Optional folder name
      resource_type: "auto"   // Automatically detect the file type (image, video, etc.)
    }, async (error, result) => {
      if (error) {
        return res.status(500).json({ message: "Error uploading image to Cloudinary", error: error.message });
      }

      // Once the image is uploaded, get the URL
      const imageUrl = result.secure_url;

      // Create the issue entry with the image URL and default status as "pending"
      const issue = await HelpUs.create({
        userId,
        name,
        email,
        issueType,
        description,
        status: "pending", // Default status is "pending"
        imageUrl // Save the Cloudinary image URL
      });

      res.status(201).json({
        message: "Issue submitted successfully",
        data: issue
      });
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

// GET: Fetch all help requests (optional)
const getAllHelpUs = async (req, res) => {
  try {
    // Fetch all issues and populate the userId field with mobileNumber from the User model
    const issues = await HelpUs.find()
      .sort({ createdAt: -1 })  // Sort issues by createdAt (descending)
      .populate({
        path: 'userId',  // The field in HelpUs model that references User
        select: 'phoneNumber',  // Only populate the mobileNumber field from User
      });

    // Return the issues with the populated mobileNumber
    res.status(200).json({
      message: "Help issues fetched",
      data: issues,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// GET: Fetch issues by userId (and optionally by issueType)
const getIssuesByUser = async (req, res) => {
  try {
    const { userId } = req.params;  // Extract userId from URL params
    const { issueType } = req.query; // Extract issueType from query params (optional)

    // Build the query based on the provided userId and optionally issueType
    let query = { userId };

    if (issueType) {
      query.issueType = issueType; // If issueType is provided, filter by it
    }

    // Fetch issues from the database
    const issues = await HelpUs.find(query).lean();

    if (issues.length === 0) {
      return res.status(404).json({ message: "No issues found for this user" });
    }

    res.status(200).json({
      message: "Issues fetched successfully",
      data: issues
    });
  } catch (error) {
    console.error("Error fetching issues:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};


// PATCH: Update only the status of an issue (by issueId)
const updateHelpUs = async (req, res) => {
  try {
    const { issueId } = req.params; // Extract issueId from URL params
    const { status } = req.body;  // Extract status from the request body

    // Check if status is provided
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    // Find the issue by issueId
    const issue = await HelpUs.findById(issueId);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    // Update the status
    issue.status = status;

    // Save the updated issue
    await issue.save();

    res.status(200).json({
      message: "Issue status updated successfully",
      data: issue
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE: Delete an issue (by issueId)
const deleteHelpUs = async (req, res) => {
  try {
    const { issueId } = req.params; // Extract issueId from URL params

    // Find and delete the issue by issueId using findByIdAndDelete
    const issue = await HelpUs.findByIdAndDelete(issueId);

    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    res.status(200).json({
      message: "Issue deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


module.exports = {
  submitHelpUs,
  getAllHelpUs,
  getIssuesByUser,
  updateHelpUs,
  deleteHelpUs
};
