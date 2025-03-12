const router = require('express').Router();
const Timer = require('../models/Timer');
const { adminAuth } = require('../middleware/auth');
const cors = require('cors');

// Apply CORS for this route
router.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Get active timer
router.get('/', async (req, res) => {
  try {
      const timer = await Timer.findOne().sort({ createdAt: -1 });
      res.status(200).json(timer);
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});
// Create or update timer (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    // Deactivate any existing timers
    await Timer.updateMany({}, { isActive: false });

    const timer = new Timer({
      title: req.body.title,
      endDate: new Date(req.body.endDate),
      isActive: true
    });

    await timer.save();
    res.status(201).json(timer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete timer (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Timer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Timer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;