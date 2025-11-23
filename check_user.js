const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const users = await User.find({}).sort({ createdAt: -1 });
    console.log('All users in database:');
    users.forEach(u => {
        console.log(`Phone: ${u.phone}, Created: ${u.createdAt.toISOString()}`);
    });

    const target = await User.findOne({ phone: '8077722060' });
    console.log('\nUser 8077722060 exists:', target ? 'YES' : 'NO');

    mongoose.disconnect();
});
