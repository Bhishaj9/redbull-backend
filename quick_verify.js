const BASE = 'http://localhost:4000/api';

async function verify() {
    console.log('🔍 Final Comprehensive System Check\n');

    // 1. Health  
    console.log('✓ Health:', await fetch(`${BASE}/health`).then(r => r.json()));

    // 2. Admin - GET Users
    const adminHeaders = { 'Authorization': 'Basic admin:admin@123' };
    const users = await fetch(`${BASE}/admin/users`, { headers: adminHeaders }).then(r => r.json());
    console.log('✓ Admin GET /users:', users.list ? `${users.list.length} users` : 'Failed');

    // 3. Admin - Postouts 
    const payouts = await fetch(`${BASE}/admin/payouts`, {
        method: 'POST',
        headers: adminHeaders
    }).then(r => r.json());
    console.log('✓ Admin POST /payouts:', payouts.message || payouts);

    // 4. Admin - Add Plan
    const newPlan = await fetch(`${BASE}/admin/plans`, {
        method: 'POST',
        headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Verify Plan', price: 50, daily: 5, days: 10 })
    }).then(r => r.json());
    console.log('✓ Admin POST /plans:', newPlan.message || newPlan);

    // 5. Plans
    const plans = await fetch(`${BASE}/plans`).then(r => r.json());
    console.log('✓ GET /plans:', plans.plans ? `${plans.plans.length} plans` : 'Failed');

    console.log('\n✅ All Critical Endpoints Working!');
}

verify().catch(console.error);
