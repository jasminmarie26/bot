module.exports = {
  apps: [
    {
      name: "rp-chat",
      script: "src/runtime-proxy.js",
      cwd: __dirname,
      interpreter: "/usr/bin/node",
      exec_mode: "fork",
      instances: 1,
      wait_ready: true,
      kill_timeout: 15000,
      listen_timeout: 60000,
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
        HR_LIVE_DIR: __dirname,
        HR_CHILD_PORTS: "3001,3002"
      }
    }
  ]
};
