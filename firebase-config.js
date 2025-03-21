// backend/firebase-config.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

console.log('Starting Firebase initialization...');

// Check for Firebase service account details
let serviceAccount;
let firebaseInitialized = false;

try {
  // Method 1: Try getting credentials from environment variables
  if (process.env.FIREBASE_PROJECT_ID && 
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_PRIVATE_KEY) {
    
    console.log('Using Firebase credentials from environment variables');
    
    // Format private key properly - env vars often escape newlines
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      console.log('Reformatted private key newlines');
    }
    
    serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
    };
  } 
  // Method 2: Check for service account JSON file
  else {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                              path.join(__dirname, 'service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      console.log(`Loading Firebase service account from: ${serviceAccountPath}`);
      serviceAccount = require(serviceAccountPath);
    } else {
      console.error('Firebase credentials not found. Missing environment variables or service account file.');
      console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    }
  }
  
  // Initialize Firebase if we have credentials
  if (serviceAccount) {
    // Check if already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      // Test if initialization worked
      if (admin.apps.length > 0) {
        firebaseInitialized = true;
        console.log('✅ Firebase Admin SDK initialized successfully!');
        
        // Test the messaging service
        try {
          const messaging = admin.messaging();
          console.log('✅ Firebase Messaging service is available');
        } catch (msgError) {
          console.error('❌ Firebase Messaging error:', msgError.message);
        }
      } else {
        console.error('❌ Firebase initialization failed - no apps created');
      }
    } else {
      firebaseInitialized = true;
      console.log('Firebase Admin SDK already initialized');
    }
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

if (!firebaseInitialized) {
  console.error('⚠️ WARNING: Firebase is not initialized. Notifications will not work!');
}

module.exports = admin;