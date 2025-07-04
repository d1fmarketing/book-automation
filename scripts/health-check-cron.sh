#!/bin/bash

# Health Check Cron Script
# Add to crontab with: */5 * * * * /path/to/health-check-cron.sh

# Change to project directory
cd "$(dirname "$0")/.." || exit 1

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Run health check
/usr/local/bin/node scripts/health-monitor.js

# Alternative: Run as one-shot check
# This is useful for cron where you don't want a long-running process
/usr/local/bin/node -e "
const { runHealthChecks } = require('./scripts/health-monitor.js');
(async () => {
    await runHealthChecks();
    process.exit(0);
})();
"