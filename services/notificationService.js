// backend/services/notificationService.js
const admin = require('../firebase-config');
const User = require('../models/User');

/**
 * Get all admin FCM tokens
 * @returns {Promise<string[]>} Array of FCM tokens
 */
async function getAdminTokens() {
  try {
    const admins = await User.find({
      role: 'admin',
      fcmToken: { $ne: null, $ne: '' }
    });
    
    const tokens = admins
      .filter(admin => admin.fcmToken && admin.fcmToken.trim() !== '')
      .map(admin => admin.fcmToken);
    
    console.log(`Found ${tokens.length} admin tokens for notifications`);
    return tokens;
  } catch (error) {
    console.error('Error fetching admin tokens:', error);
    return [];
  }
}

/**
 * Check if Firebase is properly initialized
 * @returns {boolean} Whether Firebase is initialized
 */
function isFirebaseInitialized() {
  return admin && admin.apps && admin.apps.length > 0;
}

/**
 * Send notification when a new order is created
 * @param {Object} order - The newly created order
 * @returns {Promise<void>}
 */
async function sendNewOrderNotification(order) {
  try {
    console.log('Attempting to send new order notification...');
    
    // Check if Firebase is initialized
    if (!isFirebaseInitialized()) {
      console.error('❌ Cannot send notification: Firebase not initialized');
      return;
    }
    
    // Access the messaging service
    let messaging;
    try {
      messaging = admin.messaging();
      if (!messaging) {
        console.error('Firebase Admin SDK messaging() returned null');
        return;
      }
      console.log('Firebase messaging service successfully accessed');
    } catch (error) {
      console.error('Error accessing Firebase messaging:', error);
      return;
    }
    
    const adminTokens = await getAdminTokens();
    if (!adminTokens || adminTokens.length === 0) {
      console.log('No admin tokens found, skipping notification');
      return;
    }

    const orderIdDisplay = order.orderId || order._id;
    const amountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(order.totalAmount);

    // Create notification payload for single recipient
    const message = {
      notification: {
        title: '🛍️ New Order Received!',
        body: `Order #${orderIdDisplay} - ${amountFormatted} from ${order.customerName}`
      },
      data: {
        type: 'new_order',
        orderId: order._id.toString(),
        title: 'New Order',
        message: `Order #${orderIdDisplay} - ${amountFormatted}`,
        click_action: 'OPEN_ORDER_DETAIL'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'order_notifications',
          priority: 'high',
          color: '#6200EE'
        }
      }
    };

    // Send the message to each admin individually
    console.log(`Sending notification to ${adminTokens.length} admin devices`);
    const sendPromises = adminTokens.map(token => {
      try {
        // Use send() method instead of sendMulticast()
        return messaging.send({
          ...message,
          token: token // Individual token for each message
        }).then(response => {
          console.log(`Successfully sent message to token: ${token.substring(0, 10)}...`);
          return { success: true, response };
        }).catch(error => {
          console.error(`Error sending to token ${token.substring(0, 10)}...`, error);
          return { success: false, error };
        });
      } catch (err) {
        console.error(`Error preparing message for token ${token.substring(0, 10)}...`, err);
        return Promise.resolve({ success: false, error: err });
      }
    });
    
    // Wait for all messages to be sent
    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    console.log(`Successfully sent ${successCount} of ${adminTokens.length} messages`);
    
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Send notification when an order status is updated
 * @param {Object} order - The updated order
 * @returns {Promise<void>}
 */
async function sendOrderStatusNotification(order) {
  try {
    console.log('Attempting to send status update notification...');
    
    // Check if Firebase is initialized
    if (!isFirebaseInitialized()) {
      console.error('❌ Cannot send status notification: Firebase not initialized');
      return;
    }
    
    // Access the messaging service
    let messaging;
    try {
      messaging = admin.messaging();
      if (!messaging) {
        console.error('Firebase Admin SDK messaging() returned null');
        return;
      }
    } catch (error) {
      console.error('Error accessing Firebase messaging:', error);
      return;
    }
    
    const adminTokens = await getAdminTokens();
    if (!adminTokens || adminTokens.length === 0) {
      console.log('No admin tokens found, skipping notification');
      return;
    }

    const orderIdDisplay = order.orderId || order._id;
    
    // Create notification payload
    const message = {
      notification: {
        title: '📦 Order Status Updated',
        body: `Order #${orderIdDisplay} is now ${order.status}`
      },
      data: {
        type: 'order_status_update',
        orderId: order._id.toString(),
        title: 'Status Update',
        message: `Order #${orderIdDisplay} is now ${order.status}`,
        status: order.status,
        click_action: 'OPEN_ORDER_DETAIL'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'order_notifications',
          priority: 'high',
          color: '#6200EE'
        }
      }
    };

    // Send the message to each admin individually
    console.log(`Sending status notification to ${adminTokens.length} admin devices`);
    const sendPromises = adminTokens.map(token => {
      try {
        // Use send() method instead of sendMulticast()
        return messaging.send({
          ...message,
          token: token // Individual token for each message
        }).then(response => {
          console.log(`Successfully sent status update to token: ${token.substring(0, 10)}...`);
          return { success: true, response };
        }).catch(error => {
          console.error(`Error sending status update to token ${token.substring(0, 10)}...`, error);
          return { success: false, error };
        });
      } catch (err) {
        console.error(`Error preparing status message for token ${token.substring(0, 10)}...`, err);
        return Promise.resolve({ success: false, error: err });
      }
    });
    
    // Wait for all messages to be sent
    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    console.log(`Successfully sent ${successCount} of ${adminTokens.length} status updates`);
    
  } catch (error) {
    console.error('Error sending status notification:', error);
  }
}

module.exports = {
  sendNewOrderNotification,
  sendOrderStatusNotification,
  getAdminTokens,
  isFirebaseInitialized
};