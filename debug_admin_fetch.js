// Using native fetch (Node 18+)
const BASE_URL = 'http://localhost:4000/api/admin/users';
const PASS = 'admin@123'; // The password we expect
const TOKEN = `admin:${PASS}`;

async function debugFetch() {
    console.log('Testing Admin Fetch with token:', TOKEN);
    try {
        const res = await fetch(BASE_URL, {
            headers: {
                'Authorization': `Basic ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Status:', res.status);
        if (res.status !== 200) {
            const txt = await res.text();
            console.log('Error Body:', txt);
            return;
        }

        const data = await res.json();
        console.log('Data keys:', Object.keys(data));
        if (data.list) {
            console.log('List length:', data.list.length);
            console.log('First user:', data.list[0]);
        } else {
            console.log('List is missing from data!');
            console.log('Full data:', JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error('Fetch error:', e);
    }
}

debugFetch();
