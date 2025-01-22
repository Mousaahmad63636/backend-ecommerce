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

// Initialize Express app
const app = express();

const corsOptions = {
    origin: [
        'https://frontend-ecommerce-dun.vercel.app',
        'https://frontend-ecommerce-8hgd7ct28-mousaahmad63636s-projects.vercel.app',
        'https://spotlylb.com',
        process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token', 'Origin', 'Accept'],
    exposedHeaders: ['Access-Control-Allow-Origin']
};
// API Request Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// Basic Middleware Setup
app.use(cors(corsOptions));
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

// Create required directories
const directories = [
    '/backend/uploads', 
    '/backend/uploads/profile-images', 
    '/backend/uploads/products'
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
    app.use(morgan('combined', {
        stream: fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' })
    }));
}

// Update static files path
app.use('/uploads', cors(), express.static('/backend/uploads'), {
    setHeaders: (res) => {
        res.set({
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Cache-Control': 'public, max-age=31536000'
        });
    }
});

// Root Route
app.get('/', (req, res) => {
    res.json({
        message: 'API is running',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date(),
        endpoints: ['/api/products', '/api/users', '/api/orders', '/api/settings', '/api/promo-codes']
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

// Register API routes with logging
app.use('/api/timer', timerRoutes);
app.use('/api/settings', require('./routes/settings'));
app.use('/api/promo-codes', require('./routes/promoCodes'));

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
            console.log('Order counter initialized');
        }
    } catch (error) {
        console.error('Counter initialization error:', error);
        throw error;
    }
}

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await initializeCounter();
        console.log('MongoDB connected and counter initialized');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        setTimeout(connectDB, 5000);
    }
};

connectDB().catch(console.error);

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
            '/api/timer'
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
const gracefulShutdown = async () => {
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

// Process Event Handlers
['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, gracefulShutdown);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
});

// Server Initialization
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;