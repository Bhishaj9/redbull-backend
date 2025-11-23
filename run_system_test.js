// Using native fetch (Node 18+)
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const BASE_URL = 'http://localhost:4000/api';
const ADMIN_CREDS = { token: 'admin:admin@123' }; // Basic auth token structure

async function runTests() {
    console.log('🚀 Starting System Verification...\n');

    let userToken = '';
    let userPhone = '9998887770';
    let userPass = 'testpass123';
    let withdrawPass = '123456';
    let withdrawId = '';

    // 1. Register
    console.log('1️⃣  Testing Registration...');
    try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: userPhone, pass: userPass })
        });
        const data = await res.json();
        if (res.status === 200 || data.message === 'User exists') {
            console.log('   ✅ Registered/User exists.');
        } else {
            throw new Error(`Registration failed: ${JSON.stringify(data)}`);
        }
    } catch (e) { console.error('   ❌ Registration Error:', e.message); }

    // 2. Login
    console.log('\n2️⃣  Testing Login...');
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: userPhone, pass: userPass })
        });
        const data = await res.json();
        if (res.status === 200 && data.token) {
            userToken = data.token;
            console.log('   ✅ Login successful.');
        } else {
            throw new Error(`Login failed: ${JSON.stringify(data)}`);
        }
    } catch (e) { console.error('   ❌ Login Error:', e.message); return; }

    // 2.5 Seed Funds & Password (Backdoor)
    console.log('\n2️⃣.5️⃣  Seeding Funds & Password...');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const u = await User.findOne({ phone: userPhone });
        if (u) {
            u.wallet = 500;
            u.withdrawPass = withdrawPass;
            await u.save();
            console.log('   ✅ Wallet updated to 500, Withdraw Pass set.');
        }
    } catch (e) { console.error('   ❌ Seeding Error:', e.message); }

    // 3. Create Withdrawal Request
    console.log('\n3️⃣  Testing Withdrawal Request...');
    try {
        const res = await fetch(`${BASE_URL}/withdraws/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `token=${userToken}` // sending cookie for auth
            },
            body: JSON.stringify({ amount: 200, withdrawPass: withdrawPass })
        });
        const data = await res.json();
        console.log('   ℹ️  Response:', data);

        if (res.status === 200) {
            console.log('   ✅ Withdrawal requested.');
        } else {
            console.log('   ⚠️  Withdrawal failed.');
        }
    } catch (e) { console.error('   ❌ Withdrawal Error:', e.message); }

    // 4. Admin: List Withdrawals & Approve
    console.log('\n4️⃣  Testing Admin: List & Approve Withdrawals...');
    try {
        const res = await fetch(`${BASE_URL}/admin/withdraws`, {
            headers: { 'Authorization': `Basic ${ADMIN_CREDS.token}` }
        });
        const data = await res.json();
        if (data.list) {
            // Find our user's pending request
            const myRequest = data.list.find(w => w.phone === userPhone && w.status === 'pending');
            if (myRequest) {
                withdrawId = myRequest._id;
                console.log('   ✅ Found pending request:', withdrawId);

                // Approve it
                const approveRes = await fetch(`${BASE_URL}/admin/withdraws/${withdrawId}/process`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${ADMIN_CREDS.token}`
                    },
                    body: JSON.stringify({ action: 'accept' })
                });
                const approveData = await approveRes.json();
                console.log('   ✅ Approval Action:', approveData.message);
            } else {
                console.log('   ⚠️  No pending withdrawal found.');
            }
        }
        // 5. Admin: Run Payouts
        console.log('\n5️⃣  Testing Admin: Run Payouts...');
        try {
            const res = await fetch(`${BASE_URL}/admin/payouts`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${ADMIN_CREDS.token}` }
            });
            const data = await res.json();
            console.log('   ℹ️  Payouts:', data.message);
        } catch (e) { console.error('   ❌ Payouts Error:', e.message); }

        // 6. Admin: Add Plan
        console.log('\n6️⃣  Testing Admin: Add Plan...');
        let newPlanId = '';
        try {
            const res = await fetch(`${BASE_URL}/admin/plans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ADMIN_CREDS.token}`
                },
                body: JSON.stringify({
                    name: 'Test Plan Auto',
                    price: 100,
                    daily: 10,
                    days: 30,
                    type: 'buy'
                })
            });
            const data = await res.json();
            if (data.plan) {
                newPlanId = data.plan.id;
                console.log('   ✅ Plan Created:', data.plan.name);
            } else {
                console.log('   ⚠️  Plan creation failed:', data);
            }
        } catch (e) { console.error('   ❌ Add Plan Error:', e.message); }

        // 7. Admin: Block User
        console.log('\n7️⃣  Testing Admin: Block User...');
        try {
            // Get user ID first
            const u = await User.findOne({ phone: userPhone });
            if (u) {
                const res = await fetch(`${BASE_URL}/admin/users/${u._id}/block`, {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${ADMIN_CREDS.token}` }
                });
                const data = await res.json();
                console.log('   ✅ Block Action:', data.message);

                // Unblock to leave clean state
                await fetch(`${BASE_URL}/admin/users/${u._id}/block`, {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${ADMIN_CREDS.token}` }
                });
                console.log('   ✅ Unblocked user for cleanup.');
            }
        } catch (e) { console.error('   ❌ Block User Error:', e.message); }

    } catch (e) { console.error('   ❌ Admin Error:', e.message); }
    finally { mongoose.disconnect(); }

    console.log('\n🏁 Verification Complete.');
}

runTests();
