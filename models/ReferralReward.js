const mongoose = require('mongoose');

const referralRewardSchema = new mongoose.Schema({
  userType: {
    type: String,
    enum: ['vendor', 'ambassador', 'user'],
  },
  rewardType: {
    type: String,
    enum: ['rupees', 'percentage'],
  
    default: 'rupees'
  },
  rewardValue: {
    type: Number,
    
  },
  minOrderValue: {
    type: Number,
    default: 0,
  },
  maxReward: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ReferralReward', referralRewardSchema);