const router = require('express').Router();
const Settings = require('../models/Settings');
const { adminAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get settings
router.get('/', adminAuth, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await new Settings().save();
        }
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/hero', adminAuth, upload.single('media'), async (req, res) => {
    try {
      const { type, title, subtitle } = req.body;
      const updateData = {
        'heroSection.type': type,
        'heroSection.title': title,
        'heroSection.subtitle': subtitle
      };
  
      if (req.file) {
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
      res.status(400).json({ message: error.message });
    }
  });

// Update settings
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