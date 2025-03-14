// backend/firebase-config.js
const admin = require('firebase-admin');
require('dotenv').config();

// Singleton pattern to ensure Firebase is only initialized once
let firebaseApp = null;

try {
  // Check if environment variables are available
  if (process.env.FIREBASE_PROJECT_ID && 
      process.env.FIREBASE_PRIVATE_KEY && 
      process.env.FIREBASE_CLIENT_EMAIL) {
    
    // Initialize Firebase Admin SDK
    firebaseApp = admin.initializeApp({
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
} catch (error) {
  console.error('Firebase initialization error:', error);
}

module.exports = admin;