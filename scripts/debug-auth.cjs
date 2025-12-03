
async function testAuth() {
    console.log('--- Registering ---');
    try {
        const regResp = await fetch('http://127.0.0.1:4000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' })
        });
        console.log(`Register Status: ${regResp.status}`);
        console.log(`Register Body: ${await regResp.text()}`);
    } catch (e) { console.error('Register Error:', e); }

    console.log('\n--- Logging In ---');
    try {
        const loginResp = await fetch('http://127.0.0.1:4000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' })
        });
        console.log(`Login Status: ${loginResp.status}`);
        const loginBody = await loginResp.text();
        console.log(`Login Body: ${loginBody}`);
    } catch (e) { console.error('Login Error:', e); }
}

testAuth();
