// Native fetch is available in Node 18+
async function verify() {
    const baseUrl = 'http://127.0.0.1:4000/api';
    const timestamp = Date.now();
    const email = `user_${timestamp}@example.com`;
    const password = 'password123';

    console.log(`Testing with user: ${email}`);

    // 1. Register
    console.log('1. Registering...');
    const regResp = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!regResp.ok) {
        console.error('Registration failed:', await regResp.text());
        return;
    }
    console.log('Registration successful');

    // 2. Login
    console.log('2. Logging in...');
    const loginResp = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!loginResp.ok) {
        console.error('Login failed:', await loginResp.text());
        return;
    }

    const loginData = await loginResp.json();
    const token = loginData.token;
    console.log('Got token:', token ? 'Yes' : 'No');

    // 3. Access Profile (Protected)
    console.log('3. Accessing Profile...');
    const profileResp = await fetch(`${baseUrl}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (profileResp.ok) {
        const profile = await profileResp.json();
        console.log('Profile accessed successfully!');
        console.log('Profile email:', profile.email);
        if (profile.email === email) {
            console.log('VERIFICATION PASSED: Email matches.');
        } else {
            console.error('VERIFICATION FAILED: Email mismatch.');
        }
    } else {
        console.error('Profile access failed:', await profileResp.text());
    }
}

verify().catch(console.error);
