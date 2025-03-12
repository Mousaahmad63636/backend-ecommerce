// backend/services/notificationService.js
const admin = require('../firebase-config');
const User = require('../models/User');

const notificationService = {
  /**
   * Send notification for new order
   * @param {Object} order - The order object
   */
  sendNewOrderNotification: async (order) => {
    try {
      // Get all admin users
      const adminUsers = await User.find({ role: 'admin', fcmToken: { $ne: null } });
      
      // Extract FCM tokens
      const adminTokens = adminUsers.map(user => user.fcmToken).filter(Boolean);
      
      if (adminTokens.length === 0) {
        console.log('No admin FCM tokens found. Skipping notification.');
        return;
      }
      
      // Format the order total with 2 decimal places
      const formattedTotal = order.totalAmount ? order.totalAmount.toFixed(2) : '0.00';
      
      // Build notification
      const notification = {
        title: 'New Order Received',
        body: `Order #${order.orderId || order._id} from ${order.customerName} - $${formattedTotal}`
      };
      
      // Additional data payload
      const data = {
        type: 'new_order',
        orderId: order._id.toString(),
        customerName: order.customerName,
        total: formattedTotal,
        timestamp: new Date().toISOString()
      };
      
      // Send to all admin tokens
      const sendPromises = adminTokens.map(token => {
        return admin.messaging().send({
          token,
          notification,
          data
        }).catch(error => {
          console.error(`Error sending to token ${token}:`, error);
          
          // Handle invalid tokens by removing them
          if (error.code === 'messaging/invalid-registration-token' || 
              error.code === 'messaging/registration-token-not-registered') {
            return User.updateOne(
              { fcmToken: token },
              { $set: { fcmToken: null } }
            );
          }
          return Promise.resolve();
        });
      });
      
      await Promise.all(sendPromises);
      console.log(`New order notifications sent to ${adminTokens.length} admins`);
    } catch (error) {
      console.error('Error sending new order notification:', error);
    }
  },
  
  /**
   * Send notification for order status update
   * @param {Object} order - The updated order object
   */
  sendOrderStatusNotification: async (order) => {
    try {
      // Get all admin users
      const adminUsers = await User.find({ role: 'admin', fcmToken: { $ne: null } });
      
      // Extract FCM tokens
      const adminTokens = adminUsers.map(user => user.fcmToken).filter(Boolean);
      
      if (adminTokens.length === 0) {
        console.log('No admin FCM tokens found. Skipping notification.');
        return;
      }
      
      // Build notification
      const notification = {
        title: 'Order Status Updated',
        body: `Order #${order.orderId || order._id} is now ${order.status}`
      };
      
      // Additional data payload
      const data = {
        type: 'order_status_update',
        orderId: order._id.toString(),
        status: order.status,
        timestamp: new Date().toISOString()
      };
      
      // Send to all admin tokens
      const sendPromises = adminTokens.map(token => {
        return admin.messaging().send({
          token,
          notification,
          data
        }).catch(error => {
          if (error.code === 'messaging/invalid-registration-token' || 
              error.code === 'messaging/registration-token-not-registered') {
            return User.updateOne(
              { fcmToken: token },
              { $set: { fcmToken: null } }
            );
          }
          return Promise.resolve();
        });
      });
      
      await Promise.all(sendPromises);
      console.log(`Status update notifications sent to ${adminTokens.length} admins`);
    } catch (error) {
      console.error('Error sending status update notification:', error);
    }
  }
};

module.exports = notificationService;