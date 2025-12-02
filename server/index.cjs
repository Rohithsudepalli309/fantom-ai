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

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// Health Check with DB Latency
app.get("/api/health", async (req, res) => {
  try {
    const start = Date.now();
    await client.db("testdb").command({ ping: 1 });
    const latency = Date.now() - start;
    res.json({ status: "ok", db_latency_ms: latency });
  } catch (e) {
    res.status(500).json({ status: "error", error: e.message });
  }
});

// Register route
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

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

// Protected route: Profile
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user._id, email: user.email });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Protected route: Delete Account
app.delete("/api/user", authenticateToken, async (req, res) => {
  try {
    const result = await usersCollection.deleteOne({ _id: new ObjectId(req.user.userId) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Protected route: Update Profile (Password)
app.put("/api/user", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { password: hashedPassword } }
    );

    if (result.matchedCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(4000, () => console.log("Server running on http://127.0.0.1:4000"));
