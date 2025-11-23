// Using native fetch (Node 18+)
// If node-fetch isn't available, we'll use http module, but let's try native fetch first (Node 18+)

async function registerUser() {
    const url = 'http://localhost:4000/api/auth/register';
    const payload = {
        phone: '9876543210',
        pass: 'password123',
        invite: ''
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}

registerUser();
