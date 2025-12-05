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
                PORT: 4000
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
