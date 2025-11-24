const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function deleteUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const phone = "8077722060";
        const result = await User.deleteOne({ phone });

        if (result.deletedCount > 0) {
            console.log(`Successfully deleted user with phone: ${phone}`);
        } else {
            console.log(`User with phone ${phone} not found.`);
        }

    } catch (err) {
        console.error('Error deleting user:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from DB');
    }
}

deleteUser();
