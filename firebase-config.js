// backend/firebase-config.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

console.log('Starting Firebase initialization...');

function sanitizePrivateKey(key) {
  // If the key is already in the correct format, return it as is
  if (key.startsWith('-----BEGIN PRIVATE KEY-----') && key.includes('\n')) {
    return key;
  }
  
  // Handle the case where newlines are escaped or missing
  let sanitized = key;
  
  // Replace literal \n with actual newlines if they exist
  if (sanitized.includes('\\n')) {
    sanitized = sanitized.replace(/\\n/g, '\n');
  }
  
  // Ensure the key has proper PEM format if it doesn't already
  if (!sanitized.startsWith('-----BEGIN PRIVATE KEY-----')) {
    sanitized = `-----BEGIN PRIVATE KEY-----\n${sanitized}\n-----END PRIVATE KEY-----\n`;
  }
  
  // If key is base64 encoded without proper headers and newlines, format it correctly
  if (!sanitized.includes('\n')) {
    // Extract the base64 content if the headers are already there
    let base64Content = sanitized;
    if (sanitized.includes('-----BEGIN PRIVATE KEY-----')) {
      base64Content = sanitized.replace('-----BEGIN PRIVATE KEY-----', '')
                              .replace('-----END PRIVATE KEY-----', '')
                              .trim();
    }
    
    // Format with proper headers and line breaks (65 chars per line is standard)
    let formattedKey = '-----BEGIN PRIVATE KEY-----\n';
    for (let i = 0; i < base64Content.length; i += 64) {
      formattedKey += base64Content.substring(i, i + 64) + '\n';
    }
    formattedKey += '-----END PRIVATE KEY-----\n';
    sanitized = formattedKey;
  }
  
  return sanitized;
}

try {
  // Method 1: Try getting credentials from environment variables
  if (process.env.FIREBASE_PROJECT_ID && 
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_PRIVATE_KEY) {
    
    console.log('Using Firebase credentials from environment variables');
    
    // Properly sanitize the private key
    const privateKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    
    // Log a sample of the private key format for debugging (be careful not to expose the full key)
    const keyPreview = privateKey.substring(0, 40) + '...' + 
                       privateKey.substring(privateKey.length - 20);
    console.log('Private key format:', keyPreview);
    
    const serviceAccount = {
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

    // Initialize Firebase with the credentials
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK initialized with environment variables!');
      
      // Test OAuth token generation - this will fail early if credentials are bad
      admin.app().options.credential.getAccessToken()
        .then(() => {
          console.log('✅ Successfully authenticated with Firebase');
        })
        .catch(error => {
          console.error('❌ Firebase authentication error:', error.message);
        });
    }
  } else {
    console.error('Missing required Firebase environment variables');
    console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

module.exports = admin;