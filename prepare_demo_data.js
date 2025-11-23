const mongoose = require('mongoose');
require('dotenv').config();
const Purchase = require('./models/Purchase');
const Withdraw = require('./models/Withdraw');
const User = require('./models/User');

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const phone = '9876543210';
        const user = await User.findOne({ phone });

        if (!user) {
            console.log('Test user not found, skipping seed.');
            return;
        }

        // Seed Purchase
        const purchaseCount = await Purchase.countDocuments();
        if (purchaseCount === 0) {
            await Purchase.create({
                userPhone: phone,
                user: user._id,
                planId: 'p1',
                planName: 'Plan 1',
                price: 520,
                amount: 52000, // paise
                status: 'completed',
                paymentId: 'pay_demo_123'
            });
            console.log('Seeded dummy purchase');
        }

        // Seed Withdraw
        const withdrawCount = await Withdraw.countDocuments();
        if (withdrawCount === 0) {
            await Withdraw.create({
                phone: phone,
                amount: 200,
                status: 'pending',
                note: 'Demo withdrawal'
            });
            console.log('Seeded dummy withdrawal');
        }

        console.log('Demo data check complete');

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

seedData();
