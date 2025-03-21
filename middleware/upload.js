const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Get disk mount path from environment variable or use default based on screenshot
const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/backend/uploads';

// Helper function to ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
    // Use the DISK_MOUNT_PATH as the base directory
    const fullPath = path.join(DISK_MOUNT_PATH, dirPath);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
};

// Product storage configuration
const productStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = ensureDirectoryExists('products');
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Hero storage configuration
const heroStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = ensureDirectoryExists('hero');
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for products (images only)
const productFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

// File filter for hero (images and videos)
const heroFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Please upload an image or video file'), false);
    }
};

// Product upload configuration
const productUpload = multer({
    storage: productStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 5
    },
    fileFilter: productFileFilter
});

// Hero upload configuration
const heroUpload = multer({
    storage: heroStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for hero content
    },
    fileFilter: heroFileFilter
});

module.exports = {
    productUpload,
    heroUpload,
    DISK_MOUNT_PATH
};