module.exports = {
  apps: [
    {
      name: "rp-chat",
      script: "src/index.js",
      cwd: __dirname,
      interpreter: "/usr/bin/node",
      exec_mode: "cluster",
      instances: 2,
      kill_timeout: 5000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
