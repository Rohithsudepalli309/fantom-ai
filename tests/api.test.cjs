// const fetch = require('node-fetch'); // Using native fetch in Node 18+

const BASE_URL = 'http://127.0.0.1:4000/api';
const TEST_USER = {
    email: `test_${Date.now()}@example.com`,
    password: 'password123'
};

async function runTests() {
    console.log('🚀 Starting API Tests...');
    let token = '';

    // 1. Health Check
    try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
            console.log('✅ Health Check Passed');
        } else {
            console.error('❌ Health Check Failed', data);
        }
    } catch (e) {
        console.error('❌ Health Check Error', e.message);
    }

    // 2. Register
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });
        const data = await res.json();
        if (res.ok && data.insertedId) {
            console.log('✅ Registration Passed');
        } else {
            console.error('❌ Registration Failed', data);
        }
    } catch (e) {
        console.error('❌ Registration Error', e.message);
    }

    // 3. Login
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });
        const data = await res.json();
        if (res.ok && data.token) {
            token = data.token;
            console.log('✅ Login Passed');
        } else {
            console.error('❌ Login Failed', data);
            return; // Cannot proceed without token
        }
    } catch (e) {
        console.error('❌ Login Error', e.message);
        return;
    }

    // 4. Get Profile
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.email === TEST_USER.email) {
            console.log('✅ Get Profile Passed');
        } else {
            console.error('❌ Get Profile Failed', data);
        }
    } catch (e) {
        console.error('❌ Get Profile Error', e.message);
    }

    // 5. Update Password
    try {
        const res = await fetch(`${BASE_URL}/user`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: 'newpassword123' })
        });
        if (res.ok) {
            console.log('✅ Update Password Passed');
        } else {
            console.error('❌ Update Password Failed', await res.json());
        }
    } catch (e) {
        console.error('❌ Update Password Error', e.message);
    }

    // 6. Delete Account
    try {
        const res = await fetch(`${BASE_URL}/user`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            console.log('✅ Delete Account Passed');
        } else {
            console.error('❌ Delete Account Failed', await res.json());
        }
    } catch (e) {
        console.error('❌ Delete Account Error', e.message);
    }

    console.log('🏁 Tests Completed');
}

runTests();
