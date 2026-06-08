const mongoose = require('mongoose');  // Import mongoose
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },
    restaurantLocation: {
      type: String, // populated from Restaurant.locationName
    },
    deliveryAddress: {
      type: mongoose.Schema.Types.Mixed, // whole address object (flexible schema)
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
    },
    platformCharge: { type: Number, default: 0 }, // ✅ Added platformCharge
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending"
    },


    totalAmount: {
      type: Number,
    },
    gstAmount: {
      type: Number,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Completed"],
      default: "Pending"
    },

    orderStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Picked", "Prepared", "Completed", "Rider Accepted", "Rider Rejected", "Delivered", "Cancelled", "Rider Accepted", "Out For Delivery", "Confirmed"],
      default: "Pending"
    },

    rejectedRiders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryBoy",
        default: []
      }
    ],

    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null
    },


    paymentType: {
      type: String,
    },


    // Add new field for available delivery boys
    availableDeliveryBoys: [{
      deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy' },
      fullName: { type: String, },
      mobileNumber: { type: String, },
      vehicleType: { type: String, },
      pickupDistance: { type: Number, },
      walletBalance: { type: Number, },
      status: { type: String, enum: ['active', 'pending', 'inactive'], }
    }],

    amountSavedOnOrder: {
      type: Number,
      default: 0
    },

    // ✅ Location of the restaurant (for pickup)
    restaurantLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },

    // ✅ Location of the user (optional redundancy)
    // deliveryLocation: {
    //   type: {
    //     type: String,
    //     enum: ["Point"],
    //     default: "Point"
    //   },
    //   coordinates: {
    //     type: [Number], // [longitude, latitude]
    //     default: [0, 0]
    //   }
    // },

    // ✅ Assigned DeliveryBoy (if any)
    deliveryBoyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null
    },

    // ✅ Track delivery status (Optional)
    deliveryStatus: {
      type: String,
      enum: ["Pending", "Assigned", "Picked", "Completed", "Rider Accepted", "Rider Rejected", "Delivered", "Failed", "Rider Accepted", "No Rider Available"],
      default: "Pending"
    },

    transactionId: { type: String, default: null }, // store Razorpay txn id

    note: {
      type: String,
      default: ""
    },



    products: [{
      restaurantProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantProduct', },
      recommendedId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecommendedItem' },
      quantity: { type: Number, default: 1 },
      // Plate selection flags
      isHalfPlate: { type: Boolean, default: false },
      isFullPlate: { type: Boolean, default: false },

      name: { type: String, required: true },
      price: { type: Number, default: 0 }, // backend sets automatically
      image: { type: String, default: "" },
      discountPercent: { type: Number, default: 0 },   // <-- add this
      discountAmount: { type: Number, default: 0 }    // <-- add this
    }],


    note: { type: String },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubAdmin",
      default: null,
    },
    // ✅ Optional timestamps
    acceptedAt: Date,
    pickedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    totalItems: {
      type: Number,
      default: 0
    },
    subTotal: {
      type: Number,
      default: 0
    },
    deliveryCharge: {
      type: Number,
      default: 20
    },
    couponDiscount: { type: Number, default: 0 },
    totalPayable: {
      type: Number,
      default: 0
    },
    distanceKm: { type: Number, default: 0 },

    // ✅ Coupon related fields
    appliedCouponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null
    },

    // Add these fields:
    totalDiscount: { type: Number, default: 0 },
    gstCharges: { type: Number, default: 0 },
    packingCharges: { type: Number, default: 0 },
    platformCharge: { type: Number, default: 0 },
    gstOnDelivery: { type: Number, default: 0 },
    isDeliveryFree: { type: Boolean, default: false },
    freeDeliveryThreshold: { type: Number, default: 199 },
    perKmRate: { type: Number, default: 0 },
    chargeCalculations: { type: mongoose.Schema.Types.Mixed, default: {} },
    finalAmount: { type: Number, default: 0 }, // Alias for totalPayable

    // In products array, make sure originalPrice is there:
    originalPrice: { type: Number, default: 0 },

    chargeCalculations: {
      deliveryCharge: {
        baseAmount: { type: Number, default: 0 },
        distanceCharge: { type: Number, default: 0 },
        freeDeliveryApplied: { type: Boolean, default: false }
      },
      gstOnFood: {
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
      },
      packingCharges: {
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
      },
      platformCharge: {
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
      },
      gstOnDelivery: {
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
      },
      couponDiscount: {
        couponId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Coupon",
          default: null
        },
        couponCode: {
          type: String,
          default: ""
        },
        discountType: {
          type: String,
          enum: ["percentage", "flat", ""],
          default: ""
        },
        discountValue: {
          type: Number,
          default: 0
        },
        amount: {
          type: Number,
          default: 0
        },
        calculation: {
          type: String,
          default: ""
        }
      },
    },

    appliedCharges: {
      gstCharges: {
        type: { type: String, default: 'gst_charges' },
        amount: { type: Number, default: 0 },
        chargeType: { type: String, default: 'percentage' },
        unit: { type: String, default: '%' }
      },
      packingCharges: {
        type: { type: String, default: 'packing_charges' },
        amount: { type: Number, default: 0 },
        chargeType: { type: String, default: 'fixed' },
        unit: { type: String, default: '₹' }
      },
      platformCharge: {
        type: { type: String, default: 'platform_charge' },
        amount: { type: Number, default: 0 },
        chargeType: { type: String, default: 'percentage' },
        unit: { type: String, default: '%' }
      },
      deliveryCharge: {
        type: { type: String, default: 'delivery_charge' },
        amount: { type: Number, default: 0 },
        chargeType: { type: String, default: 'fixed' },
        deliveryMethod: { type: String, default: 'per_km' },
        perKmRate: { type: Number, default: 0 },
        unit: { type: String, default: '₹' }
      },
      gstOnDelivery: {
        type: { type: String, default: 'gst_on_delivery' },
        amount: { type: Number, default: 18 },
        chargeType: { type: String, default: 'percentage' },
        unit: { type: String, default: '%' }
      }
    },

    // ✅ Applied coupon details
    appliedCoupon: { type: mongoose.Schema.Types.Mixed, default: null },

    // ✅ Shadowfax API Response (NEW FIELD)
    shadowfaxResponse: {
      client_code: { type: String, default: null },
      status: { type: String, default: null },
      sfx_order_id: { type: Number, default: null },
      order_details: {
        order_value: { type: Number, default: null },
        scheduled_time: { type: String, default: null },
        paid: { type: String, default: null },
        preparation_time: { type: Number, default: null },
        client_order_id: { type: String, default: null },
        allot_time: { type: String, default: null },
        arrival_time: { type: String, default: null },
        rain_mode_flag: { type: Boolean, default: false },
        dispatch_time: { type: String, default: null },
        delivery_time: { type: String, default: null },
        vehicle_number: { type: String, default: null },
        order_date: { type: String, default: null },
        pickup_eta: { type: Number, default: null },
        drop_eta: { type: Number, default: null },
        last_update_time: { type: String, default: null },
        rain_surge_amount: { type: Number, default: 0 },
        client_surge: { type: Number, default: 0 }
      },
      rider_details: { type: mongoose.Schema.Types.Mixed, default: {} },
      drop_details: {
        name: { type: String, default: null },
        address: { type: String, default: null },
        city: { type: String, default: null },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null }
      },
      order_items: [{
        id: { type: String, default: null },
        name: { type: String, default: null },
        quantity: { type: Number, default: null },
        price: { type: Number, default: null },
        weight: { type: Number, default: null },
        category: { type: String, default: null },
        unit_price: { type: Number, default: null },
        return_condition: { type: String, default: null }
      }],
      track_url: { type: String, default: null },
      pickup_details: {
        name: { type: String, default: null },
        contact_number: { type: String, default: null },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        city: { type: String, default: null },
        address: { type: String, default: null }
      },
      delivery_cost: { type: Number, default: null },
      pickup_rain_mode_flag: { type: Boolean, default: false },
      drop_rain_mode_flag: { type: Boolean, default: false },
      rain_surge_amount: { type: Number, default: 0 },
      rain_impacted: { type: Boolean, default: false }
    }
  },


  {
    timestamps: true
  }
);

module.exports = mongoose.model("Order", orderSchema);
