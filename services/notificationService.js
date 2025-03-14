// /opt/render/project/src/services/notificationService.js
const admin = require('../firebase-config');
const User = require('../models/User');

const notificationService = {
  /**
   * Send notification to all admin users about a new order
   * @param {Object} order - The new order object
   */
  sendNewOrderNotification: async function(order) {
    try {
      // Check if Firebase messaging is available
      if (!admin.messaging) {
        console.error('Firebase messaging is not available - admin object:', admin);
        return;
      }

      // Get FCM tokens for all admin users
      const adminTokens = await User.getAdminFCMTokens();
      
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
        },
        tokens: adminTokens // Array of tokens
      };

      // Send the message using the messaging service
      const messagingService = admin.messaging();
      console.log('Messaging service initialized:', messagingService);
      
      const response = await messagingService.sendMulticast(message);
      
      console.log(`Notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.log('Failed to send to token:', adminTokens[idx], 'Error:', resp.error);
          }
        });
      }
      
      return response;
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
      // Check if Firebase messaging is available
      if (!admin.messaging) {
        console.error('Firebase messaging is not available');
        return;
      }

      // Get admin tokens
      const adminTokens = await User.getAdminFCMTokens();
      
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
        },
        tokens: adminTokens
      };

      // Send the message
      const messagingService = admin.messaging();
      const response = await messagingService.sendMulticast(message);
      
      console.log(`Status notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
      
      return response;
    } catch (error) {
      console.error('Error sending status notification:', error);
      // Don't throw to prevent disrupting the main order flow
    }
  }
};

module.exports = notificationService;