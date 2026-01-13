const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const restaurantSchema = new mongoose.Schema(
  {
    restaurantName: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    rating: {
      type: Number,
      min: [0, 'Rating must be at least 0'],
      max: [5, 'Rating cannot exceed 5'],
      default: 0
    },
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category' // Reference to the Category model
      }
    ],
     aadharCardFront: {
    public_id: String,
    url: String
  },
  aadharCardBack: {
    public_id: String,
    url: String
  },
      reviews: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
      stars: { type: Number, },
      comment: { type: String, },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  // restaurantSchema में notifications array add करें:
notifications: [{
  type: {
    type: String,
    default: 'order_placed'
  },
  title: String,
  message: String,
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}],
    startingPrice: {
      type: Number,
    },
    gstNumber: {
      type: String,
    },
    password: {
      type: String,
    },
    locationName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      }
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address'
      ]
    },
    walletBalance: {
      type: Number,
      default: 0
    },
    // ✅ New field: referral code generated automatically
    referralCode: {
      type: String,
      trim: true,
    },

    // ✅ New field: optional referral (if someone referred them)
    referredBy: {
      type: String,
      default: null,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
      match: [
        /^[0-9]{10}$/,
        'Mobile number must be exactly 10 digits'
      ]
    },
    commission: {
  type: Number,
  default: 0
},

otp: {
  code: String,
  expiresAt: Date
},

 resetPasswordOTP: {
    code: String,
    expiresAt: Date
  },


   commissionPercentage: {
    type: Number,
    default: 10
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalCommissionPaid: {
    type: Number,
    default: 0
  },
  // CHANGE HERE: String array
  walletTransactions: [{
    type: String
  }],

   myAccounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorAccount'
  }],

 myPlans: [
    {
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VendorPlan",
      },
      purchaseDate: Date,
      expiryDate: Date,
      isPurchased: {
        type: Boolean,
        default: false,
      },
    },
  ],

   discount: { // ✅ ADDED DISCOUNT FIELD
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },


 // NEW DOCUMENTS - Declaration Form & Vendor Agreement
  declarationForm: {
    public_id: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },

   // UPDATED: Separate Aadhar card front and back
  aadharCardFront: {
    public_id: String,
    url: String
  },
  aadharCardBack: {
    public_id: String,
    url: String
  },
  
  vendorAgreement: {
    public_id: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
     // ⭐ ADDED: documents (same format as image)
    gstCertificate: {
      public_id: String,
      url: String
    },

    fssaiLicense: {
      public_id: String,
      url: String
    },

    panCard: {
      public_id: String,
      url: String
    },

    aadharCard: {
      public_id: String,
      url: String
    },
    image: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      }
    }
  },
  { timestamps: true }
);

// Add 2dsphere index for location-based queries
restaurantSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Restaurant', restaurantSchema);
