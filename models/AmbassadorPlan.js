const mongoose = require('mongoose');

const AmbassadorPlanSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  price: {
    type: Number,
  },
  validity: {
    type: Number, // validity in days
  },
   discount: {
    type: Number,
    default: 0
  },
  benefits: {
    type: [String], // array of benefit descriptions
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('AmbassadorPlan', AmbassadorPlanSchema);
