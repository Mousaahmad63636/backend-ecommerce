// /opt/render/project/src/firebase-config.js
const admin = require('firebase-admin');
require('dotenv').config();

try {
  // Check if Firebase is already initialized
  if (!admin.apps.length) {
    // Initialize Firebase Admin using environment variables
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_PRIVATE_KEY && 
        process.env.FIREBASE_CLIENT_EMAIL) {
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
      });
      
      console.log('Firebase Admin SDK initialized successfully with environment variables');
    } else {
      console.warn('Firebase configuration environment variables missing. Push notifications will not work.');
    }
  } else {
    console.log('Firebase Admin already initialized');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

module.exports = admin;