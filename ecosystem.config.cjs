module.exports = {
  apps: [
    {
      name: "rp-chat",
      script: "src/index.js",
      cwd: __dirname,
      interpreter: "/usr/bin/node",
      exec_mode: "fork",
      instances: 1,
      kill_timeout: 10000,
      listen_timeout: 20000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
