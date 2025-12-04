
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = "mongodb://127.0.0.1:27017/testdb";
const client = new MongoClient(uri);

async function checkAndFixUser() {
    try {
        await client.connect();
        const db = client.db("testdb");
        const users = db.collection("users");

        const email = 'test@example.com';
        const password = 'Password123!';

        const user = await users.findOne({ email });

        if (user) {
            console.log(`User ${email} exists.`);
            const isMatch = await bcrypt.compare(password, user.password);
            console.log(`Password match: ${isMatch}`);
            if (!isMatch) {
                console.log('Updating password...');
                const hashedPassword = await bcrypt.hash(password, 10);
                await users.updateOne({ email }, { $set: { password: hashedPassword } });
                console.log('Password updated.');
            }
        } else {
            console.log(`User ${email} does not exist. Creating...`);
            const hashedPassword = await bcrypt.hash(password, 10);
            await users.insertOne({ email, password: hashedPassword });
            console.log('User created.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.close();
    }
}

checkAndFixUser();
