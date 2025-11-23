const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const BASE = 'http://localhost:4000/api';
const ADMIN_AUTH = 'Basic admin:admin@123'; // Assuming default from admin-login.html

// Helper for cookies
let userCookie = '';

async function runScenarioTest() {
    console.log('🚀 STARTING USER & ADMIN SCENARIO TEST\n');
    console.log('='.repeat(60));

    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('   ✅ Connected to DB');

    const timestamp = Date.now();
    const testUser = {
        phone: `99${timestamp.toString().slice(-8)}`, // Ensure 10 digits
        pass: 'password123',
        invite: ''
    };

    console.log(`\n👤 USER SCENARIO: Creating user ${testUser.phone}`);

    // 1. REGISTER
    try {
        const res = await fetch(`${BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const data = await res.json();
        if (res.ok) {
            console.log('   ✅ Register success');
            // Extract cookie
            const cookieHeader = res.headers.get('set-cookie');
            if (cookieHeader) {
                userCookie = cookieHeader.split(';')[0];
                console.log('   ✅ Cookie received');
            }
        } else {
            console.error('   ❌ Register failed:', data);
            return;
        }
    } catch (e) {
        console.error('   ❌ Register error:', e.message);
        return;
    }

    // 2. LOGIN (Verify)
    try {
        const res = await fetch(`${BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testUser.phone, pass: testUser.pass })
        });
        const data = await res.json();
        if (res.ok) {
            console.log('   ✅ Login success');
            // Update cookie if new one sent
            const cookieHeader = res.headers.get('set-cookie');
            if (cookieHeader) userCookie = cookieHeader.split(';')[0];
        } else {
            console.error('   ❌ Login failed:', data);
        }
    } catch (e) {
        console.error('   ❌ Login error:', e.message);
    }

    // 3. RECHARGE (Mock - just verifying endpoint access)
    // Since we can't easily do a real payment, we'll skip the actual payment verification 
    // but we can check if we can initiate an order.
    try {
        const res = await fetch(`${BASE}/purchases/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': userCookie
            },
            body: JSON.stringify({ amount: 500 })
        });
        const data = await res.json();
        if (res.ok && data.orderId) {
            console.log('   ✅ Recharge order created:', data.orderId);
        } else {
            console.error('   ❌ Recharge init failed:', data);
        }
    } catch (e) {
        console.error('   ❌ Recharge error:', e.message);
    }

    // 4. BIND BANK
    try {
        const res = await fetch(`${BASE}/auth/bank`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': userCookie
            },
            body: JSON.stringify({
                name: 'Test User',
                account: '1234567890',
                ifsc: 'TEST0000001',
                bankName: 'Test Bank'
            })
        });
        const data = await res.json();
        if (res.ok) {
            console.log('   ✅ Bank details bound');
        } else {
            console.error('   ❌ Bind bank failed:', data);
        }
    } catch (e) {
        console.error('   ❌ Bind bank error:', e.message);
    }

    // 5. WITHDRAW REQUEST
    let withdrawId = null;
    try {
        // Set withdraw password and wallet balance directly in DB for test
        await User.findOneAndUpdate({ phone: testUser.phone }, { withdrawPass: '123456', wallet: 500 });

        const res = await fetch(`${BASE}/withdraws/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': userCookie
            },
            body: JSON.stringify({ amount: 150, withdrawPass: '123456' })
        });
        const data = await res.json();
        if (res.ok) {
            console.log('   ✅ Withdraw requested successfully');
            withdrawId = data.id;
        } else {
            console.error('   ❌ Withdraw request failed:', data);
        }
    } catch (e) {
        console.error('   ❌ Withdraw request error:', e.message);
    }

    console.log('\n👮 ADMIN SCENARIO: Verifying User & Withdrawal');

    // 6. ADMIN LIST USERS
    try {
        const res = await fetch(`${BASE}/admin/users`, {
            headers: { 'Authorization': ADMIN_AUTH }
        });
        const data = await res.json();
        if (res.ok) {
            const found = data.list.find(u => u.phone === testUser.phone);
            if (found) {
                console.log('   ✅ User visible in Admin Panel');
            } else {
                console.error('   ❌ User NOT found in Admin Panel');
            }
        } else {
            console.error('   ❌ Admin list users failed:', data);
        }
    } catch (e) {
        console.error('   ❌ Admin list users error:', e.message);
    }

    // 7. ADMIN LIST WITHDRAWS & APPROVE
    if (withdrawId) {
        try {
            // List
            const resList = await fetch(`${BASE}/admin/withdraws`, {
                headers: { 'Authorization': ADMIN_AUTH }
            });
            const dataList = await resList.json();
            const foundW = dataList.list.find(w => w._id === withdrawId);

            if (foundW) {
                console.log('   ✅ Withdrawal visible in Admin Panel');

                // Approve
                const resApprove = await fetch(`${BASE}/admin/withdraws/${withdrawId}/process`, {
                    method: 'POST',
                    headers: {
                        'Authorization': ADMIN_AUTH,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: 'accept' })
                });
                const dataApprove = await resApprove.json();
                if (resApprove.ok) {
                    console.log('   ✅ Withdrawal Approved by Admin');
                } else {
                    console.error('   ❌ Withdrawal approval failed:', dataApprove);
                }

            } else {
                console.error('   ❌ Withdrawal NOT found in Admin Panel');
            }
        } catch (e) {
            console.error('   ❌ Admin withdraw check error:', e.message);
        }
    }

    // 8. USER CHECK STATUS
    try {
        const res = await fetch(`${BASE}/withdraws/my`, {
            headers: { 'Cookie': userCookie }
        });
        const data = await res.json();
        if (res.ok) {
            const myW = data.withdraws.find(w => w._id === withdrawId);
            if (myW && myW.status === 'processed') {
                console.log('   ✅ User sees withdrawal as PROCESSED');
            } else {
                console.error('   ❌ User sees withdrawal status as:', myW ? myW.status : 'Not Found');
            }
        } else {
            console.error('   ❌ User check status failed:', data);
        }
    } catch (e) {
        console.error('   ❌ User check status error:', e.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 SCENARIO TEST COMPLETE');
    await mongoose.disconnect();
}

runScenarioTest().catch(console.error);
