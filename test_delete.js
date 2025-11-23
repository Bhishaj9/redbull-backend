fetch('http://localhost:4000/api/admin/users/69216bc37f710835c8789ba7', {
    method: 'DELETE',
    headers: { 'Authorization': 'Basic admin:admin@123' }
}).then(r => r.text()).then(txt => console.log('Response:', txt)).catch(e => console.error('Error:', e));
