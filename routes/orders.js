const router = require('express').Router();
const { auth } = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const PromoCode = require('../models/PromoCode');
const notificationService = require('../services/notificationService');

router.route('/').get(async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('products.product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(400).json('Error: ' + err.message);
  }
});
router.post('/validate-promo', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() }
    });

    if (!promoCode) {
      return res.status(400).json({ message: 'Invalid or expired promo code' });
    }

    // Check usage limit
    if (promoCode.usageLimit && promoCode.usedCount >= promoCode.usageLimit) {
      return res.status(400).json({ message: 'Promo code has reached its usage limit' });
    }

    let discount;
    switch (promoCode.discountType) {
      case 'percentage':
        discount = promoCode.discountValue;
        break;
      case 'fixed':
        // For fixed amounts, we'll convert to a percentage based on minimum purchase
        discount = (promoCode.discountValue / promoCode.minimumPurchase) * 100;
        break;
      case 'shipping':
        discount = 100; // Free shipping
        break;
      default:
        discount = 0;
    }

    res.json({
      success: true,
      discount,
      type: promoCode.discountType,
      minimumPurchase: promoCode.minimumPurchase,
      message: 'Promo code valid'
    });

  } catch (error) {
    console.error('Promo validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating promo code'
    });
  }
});
// Add this to your routes/users.js file
router.get('/admin-tokens', auth, async (req, res) => {
  try {
    // Verify the user is an admin
    if (!req.user.role || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const adminTokens = await User.getAdminFCMTokens();
    
    res.json({
      success: true,
      count: adminTokens.length,
      tokens: adminTokens.map(token => token.substring(0, 10) + '...') // Only return partial tokens for security
    });
  } catch (error) {
    console.error('Error getting admin tokens:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/', async (req, res) => {
  try {
    // Validate the request body
    if (!req.body.products || !Array.isArray(req.body.products) || req.body.products.length === 0) {
      return res.status(400).json({ message: 'Error: No products in order' });
    }

    const {
      products,
      subtotal,
      shippingFee,
      promoDiscount = 0,
      totalAmount,
      specialInstructions = '',
      customerName,
      customerEmail,
      phoneNumber,
      address
    } = req.body;

    // Create the new order
    const newOrder = new Order({
      products,
      subtotal,
      shippingFee,
      promoDiscount,
      totalAmount,
      specialInstructions,
      customerName,
      customerEmail,
      phoneNumber,
      address,
      status: 'Pending'
    });

    // Save the order
    const savedOrder = await newOrder.save();

    // Update product sales counts
    for (const item of products) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { salesCount: item.quantity } }
      );
    }
    
    await notificationService.sendNewOrderNotification(savedOrder);

    // Populate the products in the saved order
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('products.product');

    res.status(201).json({
      message: 'Order placed successfully!',
      order: populatedOrder
    });

  } catch (err) {
    console.error('Order creation error:', err);
    res.status(400).json({
      message: 'Failed to create order',
      error: err.message
    });
  }
});

// backend/routes/orders.js (excerpt with changes)
// Create guest order route
router.post('/guest', async (req, res) => {
  try {
    const {
      products,
      subtotal,
      shippingFee,
      promoCode,
      promoDiscount,
      totalAmount,
      customerName,
      customerEmail,
      phoneNumber,
      address,
      specialInstructions
    } = req.body;

    // Validate required fields
    if (!products || !products.length) {
      return res.status(400).json({ message: 'No products in order' });
    }

    // Check if products have the necessary information
    for (const item of products) {
      if (!item.product || !item.quantity || !item.price) {
        return res.status(400).json({ message: 'Invalid product information' });
      }
    }

    // Remove email from required fields check
    if (!customerName || !phoneNumber || !address) {
      return res.status(400).json({ message: 'Missing customer information' });
    }
    
    const orderData = {
      products: products.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor || '',
        selectedSize: item.selectedSize || ''
      })),
      subtotal,
      shippingFee,
      totalAmount,
      customerName,
      phoneNumber,
      address,
      specialInstructions,
      status: 'Pending'
    };

    // Only add email if it exists
    if (customerEmail) {
      orderData.customerEmail = customerEmail;
    }

    // Only add promo fields if they exist
    if (promoCode) {
      orderData.promoCode = promoCode;
    }

    if (promoDiscount) {
      orderData.promoDiscount = {
        type: promoDiscount.type,
        value: Number(promoDiscount.value)
      };
    }

    const order = new Order(orderData);
    const savedOrder = await order.save();
    
    // Send notification AFTER the order is created
    await notificationService.sendNewOrderNotification(savedOrder);

    res.status(201).json({
      message: 'Order created successfully',
      order: savedOrder
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({
      message: 'Failed to create order',
      error: error.message
    });
  }
});

