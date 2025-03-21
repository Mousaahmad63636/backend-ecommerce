const router = require('express').Router();
const PromoCode = require('../models/PromoCode');
const { adminAuth, auth } = require('../middleware/auth');

// Get all promo codes (admin only)
router.get('/', adminAuth, async (req, res) => {
    try {
        const promoCodes = await PromoCode.find().sort('-createdAt');
        res.json(promoCodes);
    } catch (error) {
        console.error('Error fetching promo codes:', error);
        res.status(500).json({ message: error.message });
    }
});

// backend/routes/promoCodes.js
router.post('/', adminAuth, async (req, res) => {
    try {
        console.log('Received promo data:', req.body); // Debug log

        // Validate required fields
        const requiredFields = ['code', 'description', 'discountType', 'discountValue', 'endDate'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        const promoCode = new PromoCode({
            code: req.body.code.toUpperCase(),
            description: req.body.description,
            discountType: req.body.discountType,
            discountValue: Number(req.body.discountValue),
            minimumPurchase: Number(req.body.minimumPurchase) || 0,
            startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
            endDate: new Date(req.body.endDate),
            usageLimit: req.body.usageLimit ? Number(req.body.usageLimit) : undefined,
            isActive: req.body.isActive !== undefined ? req.body.isActive : true
        });

        const savedPromoCode = await promoCode.save();
        res.status(201).json(savedPromoCode);
    } catch (error) {
        console.error('Error creating promo code:', error);
        res.status(400).json({ 
            message: error.message || 'Error creating promo code',
            details: error.errors || {}
        });
    }
});

// Update promo code (admin only)
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const updates = req.body;
        const promoCode = await PromoCode.findById(req.params.id);

        if (!promoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            if (key === 'discountValue' || key === 'minimumPurchase' || key === 'usageLimit') {
                promoCode[key] = Number(updates[key]);
            } else if (key === 'startDate' || key === 'endDate') {
                promoCode[key] = new Date(updates[key]);
            } else {
                promoCode[key] = updates[key];
            }
        });

        const updatedPromoCode = await promoCode.save();
        res.json(updatedPromoCode);
    } catch (error) {
        console.error('Error updating promo code:', error);
        res.status(400).json({ message: error.message });
    }
});

// Delete promo code (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const promoCode = await PromoCode.findByIdAndDelete(req.params.id);
        if (!promoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }
        res.json({ message: 'Promo code deleted successfully' });
    } catch (error) {
        console.error('Error deleting promo code:', error);
        res.status(500).json({ message: error.message });
    }
});

// Validate promo code (public)
router.post('/validate', async (req, res) => {
    try {
        const { code, cartTotal } = req.body;

        const promoCode = await PromoCode.findOne({
            code: code.toUpperCase(),
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        if (!promoCode) {
            return res.status(400).json({ message: 'Invalid or expired promo code' });
        }

        // Check minimum purchase if cartTotal is provided
        if (cartTotal && promoCode.minimumPurchase > cartTotal) {
            return res.status(400).json({ 
                message: `Minimum purchase of $${promoCode.minimumPurchase} required` 
            });
        }

        res.json({
            success: true,
            discount: {
                type: promoCode.discountType,
                value: promoCode.discountValue,
                minimumPurchase: promoCode.minimumPurchase
            },
            message: `${promoCode.discountType === 'percentage' ? 
                     promoCode.discountValue + '%' : 
                     '$' + promoCode.discountValue} discount applied`
        });

    } catch (error) {
        console.error('Promo code validation error:', error);
        res.status(500).json({ message: 'Error validating promo code' });
    }
});

module.exports = router;