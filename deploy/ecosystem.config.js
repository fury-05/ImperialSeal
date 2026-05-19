// =============================================================================
// ImperialSeal — PM2 Ecosystem Config
// Manages: backend API server + email queue worker
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 reload ecosystem.config.js --env production   (zero-downtime reload)
//   pm2 stop all
//   pm2 delete all
// =============================================================================

const path = require("path");

const APP_ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(APP_ROOT, "backend");
const LOG_DIR = path.join(APP_ROOT, "logs");

module.exports = {
  apps: [
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Backend REST API
    //    Express.js server on port 3001
    //    Cluster mode: 2 workers (fits Azure B2s 2 vCPU)
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: "imperialseal-api",
      script: "src/index.js",
      cwd: BACKEND_DIR,

      // Cluster for zero-downtime reloads and multi-core utilisation
      exec_mode: "cluster",
      instances: 2,

      // Autorestart on crash
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000,   // 4 s between restart attempts
      min_uptime: "10s",     // must stay up 10 s to count as stable

      // Memory guard — restart if backend exceeds 512 MB
      max_memory_restart: "512M",

      // Log files
      out_file: path.join(LOG_DIR, "api-out.log"),
      error_file: path.join(LOG_DIR, "api-error.log"),
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Log rotation (requires pm2-logrotate to be installed)
      // pm2 install pm2-logrotate
      // pm2 set pm2-logrotate:max_size 50M
      // pm2 set pm2-logrotate:retain 7

      // Environment — development
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },

      // Environment — production (activated with --env production)
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,

        // Node.js production flags
        NODE_OPTIONS: "--max-old-space-size=384",

        // These are READ from the backend .env file at runtime.
        // They are listed here as documentation only — PM2 will NOT
        // override values already set in .env.
        // SUPABASE_URL:                (from .env)
        // SUPABASE_SERVICE_ROLE_KEY:   (from .env)
        // JWT_SECRET:                  (from .env)
        // ORACLE_*:                    (from .env)
        // ALGORAND_*:                  (from .env)
        // VOI_*:                       (from .env)
        // SENDGRID_API_KEY:            (from .env)
        // ENCRYPTION_KEY:              (from .env)
      },

      // Graceful shutdown — allow 10 s for in-flight requests
      kill_timeout: 10000,
      listen_timeout: 8000,

      // Source map support for readable stack traces
      source_map_support: true,

      // Cron-based automatic restart (optional — nightly at 3 AM)
      // cron_restart: "0 3 * * *",
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Email Queue Worker
    //    Runs every 15 minutes via cron_restart.
    //    Reads email_queue table, sends up to (daily_limit / 96) emails per run.
    //    Single instance — never parallel to avoid double-sends.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: "imperialseal-email-worker",
      script: "src/jobs/emailQueue.js",
      cwd: BACKEND_DIR,

      // Single instance — must never run in parallel
      exec_mode: "fork",
      instances: 1,

      // The worker runs, does its job, and exits with code 0.
      // PM2 will restart it on the cron schedule below.
      autorestart: false,
      watch: false,

      // Cron: every 15 minutes
      // Format: "*/15 * * * *"
      cron_restart: "*/15 * * * *",

      // Safety: if the worker crashes repeatedly, back off
      max_restarts: 5,
      restart_delay: 30000,  // 30 s
      min_uptime: "5s",

      // Memory guard
      max_memory_restart: "256M",

      // Logs
      out_file: path.join(LOG_DIR, "email-worker-out.log"),
      error_file: path.join(LOG_DIR, "email-worker-error.log"),
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Environment — development
      env: {
        NODE_ENV: "development",
        JOB_NAME: "email-queue-worker",
      },

      // Environment — production
      env_production: {
        NODE_ENV: "production",
        JOB_NAME: "email-queue-worker",
        NODE_OPTIONS: "--max-old-space-size=192",
      },

      kill_timeout: 15000,   // allow 15 s to finish current batch
      source_map_support: true,
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Deploy configuration (optional — for pm2 deploy workflow)
  // Usage: pm2 deploy ecosystem.config.js production setup
  //        pm2 deploy ecosystem.config.js production update
  // ─────────────────────────────────────────────────────────────────────────
  deploy: {
    production: {
      user: "imperialseal",
      // Set DEPLOY_HOST env var or replace with your server IP/hostname
      host: process.env.DEPLOY_HOST || "YOUR_SERVER_IP",
      ref: "origin/main",
      repo: process.env.GIT_REPO_URL || "git@github.com:YOUR_ORG/imperialseal.git",
      path: "/var/www/imperialseal",
      "pre-deploy-local": "",
      "post-deploy": [
        "source ~/.nvm/nvm.sh",
        "cd backend && npm ci --production=false",
        "cd ../frontend && npm ci --production=false && npm run build",
        "pm2 reload ecosystem.config.js --env production",
        "pm2 save",
      ].join(" && "),
      "pre-setup": "",
    },
  },
};