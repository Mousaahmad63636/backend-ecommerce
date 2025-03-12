// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true
    },
    street: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    postalCode: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { _id: true });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    addresses: [addressSchema],
    profileImage: {
        type: String,
        default: null
    },
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }],
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastLogin: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    // FCM token to receive push notifications
    fcmToken: {
        type: String,
        default: null
    },
    preferences: {
        newsletter: {
            type: Boolean,
            default: true
        },
        marketing: {
            type: Boolean,
            default: true
        },
        orderNotifications: {
            type: Boolean,
            default: true
        }
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to handle failed login attempts
userSchema.methods.incrementLoginAttempts = async function() {
    // Reset login attempts if lock has expired
    if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = null;
    } else {
        this.loginAttempts += 1;
        
        // Lock account after 5 failed attempts
        if (this.loginAttempts >= 5 && !this.lockUntil) {
            // Lock for 1 hour
            this.lockUntil = Date.now() + (60 * 60 * 1000);
        }
    }
    await this.save();
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to update default address
userSchema.methods.setDefaultAddress = async function(addressId) {
    this.addresses.forEach(addr => {
        addr.isDefault = addr._id.toString() === addressId.toString();
    });
    await this.save();
};

// Method to handle marketing preferences
userSchema.methods.updatePreferences = async function(preferences) {
    this.preferences = { ...this.preferences, ...preferences };
    await this.save();
};

// Static method to find all admin FCM tokens
userSchema.statics.getAdminFCMTokens = async function() {
    const admins = await this.find({ 
        role: 'admin',
        fcmToken: { $ne: null }
    });
    
    return admins
        .filter(admin => admin.fcmToken)
        .map(admin => admin.fcmToken);
};

// Virtual for full address
addressSchema.virtual('fullAddress').get(function() {
    return `${this.street}, ${this.city}, ${this.state} ${this.postalCode}, ${this.country}`;
});

const User = mongoose.model('User', userSchema);
module.exports = User;