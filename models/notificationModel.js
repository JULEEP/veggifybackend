const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
  },
  read: {
    type: Boolean,
    default: false
  },
   deliveryBoyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryBoy',  // Reference to the DeliveryBoy model
    },
      restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', },
    message: {
      type: String,
    },
    notificationType: {
      type: String,
    },
    status: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);                  