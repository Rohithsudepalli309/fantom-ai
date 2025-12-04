
const { MongoClient } = require('mongodb');

const uri = "mongodb://127.0.0.1:27017/testdb";
const client = new MongoClient(uri);

async function listUsers() {
    try {
        await client.connect();
        const db = client.db("testdb");
        const users = await db.collection("users").find({}).toArray();

        console.log(`Found ${users.length} users:`);
        users.forEach(u => {
            console.log(`- ID: ${u._id}, Email: ${u.email}`);
        });

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.close();
    }
}

listUsers();
