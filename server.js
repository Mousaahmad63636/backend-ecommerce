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

// CORS Configuration
const corsOptions = {
    origin: [
        'https://frontend-ecommerce-dun.vercel.app',
        'https://frontend-ecommerce-8hgd7ct28-mousaahmad63636s-projects.vercel.app',
        process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

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
const uploadDirs = ['uploads', 'uploads/profile-images', 'uploads/products'];
uploadDirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    !fs.existsSync(dirPath) && fs.mkdirSync(dirPath, { recursive: true });
});

// Logging Setup
const logsDir = path.join(__dirname, 'logs');
!fs.existsSync(logsDir) && fs.mkdirSync(logsDir, { recursive: true });

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' })
    }));
}

// Static Files Setup
app.use('/uploads', cors(), express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.set({
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*'
        });
    }
}));

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
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
Object.entries(routes).forEach(([key, router]) => {
    app.use(`/api/${key}`, router);
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
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        await initializeCounter();
        console.log('MongoDB connected and counter initialized');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        setTimeout(connectDB, 5000);
    }
};

connectDB().catch(console.error);

// Error Handling Middleware
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    const error = {
        success: false,
        message: err.message || 'Internal server error',
        status: err.status || 500
    };
    if (process.env.NODE_ENV === 'development') {
        error.stack = err.stack;
    }
    res.status(error.status).json(error);
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