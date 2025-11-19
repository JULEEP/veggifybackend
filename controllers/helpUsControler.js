const HelpUs = require('../models/helpUsModel');

// POST: Submit issue
const submitHelpUs = async (req, res) => {
  try {
    const { userId } = req.params; // <-- yahan se userId liya
    const { name, email, issueType, description } = req.body;
    
    const issue = await HelpUs.create({
      userId,
      name,
      email,
      issueType,
      description
    });

    res.status(201).json({
      message: "Issue submitted successfully",
      data: issue
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
    const issues = await HelpUs.find().sort({ createdAt: -1 });
    res.status(200).json({ message: "Help issues fetched", data: issues });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  submitHelpUs,
  getAllHelpUs
};
