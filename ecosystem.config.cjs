module.exports = {
    apps: [
        {
            name: "fantom-server",
            script: "./server/index.cjs",
            instances: 1,
            autorestart: true,
            watch: ["server"],
            env: {
                NODE_ENV: "development",
                PORT: 4000,
                VITE_NVIDIA_API_KEY: "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",
                VITE_NVIDIA_BASE_URL: "https://openrouter.ai/api/v1"
            }
        },
        {
            name: "fantom-client",
            script: "./node_modules/.bin/vite",
            args: "--port 3000 --host",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "development"
            }
        }
    ]
};
