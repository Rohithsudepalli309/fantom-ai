const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs"); // Using bcryptjs for Windows compatibility
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/testdb";
const client = new MongoClient(uri);

let usersCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("testdb");
    usersCollection = db.collection("users");
    console.log("Connected to MongoDB");
  } catch (e) {
    console.error("MongoDB connection error:", e);
  }
}
connectDB();

// Secret key for JWT (use env variable in production!)
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Register route
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await usersCollection.insertOne({ email, password: hashedPassword });
    res.json({ insertedId: result.insertedId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid email or password" });

    // Issue JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Protected route example
app.get("/api/profile", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await usersCollection.findOne({ _id: new ObjectId(decoded.userId) });
    res.json({ email: user.email });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.listen(4000, () => console.log("Server running on http://127.0.0.1:4000"));
