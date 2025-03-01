// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const Counter = require('./models/Counter');
const timerRoutes = require('./routes/timer');
require('dotenv').config();
const uploadDir = '/backend/uploads/products';
const { DISK_MOUNT_PATH } = require('./middleware/upload');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
// Initialize Express app
const app = express();

// CORS Configuration
const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = [
            'https://spotlylb.com',
            'https://www.spotlylb.com',
            'http://localhost:3000'
        ];
        
        // Allow requests with no origin (like mobile apps, curl requests, WhatsApp crawler)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked by CORS: ', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-access-token',
        'Origin',
        'Accept',
        'X-Requested-With',
        'User-Agent'  // Added to allow WhatsApp crawler to identify itself
    ],
    exposedHeaders: ['*'],
    maxAge: 86400
};

// Apply CORS globally
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Basic Middleware Setup
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { 
        policy: "cross-origin" 
    },
    crossOriginOpenerPolicy: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

// API Request Logging with User-Agent for crawler debugging
app.use((req, res, next) => {
    const userAgent = req.get('User-Agent') || 'Unknown';
    // Log WhatsApp crawler requests separately for debugging
    if (userAgent.includes('WhatsApp') || userAgent.includes('facebookexternalhit')) {
        console.log(`${new Date().toISOString()} - CRAWLER - ${req.method} ${req.originalUrl} - ${userAgent}`);
    } else {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    }
    next();
});

// Special CORS settings for image directories - crucial for WhatsApp crawler
app.use('/uploads', cors({
    origin: '*',  // Allow all origins for image files
    methods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 86400,
    credentials: false,  // Important for public files
}));

// Static Files Setup with proper headers for crawlers
app.use('/uploads', express.static(DISK_MOUNT_PATH, {
    setHeaders: (res, path) => {
        // Set appropriate headers for all files
        res.set({
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Cache-Control': 'public, max-age=31536000'
        });
        
        // Set appropriate image headers for different file types
        if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
            res.set('Content-Type', 'image/jpeg');
        } else if (path.endsWith('.png')) {
            res.set('Content-Type', 'image/png');
        } else if (path.endsWith('.gif')) {
            res.set('Content-Type', 'image/gif');
        } else if (path.endsWith('.webp')) {
            res.set('Content-Type', 'image/webp');
        }
    }
}));

// Set up specific routes for different upload directories
app.use('/uploads/hero', express.static(path.join(DISK_MOUNT_PATH, 'hero')));
app.use('/uploads/products', express.static(path.join(DISK_MOUNT_PATH, 'products')));
app.use('/uploads/profile-images', express.static(path.join(DISK_MOUNT_PATH, 'profile-images')));

// Debug logging for file access - helpful for debugging WhatsApp crawler issues
app.use('/uploads', (req, res, next) => {
    const userAgent = req.get('User-Agent') || 'Unknown';
    console.log('Accessing file:', req.url);
    console.log('Full path:', path.join(DISK_MOUNT_PATH, req.url));
    console.log('User-Agent:', userAgent);
    next();
});

// Verify disk mount path exists and is writable
const verifyDiskMount = () => {
    try {
      if (!fs.existsSync(DISK_MOUNT_PATH)) {
        console.error(`WARNING: Disk mount path ${DISK_MOUNT_PATH} does not exist!`);
        // Create it as a fallback
        fs.mkdirSync(DISK_MOUNT_PATH, { recursive: true });
        console.log(`Created disk mount path ${DISK_MOUNT_PATH}`);
      } else {
        console.log(`Verified disk mount path: ${DISK_MOUNT_PATH}`);
        
        // Test write permissions
        const testFile = path.join(DISK_MOUNT_PATH, 'disk-test.txt');
        fs.writeFileSync(testFile, 'Disk mount test');
        fs.unlinkSync(testFile);
        console.log('Disk mount is writable');
      }
    } catch (error) {
      console.error('CRITICAL ERROR: Disk mount verification failed:', error);
    }
};

// Ensure backup specific routes for different upload directories
app.use('/uploads/hero', express.static(path.join(__dirname, 'uploads/hero')));
app.use('/uploads/products', express.static(path.join(__dirname, 'uploads/products')));
app.use('/uploads/profile-images', express.static(path.join(__dirname, 'uploads/profile-images')));

// Create necessary directories if they don't exist
const directories = [
    path.join(DISK_MOUNT_PATH),
    path.join(DISK_MOUNT_PATH, 'profile-images'),
    path.join(DISK_MOUNT_PATH, 'hero'),
    path.join(DISK_MOUNT_PATH, 'products'),
    path.join(__dirname, 'logs')
];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Logging Setup
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    const logFile = path.join(__dirname, 'logs', 'access.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    app.use(morgan('combined', { stream: logStream }));
}

// Root Route
app.get('/', (req, res) => {
    res.json({
        message: 'API is running',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date(),
        endpoints: [
            '/api/products', 
            '/api/users', 
            '/api/orders', 
            '/api/settings', 
            '/api/promo-codes', 
            '/api/timer',
            '/api/categories'  // Added categories endpoint
        ]
    });
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// API Routes Registration
const routes = {
    users: require('./routes/users'),
    products: require('./routes/products'),
    orders: require('./routes/orders'),
    settings: require('./routes/settings'),
    'promo-codes': require('./routes/promoCodes')
};

// Register API routes
app.use('/api/timer', timerRoutes);
app.use('/api/settings', require('./routes/settings'));
app.use('/api/promo-codes', require('./routes/promoCodes'));
app.use('/api/categories', require('./routes/categories')); // Moved here with other API routes

Object.entries(routes).forEach(([key, router]) => {
    const path = `/api/${key}`;
    app.use(path, router);
    console.log(`Route registered: ${path}`);
});

// Database Connection Setup
async function initializeCounter() {
    try {
        const counter = await Counter.findById('orderId');
        if (!counter) {
            await new Counter({ _id: 'orderId', seq: 0 }).save();
            console.log('Counter initialized');
        }
    } catch (error) {
        console.error('Counter initialization error:', error);
    }
}

async function connectDB() {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        await mongoose.connect(process.env.MONGODB_URI, options);
        console.log('MongoDB connected successfully');
        await initializeCounter();
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// 404 Error Handler
app.use((req, res, next) => {
    console.log(`404 - Not Found - ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        status: 'error',
        message: `Not Found - ${req.originalUrl}`,
        availableEndpoints: [
            '/api/products',
            '/api/users',
            '/api/orders',
            '/api/settings',
            '/api/promo-codes',
            '/api/timer',
            '/api/categories'  // Added categories endpoint
        ]
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Graceful Shutdown Handler
const gracefulShutdown = async (server) => {
    console.log('Starting graceful shutdown...');
    try {
        await new Promise((resolve, reject) => {
            server.close((err) => err ? reject(err) : resolve());
        });
        await mongoose.connection.close(false);
        console.log('Server and MongoDB connections closed');
        process.exit(0);
    } catch (err) {
        console.error('Shutdown error:', err);
        process.exit(1);
    }
};

// Server Initialization
const startServer = async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 5000;
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
        });

        // Process Event Handlers
        ['SIGTERM', 'SIGINT'].forEach(signal => {
            process.on(signal, () => gracefulShutdown(server));
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            gracefulShutdown(server);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
verifyDiskMount();
startServer();

module.exports = app;