// MongoDB connection and user helpers for Fantom AI
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB || 'fantom-ai';
const COLLECTION = 'users';

let client;
let db;

async function connectMongo() {
    try {
        if (!client) {
            console.log(`[mongo] Connecting to ${MONGO_URI}...`);
            client = new MongoClient(MONGO_URI, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000
            });
            await client.connect();
            console.log('[mongo] Connected successfully');
            db = client.db(DB_NAME);
        }
        return db.collection(COLLECTION);
    } catch (e) {
        console.error('[mongo] Connection failed:', e);
        throw e;
    }
}

async function findUserByEmail(email) {
    const col = await connectMongo();
    return await col.findOne({ email: String(email).toLowerCase() });
}

async function findUserById(id) {
    const col = await connectMongo();
    return await col.findOne({ id });
}

async function createUser({ id, email, passwordHash }) {
    const col = await connectMongo();
    await col.insertOne({ id, email: String(email).toLowerCase(), passwordHash, createdAt: new Date().toISOString() });
}

module.exports = { connectMongo, findUserByEmail, findUserById, createUser };
