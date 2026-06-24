// PM2 ecosystem config for the trading agent
// Cron expressions are in UTC. User timezone: Africa/Johannesburg (UTC+2)
// Target timezone for schedules: America/New_York (ET = UTC-4 in summer, UTC-5 in winter)
//
// Summer (EDT, UTC-4):  9:45 AM ET = 13:45 UTC | 10:00 AM ET = 14:00 UTC | 4:15 PM ET = 20:15 UTC
// Winter (EST, UTC-5): 9:45 AM ET = 14:45 UTC | 10:00 AM ET = 15:00 UTC | 4:15 PM ET = 21:15 UTC
//
// NOTE: Update cron expressions each time DST changes (Mar & Nov).
// Current setting: EDT (summer, UTC-4) — valid until ~first Sunday of November.

module.exports = {
  apps: [
    {
      name: "trading-morning-research",
      script: "/home/marnu/trading-agent/scripts/run-morning-research.sh",
      cron_restart: "45 13 * * 1-5",
      autorestart: false,
      watch: false,
      env: {
        PATH: "/home/marnu/.local/bin:/usr/local/bin:/usr/bin:/bin",
      },
    },
    {
      name: "trading-session",
      script: "/home/marnu/trading-agent/scripts/run-trading-session.sh",
      cron_restart: "0 14 * * 1-5",
      autorestart: false,
      watch: false,
      env: {
        PATH: "/home/marnu/.local/bin:/usr/local/bin:/usr/bin:/bin",
      },
    },
    {
      name: "trading-eod-journal",
      script: "/home/marnu/trading-agent/scripts/run-eod-journal.sh",
      cron_restart: "15 20 * * 1-5",
      autorestart: false,
      watch: false,
      env: {
        PATH: "/home/marnu/.local/bin:/usr/local/bin:/usr/bin:/bin",
      },
    },
    {
      name: "trading-dashboard-api",
      script: "/home/marnu/.local/bin/uvicorn",
      args: "main:app --host 127.0.0.1 --port 8001",
      cwd: "/home/marnu/trading-agent/dashboard/backend",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        PATH: "/home/marnu/.local/bin:/usr/local/bin:/usr/bin:/bin",
      },
    },
  ],
};
