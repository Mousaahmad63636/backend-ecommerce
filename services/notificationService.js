// backend/services/notificationService.js
const User = require('../models/User');
const admin = require('../firebase-config');

/**
 * Send notification for new orders to all admin devices
 * @param {Object} order - The new order object
 */
async function sendNewOrderNotification(order) {
  try {
    // Get all admin FCM tokens
    const adminTokens = await User.getAdminFCMTokens();
    
    if (!adminTokens || adminTokens.length === 0) {
      console.log('No admin users with FCM tokens found.');
      return;
    }
    
    console.log(`Found ${adminTokens.length} admin tokens to notify about new order`);
    
    // Create notification payload
    const message = {
      tokens: adminTokens,
      notification: {
        title: 'New Order Received!',
        body: `Order #${order.orderId} from ${order.customerName} - ${order.totalAmount.toFixed(2)}`,
      },
      data: {
        orderId: order._id.toString(),
        type: 'new_order',
        title: 'New Order Received!',
        message: `Order #${order.orderId} from ${order.customerName}`,
        click_action: 'OPEN_ORDER_ACTIVITY'
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'order_notifications',
          clickAction: 'OPEN_ORDER_ACTIVITY'
        }
      },
    };

    // Send message using sendMulticast (not sendAll)
    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`Successfully sent notifications to ${response.successCount} devices for order #${order.orderId}`);
    
    // Log tokens that caused failures
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(adminTokens[idx]);
          console.error('Failed notification error:', resp.error);
        }
      });
      console.log('Failed tokens:', failedTokens);
    }

    return response;
  } catch (error) {
    console.error('Error sending new order notification:', error);
  }
}

/**
 * Send notification for order status updates to all admin devices
 * @param {Object} order - The updated order object
 */
async function sendOrderStatusNotification(order) {
  try {
    // Get all admin FCM tokens
    const adminTokens = await User.getAdminFCMTokens();
    
    if (!adminTokens || adminTokens.length === 0) {
      console.log('No admin users with FCM tokens found.');
      return;
    }
    
    console.log(`Found ${adminTokens.length} admin tokens to notify about order status update`);
    
    // Create notification payload
    const message = {
      tokens: adminTokens,
      notification: {
        title: 'Order Status Updated',
        body: `Order #${order.orderId} updated to ${order.status}`,
      },
      data: {
        orderId: order._id.toString(),
        type: 'order_status_update',
        title: 'Order Status Updated',
        message: `Order #${order.orderId} is now ${order.status}`,
        click_action: 'OPEN_ORDER_ACTIVITY'
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'order_notifications',
          clickAction: 'OPEN_ORDER_ACTIVITY'
        }
      },
    };

    // Send message
    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`Successfully sent status update notifications to ${response.successCount} devices for order #${order.orderId}`);
    
    return response;
  } catch (error) {
    console.error('Error sending order status notification:', error);
  }
}

module.exports = {
  sendNewOrderNotification,
  sendOrderStatusNotification
};