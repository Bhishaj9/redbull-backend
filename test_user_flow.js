// Test registration and login for user 8077722060
const BASE = 'http://localhost:4000/api';

async function testUser() {
    console.log('Testing user 8077722060...\n');

    // 1. Try to register
    console.log('1. Registering...');
    const regRes = await fetch(`${BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '8077722060', pass: 'test123' })
    });
    const regData = await regRes.json();
    console.log('   Response:', regData);

    // 2. Try to login
    console.log('\n2. Logging in...');
    const loginRes = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '8077722060', pass: 'test123' })
    });
    const loginData = await loginRes.json();
    console.log('   Token received:', loginData.token ? 'YES' : 'NO');

    // 3. Check in admin panel
    if (loginData.token) {
        console.log('\n3. Checking admin panel...');
        const usersRes = await fetch(`${BASE}/admin/users`, {
            headers: { 'Authorization': 'Basic admin:admin@123' }
        });
        const usersData = await usersRes.json();
        const found = usersData.list.find(u => u.phone === '8077722060');
        console.log('   User appears in admin:', found ? 'YES' : 'NO');
    }
}

testUser().catch(console.error);
