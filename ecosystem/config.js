module.exports = {
    apps: [{
        name: "my-backend",
        script: "./app.js",
        instances: "max",
        exec_mode: "cluster",
        wait_ready: true,
        listen_timeout: 5000
    }]
}