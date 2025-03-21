// backend/routes/firebaseTest.js
const router = require('express').Router();
const admin = require('../firebase-config');

router.get('/', (req, res) => {
  try {
    if (!admin.apps || !admin.apps.length) {
      return res.status(500).json({ 
        error: 'Firebase Admin SDK not initialized',
        initialized: false
      });
    }
    
    res.json({ 
      initialized: true,
      message: 'Firebase Admin SDK is properly initialized',
      apps: admin.apps.length 
    });
  } catch (error) {
    console.error('Firebase test error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;