router.get('/guest/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email } = req.query;

    const order = await Order.findOne({
      _id: orderId,
      customerEmail: email
    }).populate('products.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
router.route('/').post(async (req, res) => {
  try {
    // Validate the request body
    if (!req.body.products || !Array.isArray(req.body.products) || req.body.products.length === 0) {
      return res.status(400).json({ message: 'Error: No products in order' });
    }

    const {
      products,
      subtotal,
      shippingFee,
      promoDiscount = 0,
      totalAmount,
      specialInstructions = '',
      customerName,
      customerEmail,
      phoneNumber,
      address
    } = req.body;

    // Create the new order
    const newOrder = new Order({
      products,
      subtotal,
      shippingFee,
      promoDiscount,
      totalAmount,
      specialInstructions,
      customerName,
      customerEmail,
      phoneNumber,
      address
    });

    // Save the order
    const savedOrder = await newOrder.save();

    // Update product sales counts
    for (const item of products) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { salesCount: item.quantity } }
      );
    }

    // Populate the products in the saved order
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('products.product');

    res.status(201).json({
      message: 'Order placed successfully!',
      order: populatedOrder
    });

  } catch (err) {
    console.error('Order creation error:', err);
    res.status(400).json({
      message: 'Failed to create order',
      error: err.message
    });
  }
});

router.get('/my-orders', auth, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const orders = await Order.find({ customerEmail: req.user.email })
      .populate('products.product')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(400).json({ message: err.message });
  }
});

// Get specific order
router.route('/:id').get(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('products.product');
    if (!order) {
      return res.status(404).json({ message: 'Error: Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update order status
router.route('/:id').put(async (req, res) => {
  try {
    // Find the order by ID
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Error: Order not found' });
    }

    // Validate the status
    const validStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
    if (req.body.status && !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: 'Error: Invalid status' });
    }

    // Store previous status to check if it changed
    const previousStatus = order.status;

    // Update the order status if provided
    if (req.body.status) {
      order.status = req.body.status;
    }

    // Update other fields if provided
    if (req.body.shippingFee !== undefined) {
      order.shippingFee = req.body.shippingFee;
    }
    
    if (req.body.promoCode !== undefined) {
      order.promoCode = req.body.promoCode;
    }
    
    if (req.body.promoDiscount !== undefined) {
      order.promoDiscount = req.body.promoDiscount;
    }
    
    if (req.body.specialInstructions !== undefined) {
      order.specialInstructions = req.body.specialInstructions;
    }
    
    if (req.body.address !== undefined) {
      order.address = req.body.address;
    }
    
    if (req.body.phoneNumber !== undefined) {
      order.phoneNumber = req.body.phoneNumber;
    }

    // Recalculate total amount if necessary
    if (req.body.shippingFee !== undefined || req.body.promoDiscount !== undefined || req.body.subtotal !== undefined) {
      // If subtotal is provided, update it
      if (req.body.subtotal !== undefined) {
        order.subtotal = req.body.subtotal;
      }
      
      // Calculate discount amount
      const discountValue = order.promoDiscount || 0;
      const discountAmount = (order.subtotal * discountValue) / 100;
      
      // Recalculate total
      order.totalAmount = order.subtotal - discountAmount + order.shippingFee;
    }

    // Save the updated order
    await order.save();

    // Fetch the updated order with populated fields
    const updatedOrder = await Order.findById(req.params.id)
      .populate('products.product');

    // Send notification if status was changed
    if (previousStatus !== order.status) {
      try {
        await notificationService.sendOrderStatusNotification(updatedOrder);
        console.log(`Status notification sent for Order #${updatedOrder.orderId || updatedOrder._id}`);
      } catch (notificationError) {
        // Log notification error but don't fail the request
        console.error('Failed to send status notification:', notificationError);
      }
    }

    // Send the response
    res.json({
      message: 'Order updated successfully!',
      order: updatedOrder
    });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ 
      message: 'Failed to update order',
      error: err.message 
    });
  }
});

// Delete order
router.route('/:id').delete(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Error: Order not found' });
    }

    // Optionally, decrease product sales counts when order is deleted
    for (const item of order.products) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { salesCount: -item.quantity } }
      );
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({
      message: 'Order deleted successfully!'
    });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(400).json({ message: err.message });
  }
});

// Get orders by customer email
router.route('/customer/:email').get(async (req, res) => {
  try {
    const orders = await Order.find({ customerEmail: req.params.email.toLowerCase() })
      .populate('products.product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    res.status(400).json({ message: err.message });
  }
});

// Get order statistics
router.route('/stats/summary').get(async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      ordersByStatus: ordersByStatus.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    });
  } catch (err) {
    console.error('Error fetching order statistics:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;