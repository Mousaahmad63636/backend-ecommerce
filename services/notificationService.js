// /opt/render/project/src/services/notificationService.js
const admin = require('../firebase-config');

const notificationService = {
  /**
   * Send notification to all admin users about a new order
   * @param {Object} order - The new order object
   */
  sendNewOrderNotification: async function(order) {
    try {
      // First check if Firebase is properly initialized
      if (!admin.apps.length) {
        console.error('Firebase Admin SDK not initialized');
        return;
      }

      // Get FCM tokens for all admin users
      const adminTokens = await require('../models/User').getAdminFCMTokens();
      
      if (!adminTokens || adminTokens.length === 0) {
        console.log('No admin tokens found to notify');
        return;
      }

      console.log(`Found ${adminTokens.length} admin tokens to notify about new order`);

      // Create notification message
      const message = {
        notification: {
          title: 'New Order Received',
          body: `Order #${order.orderId || 'N/A'} from ${order.customerName} has been received.`
        },
        data: {
          orderId: order._id.toString(),
          type: 'new_order',
          title: 'New Order Received',
          message: `Order #${order.orderId || 'N/A'} from ${order.customerName} has been received.`
        }
      };

      // Send notifications individually instead of using sendMulticast
      const sendPromises = adminTokens.map(token => {
        return admin.messaging().send({
          ...message,
          token: token  // Send to individual token
        });
      });

      const results = await Promise.allSettled(sendPromises);
      
      // Count successful and failed notifications
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Notifications sent: ${successCount} successful, ${failureCount} failed`);
      
      // Log specific failures
      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          console.log('Failed to send to token:', adminTokens[idx], 'Error:', result.reason);
        }
      });
      
      return {
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      console.error('Error sending new order notification:', error);
      // Don't throw to prevent disrupting the main order flow
    }
  },

  /**
   * Send notification about order status updates
   * @param {Object} order - The updated order object
   */
  sendOrderStatusNotification: async function(order) {
    try {
      // First check if Firebase is properly initialized
      if (!admin.apps.length) {
        console.error('Firebase Admin SDK not initialized');
        return;
      }

      // Get admin tokens
      const adminTokens = await require('../models/User').getAdminFCMTokens();
      
      if (!adminTokens || adminTokens.length === 0) {
        console.log('No admin tokens found to notify about status update');
        return;
      }

      // Create notification message for status update
      const message = {
        notification: {
          title: 'Order Status Updated',
          body: `Order #${order.orderId || 'N/A'} status changed to ${order.status}.`
        },
        data: {
          orderId: order._id.toString(),
          type: 'order_status_update',
          title: 'Order Status Updated',
          message: `Order #${order.orderId || 'N/A'} status changed to ${order.status}.`
        }
      };

      // Send notifications individually instead of using sendMulticast
      const sendPromises = adminTokens.map(token => {
        return admin.messaging().send({
          ...message,
          token: token  // Send to individual token
        });
      });

      const results = await Promise.allSettled(sendPromises);
      
      // Count successful and failed notifications
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Status notifications sent: ${successCount} successful, ${failureCount} failed`);
      
      return {
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      console.error('Error sending status notification:', error);
      // Don't throw to prevent disrupting the main order flow
    }
  }
};

module.exports = notificationService;