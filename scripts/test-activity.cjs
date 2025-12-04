
// Native fetch in Node 18+

async function testActivity() {
    const email = 'test@example.com';
    const password = 'Password123!';
    let token;

    console.log('--- Logging In ---');
    try {
        const loginResp = await fetch('http://127.0.0.1:4000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!loginResp.ok) throw new Error(`Login failed: ${loginResp.status}`);
        const data = await loginResp.json();
        token = data.token;
        console.log('Login successful, token received.');
    } catch (e) {
        console.error(e);
        return;
    }

    console.log('\n--- Recording Activity ---');
    try {
        const actResp = await fetch('http://127.0.0.1:4000/api/activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: 'test_action',
                data: { foo: 'bar' },
                timestamp: new Date().toISOString()
            })
        });
        if (!actResp.ok) throw new Error(`Record failed: ${actResp.status} ${await actResp.text()}`);
        console.log('Activity recorded.');
    } catch (e) {
        console.error(e);
        return;
    }

    console.log('\n--- Listing Activities ---');
    try {
        const listResp = await fetch('http://127.0.0.1:4000/api/activity?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!listResp.ok) throw new Error(`List failed: ${listResp.status}`);
        const activities = await listResp.json();
        console.log(`Found ${activities.length} activities.`);
        console.log(activities[0]);
        if (activities.length > 0 && activities[0].type === 'test_action') {
            console.log('SUCCESS: Verified persistent activity.');
        } else {
            console.log('FAILURE: Did not find expected activity.');
        }
    } catch (e) {
        console.error(e);
    }
}

testActivity();
