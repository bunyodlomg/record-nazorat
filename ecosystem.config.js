// PM2 process manager — production'da serverni autostart, log va restart uchun.
// Ishlatish:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup    // bootda avto-tushish uchun (chiqqan komandani sudo bilan bajaring)
module.exports = {
  apps: [
    {
      name: 'recordnazorat-api',
      script: 'src/server.js',
      cwd: './server',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
