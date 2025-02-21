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
        
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
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
        'X-Requested-With'
    ],
    exposedHeaders: ['*'],
    maxAge: 86400
};
app.options('*', cors(corsOptions));
// Basic Middleware Setup
app.use(cors(corsOptions));
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

// API Request Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});
app.use('/uploads', cors({
    origin: '*',  // Allow all origins for image files
    methods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 86400,
    credentials: false,  // Important for public files
}));

// Static Files Setup
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.set({
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Cache-Control': 'public, max-age=31536000',
            'Access-Control-Allow-Credentials': 'false'  // Add this
        });
    }
}));

// Add these specific routes for different upload directories
app.use('/uploads/hero', express.static(path.join(__dirname, 'uploads/hero')));
app.use('/uploads/products', express.static(path.join(__dirname, 'uploads/products')));
app.use('/uploads/profile-images', express.static(path.join(__dirname, 'uploads/profile-images')));
// Add debug logging for file access
app.use('/uploads', (req, res, next) => {
    console.log('Accessing file:', req.url);
    console.log('Full path:', path.join(__dirname, 'uploads', req.url));
    next();
});

const directories = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/profile-images'),
    path.join(__dirname, 'uploads/hero'),
    path.join(__dirname, 'uploads/products'),
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

// Static Files Setup
app.use('/uploads', express.static('/backend/uploads', {
    setHeaders: (res) => {
        res.set({
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Cache-Control': 'public, max-age=31536000'
        });
    }
}));

//app.use('/uploads/hero', express.static('/backend/uploads/hero'));
//app.use('/uploads/products', express.static('/backend/uploads/products'));
//app.use('/uploads/profile-images', express.static('/backend/uploads/profile-images'));


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

startServer();

module.exports = app;