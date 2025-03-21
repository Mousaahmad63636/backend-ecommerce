// backend/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createAdminUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin exists
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            console.log('Admin user already exists with email:', adminExists.email);
            await mongoose.connection.close();
            return;
        }

        // Create admin user
        const adminUser = new User({
            name: 'Admin',
            email: 'admin@example.com',
            password: 'Admin123!',
            role: 'admin',
            phoneNumber: '123456789',
            address: 'Admin Address',
            emailVerified: true,
            status: 'active'
        });

        await adminUser.save();
        console.log('Admin user created successfully!');
        console.log('Email: admin@example.com');
        console.log('Password: Admin123!');

    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await mongoose.connection.close();
    }
}

createAdminUser();