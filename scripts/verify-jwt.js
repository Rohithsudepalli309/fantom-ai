// Native fetch is available in Node 18+
async function verify() {
    const baseUrl = 'http://127.0.0.1:4000/api';

    // 1. Login
    console.log('Logging in...');
    const loginResp = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'secure@example.com', password: 'mysecretpassword' })
    });

    if (!loginResp.ok) {
        console.error('Login failed:', await loginResp.text());
        return;
    }

    const loginData = await loginResp.json();
    const token = loginData.token;
    console.log('Got token:', token ? 'Yes' : 'No');

    // 2. Access Protected Route
    console.log('Accessing protected route...');
    const userResp = await fetch(`${baseUrl}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (userResp.ok) {
        const users = await userResp.json();
        console.log('Success! Users found:', users.length);
        if (users.length > 0) {
            console.log('First user:', users[0]);
        }
    } else {
        console.error('Access failed:', await userResp.text());
    }
}

verify().catch(console.error);
