# FANTOM AI

**Fantom AI** is a cutting-edge, premium AI platform built with modern web technologies. It integrates multiple generative AI capabilities into a single, cohesive interface, featuring a robust authentication system and a responsive, glassmorphic design.

![Fantom AI Banner](https://via.placeholder.com/1200x400?text=Fantom+AI+Dashboard)

## 🚀 Features

### 🧠 AI Capabilities
*   **Text Generation**: Generate creative content, code, or summaries using advanced LLMs.
*   **Interactive Chat**: Engage in real-time conversations with context-aware AI agents.
*   **Image Generation**: Create stunning visuals from text prompts using Stable Diffusion and other models.
*   **Vision Analysis**: Upload images and ask questions to get detailed insights.

### 🛡️ Security & Authentication
*   **Secure Auth**: Custom JWT-based authentication system.
*   **User Management**: Sign up, Sign in, and Profile management.
*   **Session Persistence**: "Remember Me" functionality using local storage and token validation.
*   **Account Control**: Users can update their passwords or permanently delete their accounts.
*   **Password Hashing**: Industry-standard `bcrypt` hashing for security.

### 🎨 UI/UX Design
*   **Modern Aesthetic**: Sleek, dark-mode-first design with glassmorphism effects.
*   **Responsive Layout**: Fully optimized for Desktop, Tablet, and Mobile devices.
*   **Interactive Elements**: Smooth transitions (Framer Motion), toast notifications, and dynamic feedback.
*   **Dashboard**: Centralized hub for accessing all AI tools.

## 🛠️ Tech Stack

*   **Frontend**: React, Vite, TypeScript
*   **Styling**: Tailwind CSS, Shadcn/UI, Lucide Icons
*   **Animations**: Framer Motion
*   **Backend**: Node.js, Express
*   **Database**: MongoDB (Local or Atlas)
*   **Authentication**: JWT (JSON Web Tokens), Bcrypt.js
*   **Testing**: Playwright (E2E), Custom API Test Scripts

## ⚙️ Installation & Setup

### Prerequisites
*   **Node.js** (v18 or higher)
*   **MongoDB** (Running locally or via Atlas connection string)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/fantom-ai.git
cd fantom-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create a `.env` file in the root directory:
```env
# Backend Configuration
MONGO_URI=mongodb://127.0.0.1:27017/fantom_ai_db
JWT_SECRET=your_super_secret_jwt_key_here
PORT=4000

# Frontend Configuration
VITE_AUTH_PROVIDER=jwt
VITE_API_URL=http://localhost:4000
```

### 4. Start the Application
You need to run both the backend server and the frontend client.

**Option A: Run Concurrently (Recommended)**
```bash
npm run dev:full
```

**Option B: Run Separately**
Terminal 1 (Backend):
```bash
node server/index.cjs
```
Terminal 2 (Frontend):
```bash
npm run dev
```

## 🧪 Testing

We include automated API tests to verify the backend routes (Auth, Profile, etc.).

```bash
# Run API Smoke Tests
node tests/api.test.cjs
```

## 📂 Project Structure

```
fantom-ai/
├── src/
│   ├── components/   # Reusable UI components (Layout, Sidebar, Cards)
│   ├── contexts/     # Global state (AuthContext)
│   ├── pages/        # Route pages (Home, Chat, Profile)
│   ├── lib/          # Utilities (API helper, styling)
│   └── data/         # Static data and configuration
├── server/           # Express backend
│   └── index.cjs     # Main server entry point
├── tests/            # Automated test scripts
└── public/           # Static assets
```

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License

This project is licensed under the MIT License.
