// backend/routes/users.js
const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const Product = require('../models/Product'); // Add this import
// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phoneNumber, address } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        const user = new User({
            email,
            password,
            name,
            phoneNumber,
            address,
            role: 'user',
            wishlist: []
        });

        await user.save();

        // Create token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ message: error.message });
    }
});

router.put('/fcm-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }
    
    // Update the user's FCM token
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { fcmToken: fcmToken },
      { new: true }
    );
    
    res.json({ message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.delete('/fcm-token', auth, async (req, res) => {
  try {
    // Clear the FCM token
    await User.findByIdAndUpdate(req.user.id, { fcmToken: null });
    
    res.status(200).json({ 
      message: 'FCM token removed successfully',
      success: true
    });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/login', async (req, res) => {
  try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      
      if (!user || !await user.comparePassword(password)) {
          return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
      );

      // Set both cookie and send token in response
      res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'none', // Change this for cross-origin
          maxAge: 7 * 24 * 60 * 60 * 1000
      });

      const userResponse = user.toObject();
      delete userResponse.password;

      res.json({
          message: 'Login successful',
          user: userResponse,
          token: token, // Add this
          redirectTo: '/'
      });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});

// Update logout route
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('wishlist');
            
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(400).json({ message: error.message });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'phoneNumber', 'address'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({ message: 'Invalid updates' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        updates.forEach(update => user[update] = req.body[update]);
        await user.save();

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(400).json({ message: error.message });
    }
});

router.get('/wishlist', auth, async (req, res) => {
  try {
      const user = await User.findById(req.user._id).populate('wishlist');
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }
      res.json({ wishlist: user.wishlist });
  } catch (error) {
      console.error('Error fetching wishlist:', error);
      res.status(500).json({ message: 'Error fetching wishlist' });
  }
});

// Modify the add to wishlist route
router.post('/wishlist/add', auth, async (req, res) => {
  try {
      const { productId } = req.body;
      if (!productId) {
          return res.status(400).json({ message: 'Product ID is required' });
      }

      // First check if product exists
      const product = await Product.findById(productId);
      if (!product) {
          return res.status(404).json({ message: 'Product not found' });
      }

      // Use findByIdAndUpdate instead of separate save and find operations
      const updatedUser = await User.findByIdAndUpdate(
          req.user._id,
          { 
              $addToSet: { wishlist: productId } // Use $addToSet to prevent duplicates
          },
          { 
              new: true, // Return updated document
              runValidators: true 
          }
      ).populate('wishlist');

      if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
      }

      res.json({ wishlist: updatedUser.wishlist });
  } catch (error) {
      console.error('Error adding to wishlist:', error);
      res.status(500).json({ message: 'Error adding to wishlist' });
  }
});

// Modify the remove from wishlist route
router.delete('/wishlist/:productId', auth, async (req, res) => {
  try {
      const updatedUser = await User.findByIdAndUpdate(
          req.user._id,
          { 
              $pull: { wishlist: req.params.productId } 
          },
          { 
              new: true,
              runValidators: true 
          }
      ).populate('wishlist');

      if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
      }

      res.json({ wishlist: updatedUser.wishlist });
  } catch (error) {
      console.error('Error removing from wishlist:', error);
      res.status(500).json({ message: 'Error removing from wishlist' });
  }
});


router.post('/create-admin', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(400).json({ message: 'Admin user already exists' });
        }

        const adminUser = new User({
            name: 'Admin',
            email: 'admin@example.com',
            password: 'Admin123!',
            role: 'admin',
            phoneNumber: '1234567890',
            address: 'Admin Address'
        });

        await adminUser.save();
        res.status(201).json({ message: 'Admin user created successfully' });
    } catch (error) {
        console.error('Admin creation error:', error);
        res.status(400).json({ message: error.message });
    }
});

const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profile-images/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'));
    }
  }
});

// Profile image upload
router.post('/profile-image', auth, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const user = await User.findById(req.user._id);
    user.profileImage = `/uploads/profile-images/${req.file.filename}`;
    await user.save();

    res.json({ 
      message: 'Profile image uploaded successfully',
      imageUrl: user.profileImage 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Address management
router.post('/addresses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // If setting as default, unset other default addresses
    if (req.body.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }
    
    user.addresses.push(req.body);
    await user.save();

    res.status(201).json({ 
      message: 'Address added successfully',
      addresses: user.addresses 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/addresses/:addressId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // If setting as default, unset other default addresses
    if (req.body.isDefault && !address.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    Object.assign(address, req.body);
    await user.save();

    res.json({
      message: 'Address updated successfully',
      addresses: user.addresses
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/addresses/:addressId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses.pull(req.params.addressId);
    await user.save();

    res.json({
      message: 'Address deleted successfully',
      addresses: user.addresses
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Password update
router.post('/update-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Account deletion
router.delete('/account', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    // You might want to also delete related data (orders, reviews, etc.)
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Email verification
router.post('/send-verification', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.verificationToken = token;
    await user.save();

    // Send verification email (implement email sending logic)
    
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send password reset email (implement email sending logic)

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
// Create initial admin user (development only)
router.post('/create-admin', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(400).json({ message: 'Admin user already exists' });
        }

        const adminUser = new User({
            name: 'Admin',
            email: 'admin@example.com',
            password: 'admin123',
            role: 'admin',
            phoneNumber: '1234567890',
            address: 'Admin Address'
        });

        await adminUser.save();
        res.status(201).json({ message: 'Admin user created successfully' });
    } catch (error) {
        console.error('Admin creation error:', error);
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;