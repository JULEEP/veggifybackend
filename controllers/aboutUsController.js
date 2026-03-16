const AboutUs = require('../models/aboutUsModel');


// Create or update "About Us"
const upsertAboutUs = async (req, res) => {
  const { content } = req.body;

  try {
    let about = await AboutUs.findOne();

    if (about) {
      about.content = content;
      about.updatedAt = Date.now();
      await about.save();
    } else {
      about = await AboutUs.create({ content });
    }

    res.status(200).json({
      success: true,
      message: 'About Us content saved successfully',
      data: about
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get "About Us"
const getAboutUs = async (req, res) => {
  try {
    const about = await AboutUs.findOne();

    if (!about) {
      return res.status(404).json({ success: false, message: 'About Us content not found' });
    }

    res.status(200).json({ success: true, data: about });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  upsertAboutUs,
  getAboutUs
};
