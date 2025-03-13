// backend/services/notificationService.js

const admin = require('../firebase-config');
const User = require('../models/User');

const notificationService = {
  async sendNewOrderNotification(order) {
    try {
      // Find all admin users with FCM tokens
      const adminUsers = await User.find({
        role: 'admin',
        fcmToken: { $ne: null }
      });
      
      if (adminUsers.length === 0) {
        console.log('No admin users with FCM tokens found');
        return;
      }
      
      const messages = adminUsers.map(user => ({
        token: user.fcmToken,
        notification: {
          title: 'New Order Received',
          body: `Order #${order.orderId || order._id} placed by ${order.customerName}`
        },
        data: {
          orderId: order._id.toString(),
          customerName: order.customerName,
          orderAmount: order.totalAmount.toString(),
          type: 'NEW_ORDER'
        }
      }));
      
      // Send notifications to all admin users
      const response = await admin.messaging().sendAll(messages);
      console.log(`Successfully sent ${response.successCount} notifications to admin users`);
      
    } catch (error) {
      console.error('Error sending new order notification:', error);
    }
  },
  
  async sendOrderStatusNotification(order) {
    // This can be implemented similarly for status updates
    try {
      // Logic for sending status update notifications
      console.log(`Status notification triggered for Order #${order.orderId || order._id}`);
    } catch (error) {
      console.error('Error sending status notification:', error);
    }
  }
};

module.exports = notificationService;