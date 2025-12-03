
async function testLogin() {
    try {
        const response = await fetch('http://127.0.0.1:4000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' })
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error('Error:', e);
    }
}

testLogin();
