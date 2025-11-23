const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await User.countDocuments();
        console.log(`Total Users: ${count}`);
        if (count > 0) {
            const users = await User.find().limit(5);
            console.log('Sample users:', users);
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

checkUsers();
