const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Plan = require('./models/Plan');

const BASE = 'http://localhost:4000/api';
const adminHeaders = { 'Authorization': 'Basic admin:admin@123' };

async function runComprehensiveTest() {
    console.log('🔍 COMPREHENSIVE ADMIN PANEL TEST\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    // Connect to DB for some tests
    await mongoose.connect(process.env.MONGO_URI);

    // TEST 1: Health Check
    console.log('\n1️⃣  HEALTH CHECK');
    try {
        const health = await fetch(`${BASE}/health`).then(r => r.json());
        console.log(health.ok ? '   ✅ Server healthy' : '   ❌ Health check failed');
        health.ok ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 2: GET Users
    console.log('\n2️⃣  GET /admin/users');
    try {
        const res = await fetch(`${BASE}/admin/users`, { headers: adminHeaders });
        const data = await res.json();
        console.log(data.list ? `   ✅ Retrieved ${data.list.length} users` : '   ❌ Failed');
        data.list ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 3: GET Withdrawals
    console.log('\n3️⃣  GET /admin/withdraws');
    try {
        const res = await fetch(`${BASE}/admin/withdraws`, { headers: adminHeaders });
        const data = await res.json();
        console.log(data.list !== undefined ? `   ✅ Retrieved ${data.list.length} withdrawals` : '   ❌ Failed');
        data.list !== undefined ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 4: GET Purchases
    console.log('\n4️⃣  GET /admin/purchases');
    try {
        const res = await fetch(`${BASE}/admin/purchases`, { headers: adminHeaders });
        const data = await res.json();
        console.log(data.list !== undefined ? `   ✅ Retrieved ${data.list.length} purchases` : '   ❌ Failed');
        data.list !== undefined ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 5: POST /admin/payouts
    console.log('\n5️⃣  POST /admin/payouts (Run Payouts button)');
    try {
        const res = await fetch(`${BASE}/admin/payouts`, {
            method: 'POST',
            headers: adminHeaders
        });
        const data = await res.json();
        console.log(data.message ? `   ✅ ${data.message}` : '   ❌ Failed');
        data.message ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 6: POST /admin/plans (Add Plan button)
    console.log('\n6️⃣  POST /admin/plans (Add Plan button)');
    try {
        const res = await fetch(`${BASE}/admin/plans`, {
            method: 'POST',
            headers: { ...adminHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Plan ' + Date.now(),
                price: 100,
                daily: 10,
                days: 30,
                type: 'buy'
            })
        });
        const data = await res.json();
        console.log(data.plan ? `   ✅ Created plan: ${data.plan.name}` : '   ❌ Failed');
        data.plan ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 7: POST /admin/users/:id/block (Block User button)
    console.log('\n7️⃣  POST /admin/users/:id/block (Block User button)');
    try {
        const user = await User.findOne({});
        if (user) {
            const res = await fetch(`${BASE}/admin/users/${user._id}/block`, {
                method: 'POST',
                headers: adminHeaders
            });
            const data = await res.json();
            console.log(data.message ? `   ✅ ${data.message}` : '   ❌ Failed');
            data.message ? passed++ : failed++;

            // Unblock to restore state
            await fetch(`${BASE}/admin/users/${user._id}/block`, {
                method: 'POST',
                headers: adminHeaders
            });
        } else {
            console.log('   ⚠️  No users to test with');
            failed++;
        }
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 8: DELETE /admin/users/:id (Delete User button)
    console.log('\n8️⃣  DELETE /admin/users/:id (Delete User button)');
    try {
        // Create a test user to delete
        const testUser = await User.create({
            phone: 'TEST_DELETE_' + Date.now(),
            pass: 'test123'
        });

        const res = await fetch(`${BASE}/admin/users/${testUser._id}`, {
            method: 'DELETE',
            headers: adminHeaders
        });
        const data = await res.json();
        console.log(data.message ? `   ✅ ${data.message}` : '   ❌ Failed');
        data.message ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    // TEST 9: GET /plans (Public endpoint)
    console.log('\n9️⃣  GET /plans (Plans display)');
    try {
        const res = await fetch(`${BASE}/plans`);
        const data = await res.json();
        console.log(data.plans ? `   ✅ Retrieved ${data.plans.length} plans` : '   ❌ Failed');
        data.plans ? passed++ : failed++;
    } catch (e) {
        console.log('   ❌ Failed:', e.message);
        failed++;
    }

    await mongoose.disconnect();

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
    console.log(failed === 0 ? '\n✅ ALL TESTS PASSED!' : '\n⚠️  SOME TESTS FAILED');
    console.log('='.repeat(60));
}

runComprehensiveTest().catch(console.error);
