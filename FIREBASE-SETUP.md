# Firebase Setup Guide for Notifications

This guide helps you set up Firebase for the admin app notifications.

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup steps
3. Make note of your Project ID for later

## 2. Generate a new Service Account Key

1. In Firebase Console, go to Project Settings > Service accounts
2. Click "Generate new private key" button
3. Save the JSON file securely - it contains sensitive credentials!

## 3. Set the Environment Variables

You need to set these environment variables on your server: