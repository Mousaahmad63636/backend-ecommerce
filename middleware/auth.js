// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 */

// backend/middleware/auth.js
const auth = async (req, res, next) => {
  try {
      const token = req.cookies.token;
      
      if (!token) {
          return res.status(401).json({ message: 'Access denied. No token provided.' });
      }

      try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.userId)
              .select('-password')
              .lean();

          if (!user) {
              return res.status(401).json({ message: 'Invalid token. User not found.' });
          }

          if (user.status !== 'active') {
              return res.status(403).json({ message: 'Account is not active.' });
          }

          req.user = user;
          next();
      } catch (error) {
          return res.status(401).json({ message: 'Invalid token' });
      }
  } catch (error) {
      res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Admin authentication middleware
 * Verifies user is authenticated and has admin role
 */
// middleware/auth.js
const adminAuth = async (req, res, next) => {
  try {
      // First run regular auth
      await auth(req, res, async () => {
          if (!req.user || req.user.role !== 'admin') {
              return res.status(403).json({
                  message: 'Access denied. Admin privileges required.'
              });
          }
          next();
      });
  } catch (error) {
      console.error('Admin auth error:', error);
      res.status(500).json({ message: 'Authentication error' });
  }
};

/**
 * Optional auth middleware
 * Attaches user to request if token is valid, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password').lean();
      if (user && user.status === 'active') {
        req.user = user;
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // Don't throw error for optional auth, just continue without user
    next();
  }
};

module.exports = { auth, adminAuth, optionalAuth };