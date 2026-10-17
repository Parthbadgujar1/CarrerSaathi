/**
 * PM2 process file (Hostinger VPS).  pm2 start ecosystem.config.cjs --env production
 * Single instance on purpose: Socket.IO rooms and rate-limit counters live in memory.
 */
module.exports = {
  apps: [
    {
      name: 'careersaathi',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      exp_backoff_restart_delay: 200,
      max_memory_restart: '600M',
      kill_timeout: 12000,
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
      out_file: 'storage/logs/pm2-out.log',
      error_file: 'storage/logs/pm2-error.log',
      time: true,
    },
  ],
};
