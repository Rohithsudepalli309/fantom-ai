const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs"); // Using bcryptjs for Windows compatibility
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Authorization Header:', req.headers.authorization);
  next();
});

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/testdb";
const client = new MongoClient(uri);

// Secret key for JWT (use env variable in production!)
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
console.log("JWT_SECRET used:", JWT_SECRET === "supersecretkey" ? "default (supersecretkey)" : "from env");

let usersCollection;
let activitiesCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("testdb");
    usersCollection = db.collection("users");
    activitiesCollection = db.collection("activities");
    console.log("Connected to MongoDB");
  } catch (e) {
    console.error("MongoDB connection error:", e);
  }
}
connectDB();

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

// --- Activity Routes ---

// Record Activity
app.post("/api/activity", authenticateToken, async (req, res) => {
  try {
    const { type, data, timestamp } = req.body;
    if (!type) return res.status(400).json({ error: "Activity type required" });

    const activity = {
      userId: req.user.userId,
      type,
      data: data || {},
      timestamp: timestamp || new Date().toISOString()
    };

    const result = await activitiesCollection.insertOne(activity);
    res.json({ insertedId: result.insertedId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Activities
app.get("/api/activity", authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const activities = await activitiesCollection
      .find({ userId: req.user.userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    res.json(activities);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

// --- AI Proxy Routes ---

// Chat Proxy (NVIDIA Nemotron via OpenRouter)
app.post("/api/chat", authenticateToken, async (req, res) => {
  try {
    const NVIDIA_KEY = process.env.VITE_NVIDIA_API_KEY;
    console.log("DEBUG: VITE_NVIDIA_API_KEY present?", !!NVIDIA_KEY, "Length:", NVIDIA_KEY ? NVIDIA_KEY.length : 0);
    const NVIDIA_BASE = process.env.VITE_NVIDIA_BASE_URL || "https://openrouter.ai/api/v1";

    if (!NVIDIA_KEY) return res.status(500).json({ error: "NVIDIA API key not configured" });

    const isStream = req.body.stream === true;

    // Create a body that ensures stream matches client intent
    const upstreamBody = { ...req.body, stream: isStream };

    const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NVIDIA_KEY}`,
        // OpenRouter specific: identify app
        "HTTP-Referer": "https://fantom-ai.local",
        "X-Title": "Fantom AI"
      },
      body: JSON.stringify(upstreamBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Upstream error: ${errorText}` });
    }

    if (isStream) {
      // Set SSE headers immediately
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Node native fetch body is a ReadableStream (Web Standard)
      try {
        // @ts-ignore
        for await (const chunk of response.body) {
          res.write(chunk);
        }
      } catch (error) {
        console.error("Stream piping error:", error);
        res.end();
      } finally {
        res.end();
      }
    } else {
      // Normal JSON response
      const data = await response.json();
      res.json(data);
    }
  } catch (e) {
    console.error("Chat proxy error:", e);
    // If headers already sent (streaming started), we can't send JSON error
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    } else {
      res.end();
    }
  }
});

// Vision Proxy (NVIDIA Nemotron)
app.post("/api/vision", authenticateToken, async (req, res) => {
  try {
    const NVIDIA_KEY = process.env.VITE_NVIDIA_API_KEY;
    const NVIDIA_BASE = process.env.VITE_NVIDIA_BASE_URL || "https://integrate.api.nvidia.com";

    if (!NVIDIA_KEY) return res.status(500).json({ error: "NVIDIA API key not configured" });

    const response = await fetch(`${NVIDIA_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NVIDIA_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `NVIDIA API error: ${errorText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Image Proxy (Pollinations.ai)
app.post("/api/image", authenticateToken, async (req, res) => {
  try {
    const { prompt, model } = req.body;

    // Use Pollinations.ai as a reliable free provider
    // It supports Flux via model param if needed, but default is good.
    const encodedPrompt = encodeURIComponent(prompt || "random image");
    const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000)}`;

    res.json({
      data: [{ url: imageUrl }], // OpenAI compatible format
      provider: 'pollinations'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

app.listen(4000, () => console.log("Server running on http://127.0.0.1:4000"));
