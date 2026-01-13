const mongoose = require('mongoose');

const chargeSchema = new mongoose.Schema({
  type: {
    type: String,
    trim: true,
    enum: [
      'delivery_charge', 
      'platform_charge', 
      'gst_charges', 
      'packing_charges', 
      'gst_on_delivery',
      'free_delivery_threshold'  // ✅ Added new charge type
    ]
  },
  amount: {
    type: Number,
    min: 0 // amount cannot be negative
  },
  chargeType: {
    type: String,
    default: 'fixed',
    enum: ['fixed', 'percentage']
  },
  // Delivery charge specific fields
  distance: {
    type: Number,
    min: 0,
    default: null
  },
  deliveryMethod: {
    type: String,
    enum: ['flat_rate', 'per_km', 'slab_based'],
    default: null
  },
  minDistance: {
    type: Number,
    min: 0,
    default: null
  },
  maxDistance: {
    type: Number,
    min: 0,
    default: null
  },
  perKmRate: {
    type: Number,
    min: 0,
    default: null
  },
  // Free Delivery Threshold field
  freeDeliveryThreshold: {
    type: Number,
    min: 0,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true, // automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for display label
chargeSchema.virtual('displayLabel').get(function() {
  const labels = {
    'delivery_charge': 'Delivery Charge',
    'platform_charge': 'Platform Charge',
    'gst_charges': 'GST Charges',
    'packing_charges': 'Packing Charges',
    'gst_on_delivery': 'GST on Delivery Charges',
    'free_delivery_threshold': 'Free Delivery Threshold'  // ✅ Added
  };
  return labels[this.type] || this.type;
});

// Virtual for unit - FIXED: platform_charge should show ₹ not %
chargeSchema.virtual('unit').get(function() {
  const units = {
    'delivery_charge': '₹',
    'platform_charge': '₹',
    'gst_charges': '%',
    'packing_charges': '₹',
    'gst_on_delivery': '%',
    'free_delivery_threshold': '₹'  // ✅ Added
  };
  return units[this.type] || '';
});

// Index for faster queries
chargeSchema.index({ type: 1 }, { unique: true });
chargeSchema.index({ isActive: 1 });

// Pre-save middleware to validate delivery charges
chargeSchema.pre('save', function(next) {
  // If it's a delivery charge, validate delivery method fields
  if (this.type === 'delivery_charge') {
    if (!this.deliveryMethod) {
      return next(new Error('Delivery method is required for delivery charges'));
    }
    
    switch(this.deliveryMethod) {
      case 'flat_rate':
     
        break;
      case 'per_km':
        break;
      case 'slab_based':
        if (!this.minDistance || !this.maxDistance || !this.perKmRate) {
          return next(new Error('Min distance, max distance and per km rate are required for slab based delivery'));
        }
        if (this.minDistance >= this.maxDistance) {
          return next(new Error('Min distance must be less than max distance'));
        }
        break;
    }
  } 
  // For free delivery threshold
  else if (this.type === 'free_delivery_threshold') {
    if (!this.freeDeliveryThreshold || this.freeDeliveryThreshold <= 0) {
      return next(new Error('Free delivery threshold amount is required'));
    }
  }
  else {
    // For other non-delivery charges, clear delivery-related fields
    this.distance = null;
    this.deliveryMethod = null;
    this.minDistance = null;
    this.maxDistance = null;
    this.perKmRate = null;
    this.freeDeliveryThreshold = null;
  }
  
  next();
});

const Charge = mongoose.model('Charge', chargeSchema);

module.exports = Charge;