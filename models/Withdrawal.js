const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Withdrawal schema
const withdrawalSchema = new Schema({
  deliveryBoyId: { 
    type: Schema.Types.ObjectId, 
    ref: 'DeliveryBoy',  // Reference to DeliveryBoy model
  },
  amount: { 
    type: Number, 
  },
  accountDetails: {
    accountNumber: { type: String, },
    bankName: { type: String, },
    accountHolderName: { type: String, },
    ifscCode: { type: String, },
  },
  status: { 
    type: String, 
    default: 'Pending',  // Status of the withdrawal, default is 'Pending'
  },
  dateRequested: { 
    type: Date, 
    default: Date.now 
  },
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
