const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },
    ambassadorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambassador",
      default: null,
    },
    commission: {  // ✅ NOT "percentage" — "commission" (e.g., 500, 1000, 2500)
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Pre-save: Only one ID allowed based on type
commissionSchema.pre("save", function (next) {
  if (this.type === "vendor") {
    if (!this.vendorId) return next(new Error("vendorId required for type 'vendor'"));
    this.ambassadorId = null;
  } else if (this.type === "ambassador") {
    if (!this.ambassadorId) return next(new Error("ambassadorId required for type 'ambassador'"));
    this.vendorId = null;
  } else {
    return next(new Error("type must be 'vendor' or 'ambassador'"));
  }
  next();
});

// ✅ Unique: No duplicate commission for same user
commissionSchema.index({ type: 1, vendorId: 1 }, { unique: true, partialFilterExpression: { vendorId: { $ne: null } } });
commissionSchema.index({ type: 1, ambassadorId: 1 }, { unique: true, partialFilterExpression: { ambassadorId: { $ne: null } } });

module.exports = mongoose.model("Commission", commissionSchema);