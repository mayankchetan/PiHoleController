const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = process.env.LOG_FILE || '/var/log/pihole-controller/access.log';

// Load multi-pihole configuration
const piholeCount = parseInt(process.env.PIHOLE_COUNT || 1);
const piholes = [];

for (let i = 1; i <= piholeCount; i++) {
  const name = process.env[`PIHOLE_${i}_NAME`];
  const url = process.env[`PIHOLE_${i}_URL`];
  const password = process.env[`PIHOLE_${i}_PASSWORD`];

  if (name && url && password) {
    piholes.push({ name, url, password });
    console.log(`Loaded Pi-hole ${i}: ${name} - ${url}`);
  }
}

console.log(`Total Pi-holes configured: ${piholes.length}`);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Helper to get client IP
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.connection.remoteAddress;
}

// Get list of available Pi-holes (WITH credentials, as frontend needs to execute parallel actions)
app.get('/api/piholes', (req, res) => {
  // Return full details including passwords so frontend can act as the agent
  res.json({ piholes: piholes });
});

// Logging endpoint
app.post('/api/log', (req, res) => {
  const { action, duration, timestamp, piholeUrl, piholeName, userAgent } = req.body;
  const clientIP = getClientIP(req);

  const logEntry = {
    timestamp: timestamp || new Date().toISOString(),
    ip: clientIP,
    pihole: piholeName || 'Unknown',
    action: action,
    duration: duration || null,
    piholeUrl: piholeUrl,
    userAgent: userAgent || req.headers['user-agent']
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  fs.appendFile(LOG_FILE, logLine, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
      return res.status(500).json({ error: 'Failed to log action' });
    }

    console.log(`Action logged: ${action} from ${clientIP} [${piholeName}]`);
    res.json({ success: true, logged: logEntry });
  });
});

// Get recent logs
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;

  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.json({ logs: [], count: 0 });
      }
      return res.status(500).json({ error: 'Failed to read logs' });
    }

    const lines = data.trim().split('\n').filter(line => line);
    const logs = lines.slice(-limit).map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return { raw: line };
      }
    }).reverse();

    res.json({ logs, count: logs.length });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    piholes: piholes.length
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pi-hole Controller backend running on port ${PORT}`);
    console.log(`Log file: ${LOG_FILE}`);
  });
}

module.exports = app;
