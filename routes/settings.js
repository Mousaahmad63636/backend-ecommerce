const router = require('express').Router();
const Settings = require('../models/Settings');
const { adminAuth } = require('../middleware/auth');
const { heroUpload } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// Public route for getting settings
router.get('/', async (req, res) => {
    try {
        console.log('Fetching settings...');
        let settings = await Settings.findOne();
        console.log('Found settings:', settings);
        if (!settings) {
            settings = await new Settings().save();
        }
        res.json(settings);
    } catch (error) {
        console.error('Settings fetch error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Admin route for updating hero section
router.put('/hero', adminAuth, heroUpload.single('media'), async (req, res) => {
    try {
        const { type, title, subtitle } = req.body;
        const updateData = {
            'heroSection.type': type,
            'heroSection.title': title,
            'heroSection.subtitle': subtitle
        };

        // If a new file is uploaded
        if (req.file) {
            // Get current settings to check for existing file
            const currentSettings = await Settings.findOne();
            
            // Delete old file if it exists
            if (currentSettings?.heroSection?.mediaUrl) {
                const oldFilePath = path.join(__dirname, '..', currentSettings.heroSection.mediaUrl);
                if (fs.existsSync(oldFilePath)) {
                    try {
                        fs.unlinkSync(oldFilePath);
                    } catch (err) {
                        console.error('Error deleting old hero file:', err);
                    }
                }
            }

            // Update with new file path
            updateData['heroSection.mediaUrl'] = `/uploads/hero/${req.file.filename}`;
        }

        const settings = await Settings.findOneAndUpdate(
            {},
            { $set: updateData },
            { new: true, upsert: true }
        );

        res.json(settings);
    } catch (error) {
        console.error('Error updating hero settings:', error);
        
        // Delete uploaded file if there's an error
        if (req.file) {
            const filePath = path.join(__dirname, '..', 'uploads', 'hero', req.file.filename);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error('Error deleting uploaded file:', err);
                }
            }
        }
        
        res.status(400).json({ message: error.message });
    }
});

// Admin route for updating general settings
router.put('/', adminAuth, async (req, res) => {
    try {
        const settings = await Settings.findOneAndUpdate(
            {},
            { $set: req.body },
            { new: true, upsert: true }
        );
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;