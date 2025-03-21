const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed', 'shipping'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: function(value) {
                if (this.discountType === 'percentage') {
                    return value <= 100;
                }
                return value <= 1000000; // or any maximum amount you want to allow
            },
            message: props => {
                if (props.value > 100 && this.discountType === 'percentage') {
                    return 'Percentage discount cannot exceed 100%';
                }
                return 'Discount value exceeds maximum allowed amount';
            }
        }
    },
    minimumPurchase: {
        type: Number,
        default: 0,
        min: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true,
        validate: {
            validator: function(value) {
                return value > this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    usageLimit: {
        type: Number,
        min: 0
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Virtual for checking if promo code is expired
promoCodeSchema.virtual('isExpired').get(function() {
    return this.endDate < new Date();
});

// Virtual for checking if promo code is valid
promoCodeSchema.virtual('isValid').get(function() {
    return this.isActive && !this.isExpired && 
           (!this.usageLimit || this.usedCount < this.usageLimit);
});

// Index for faster queries
promoCodeSchema.index({ code: 1 }, { unique: true });
promoCodeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
module.exports = PromoCode;