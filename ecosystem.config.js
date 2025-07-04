module.exports = {
  apps: [
    {
      name: 'refurbish-worker',
      script: './src/workers/refurbish-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development',
        watch: true,
        ignore_watch: ['node_modules', 'build', 'logs', '*.log']
      },
      error_file: './logs/refurbish-error.log',
      out_file: './logs/refurbish-out.log',
      log_file: './logs/refurbish-combined.log',
      time: true,
      merge_logs: true
    },
    {
      name: 'admin-dashboard',
      script: './admin/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        ADMIN_PORT: 4000
      },
      env_development: {
        NODE_ENV: 'development',
        ADMIN_PORT: 4000,
        watch: ['admin/server.js', 'admin/middleware', 'admin/services']
      },
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_file: './logs/admin-combined.log',
      time: true
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/book-automation.git',
      path: '/var/www/book-automation',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};