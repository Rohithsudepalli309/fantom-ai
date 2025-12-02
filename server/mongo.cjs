// MongoDB connection and user helpers for Fantom AI
const { MongoClient } = require('mongodb');
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB || 'fantom-ai';
const COLLECTION = 'users';

let client;
let db;

async function connectMongo() {
    if (!client) {
        client = new MongoClient(MONGO_URL, { useUnifiedTopology: true });
        await client.connect();
        db = client.db(DB_NAME);
    }
    return db.collection(COLLECTION);
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
