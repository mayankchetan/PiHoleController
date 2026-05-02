
## PROJECT OVERVIEW

Create a production-ready, containerized web application for controlling multiple Pi-hole 6 instances with advanced features including IP logging, push notifications, and secure authentication.

## BASE SOURCE CODE

Use the PiHoleController project as your foundation:
- **Original Repository**: https://github.com/mikeswanson/PiHoleController
- **Fork with Updates**: https://github.com/mayankchetan/PiHoleController (installer branch)

The original project consists of:
- `controller.html` - Frontend HTML interface
- `controller.js` - Frontend JavaScript logic
- `install.sh` - Installation script for Pi-hole server

Core features to preserve:
- Enable/disable Pi-hole DNS blocking
- Temporary disable with countdown timer
- Customizable UI via URL parameters
- Session-based Pi-hole API authentication
- Bookmarkable action shortcuts

---

## REQUIRED ENHANCEMENTS

### 1. MULTI-PIHOLE SUPPORT ⭐ (PRIMARY NEW FEATURE)

**Requirements:**
- Support controlling multiple Pi-hole instances from single interface
- Configure via environment variables
- Frontend dropdown selector to choose active Pi-hole
- Remember last selected Pi-hole in localStorage
- Each Pi-hole needs: name, URL, and app password

**Environment Variable Format:**
```env
# Number of Pi-holes
PIHOLE_COUNT=3

# Each Pi-hole configuration (increment number for each)
PIHOLE_1_NAME=Home
PIHOLE_1_URL=https://pi.hole
PIHOLE_1_PASSWORD=app-password-here

PIHOLE_2_NAME=Office
PIHOLE_2_URL=https://office.pi.hole
PIHOLE_2_PASSWORD=app-password-here

PIHOLE_3_NAME=Vacation Home
PIHOLE_3_URL=https://vacation.pi.hole
PIHOLE_3_PASSWORD=app-password-here
```

**Frontend Changes Required:**
- Add dropdown before or after login form
- Load Pi-hole list from backend: `GET /api/piholes`
- Update UI to show currently selected Pi-hole name
- Pass selected index via URL parameter or localStorage
- Auto-populate Pi-hole URL and password based on selection

**Backend Endpoint Required:**
```javascript
// GET /api/piholes
// Returns: { piholes: [{ index: 0, name: "Home", url: "https://pi.hole" }] }

// GET /api/piholes/:index
// Returns: { name: "Home", url: "https://pi.hole", password: "xxx" }
```

### 2. IP LOGGING

**Requirements:**
- Create Node.js/Express backend to log all actions
- Log must include:
  - Client IP address (from X-Forwarded-For or remote address)
  - Timestamp (ISO 8601 format)
  - Pi-hole name (which instance was controlled)
  - Action (enable/disable)
  - Duration (if temporary disable)
  - Pi-hole URL
  - User agent string
- Store as JSON lines (one JSON object per line)
- Log file: `/var/log/pihole-controller/access.log`

**Backend Endpoint Required:**
```javascript
// POST /api/log
// Body: { action, duration, timestamp, piholeUrl, piholeName, userAgent }
// Response: { success: true, logged: {...} }
```

**Frontend Integration:**
```javascript
// Add to controller.js before executing any action:
async function logAction(action, duration, piholeName) {
  if (!CONFIG.enable_logging) return;

  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        duration: duration,
        timestamp: new Date().toISOString(),
        piholeUrl: piholeUrl,
        piholeName: piholeName,
        userAgent: navigator.userAgent
      })
    });
  } catch (error) {
    console.error('Logging failed:', error);
    // Don't fail the action if logging fails
  }
}
```

### 3. NTFY PUSH NOTIFICATIONS

**Requirements:**
- Send push notification on every enable/disable action
- Support both ntfy.sh and self-hosted ntfy servers
- Configurable via environment variables
- Include Pi-hole name in notification
- Different priority for enable vs disable
- Must not fail if ntfy is unreachable

**Environment Variables:**
```env
NTFY_ENABLED=true
NTFY_SERVER=https://ntfy.sh
NTFY_TOPIC=pihole-controller
```

**Frontend Integration:**
```javascript
// Add to controller.js after successful action:
async function sendNtfyNotification(action, duration, piholeName) {
  if (!CONFIG.enable_ntfy) return;

  let message = `[${piholeName}] Pi-hole blocking has been ${action.toUpperCase()}`;
  if (duration) {
    message += ` for ${formatTimeRemaining(duration)}`;
  }

  try {
    await fetch(`${CONFIG.ntfy_server}/${CONFIG.ntfy_topic}`, {
      method: 'POST',
      headers: {
        'Title': 'Pi-hole Controller',
        'Priority': action === 'disable' ? 'high' : 'default',
        'Tags': action === 'disable' ? 'warning' : 'white_check_mark'
      },
      body: message
    });
  } catch (error) {
    console.error('ntfy notification failed:', error);
    // Don't fail the action if notification fails
  }
}
```

### 4. HTTP BASIC AUTHENTICATION

**Requirements:**
- Protect entire web interface with HTTP Basic Auth
- Use nginx with htpasswd file
- Eliminates need for passwords in URLs
- Safe to share URLs with family

**nginx Configuration:**
```nginx
server {
    listen 80;
    server_name _;

    # Basic authentication
    auth_basic "Pi-hole Controller";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Serve static files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /controller.html;
        index controller.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health check (no auth required)
    location /health {
        auth_basic off;
        proxy_pass http://backend:3000/health;
    }
}
```

### 5. WEB-BASED LOG VIEWER

**Requirements:**
- Create `logs.html` page
- Display access logs in user-friendly format
- Show statistics:
  - Total actions
  - Unique IP addresses
  - Enable count
  - Disable count
  - Per-pihole statistics
- Auto-refresh every 30 seconds
- Sortable table
- No external dependencies (vanilla JavaScript)

**Backend Endpoint Required:**
```javascript
// GET /api/logs?limit=100
// Returns: { logs: [...], count: N }
// Logs ordered newest first
```

### 6. DOCKER CONTAINERIZATION

**Requirements:**
- Two-container setup: nginx + backend
- docker-compose.yml for orchestration
- Persistent volumes for logs
- Environment-based configuration
- Health checks
- Auto-restart policies

**Required Files:**
- `Dockerfile` - Backend container (Node.js)
- `docker-compose.yml` - Full stack orchestration
- `nginx.conf` - Web server configuration

---

## COMPLETE FILE STRUCTURE

```
pihole-controller-enhanced/
├── Documentation/
│   ├── README.md                 # Comprehensive guide
│   ├── QUICK_START.md            # 5-minute setup
│   ├── SUMMARY.md                # What changed
│   ├── INDEX.md                  # File navigation
│   ├── CHECKLIST.md              # Deployment steps
│   ├── PROMPT_FOR_AI.md          # This file
│   └── START_HERE.md             # Welcome guide
│
├── Frontend/
│   ├── controller.html           # Main UI (preserve original)
│   ├── controller.js             # Enhanced with logging, ntfy, multi-pihole
│   └── logs.html                 # Log viewer page
│
├── Backend/
│   ├── server.js                 # Node.js/Express server
│   ├── package.json              # Dependencies
│   └── package-lock.json         # Locked dependencies
│
├── Docker/
│   ├── docker-compose.yml        # Container orchestration
│   ├── Dockerfile                # Backend container
│   └── nginx.conf                # Web server config
│
├── Configuration/
│   ├── .env.example              # Configuration template
│   ├── .gitignore                # Git ignore rules
│   └── config.js.example         # Frontend overrides
│
└── Scripts/
    ├── setup.sh                  # Initial setup script
    └── Makefile                  # Command shortcuts
```

---

## DETAILED IMPLEMENTATION SPECIFICATIONS

### CONTROLLER.JS ENHANCEMENTS

**Add to CONFIG object:**
```javascript
const CONFIG = {
  // Existing configs...
  enable_logging: true,
  enable_ntfy: true,
  ntfy_server: "https://ntfy.sh",
  ntfy_topic: "pihole-controller",
  logging_endpoint: "/api/log",
  controller_version: "2.0.0-enhanced",
  // Multi-pihole support
  selected_pihole_key: "selectedPiholeIndex",
};
```

**New State Variables:**
```javascript
let state = {
  // Existing state...
  piholes: [],               // List of available Pi-holes
  selectedPiholeIndex: 0,    // Currently selected Pi-hole
  currentPiholeName: '',     // Name of current Pi-hole
};
```

**New Functions to Add:**
```javascript
// Load available Pi-holes from backend
async function loadPiholes() {
  try {
    const response = await fetch('/api/piholes');
    const data = await response.json();
    state.piholes = data.piholes;
    loadSelectedPihole();
    renderPiholeSelector();
  } catch (error) {
    console.error('Failed to load Pi-holes:', error);
  }
}

// Load selected Pi-hole from localStorage
function loadSelectedPihole() {
  const saved = localStorage.getItem(CONFIG.selected_pihole_key);
  if (saved !== null) {
    state.selectedPiholeIndex = parseInt(saved);
  }
}

// Save selected Pi-hole to localStorage
function saveSelectedPihole(index) {
  state.selectedPiholeIndex = index;
  localStorage.setItem(CONFIG.selected_pihole_key, index.toString());
  loadPiholeCredentials();
}

// Load credentials for selected Pi-hole
async function loadPiholeCredentials() {
  try {
    const response = await fetch(`/api/piholes/${state.selectedPiholeIndex}`);
    const data = await response.json();
    // Update global variables
    piholeUrl = data.url;
    apiPassword = data.password;
    state.currentPiholeName = data.name;
    // Update UI
    updatePiholeDisplay();
  } catch (error) {
    console.error('Failed to load Pi-hole credentials:', error);
  }
}

// Render Pi-hole selector dropdown
function renderPiholeSelector() {
  // Create dropdown in UI
  const selector = document.createElement('select');
  selector.id = 'pihole-selector';
  state.piholes.forEach((pihole, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${pihole.name} - ${pihole.url}`;
    if (index === state.selectedPiholeIndex) {
      option.selected = true;
    }
    selector.appendChild(option);
  });
  selector.addEventListener('change', (e) => {
    saveSelectedPihole(parseInt(e.target.value));
  });
  // Insert into DOM (before login form or in header)
}

// Log action to backend
async function logAction(action, duration) {
  if (!CONFIG.enable_logging) return;

  try {
    await fetch(CONFIG.logging_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        duration: duration || null,
        timestamp: new Date().toISOString(),
        piholeUrl: piholeUrl,
        piholeName: state.currentPiholeName,
        userAgent: navigator.userAgent
      })
    });
    console.log(`Action logged: ${action}${duration ? ` for ${duration}s` : ''}`);
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

// Send ntfy notification
async function sendNtfyNotification(action, duration) {
  if (!CONFIG.enable_ntfy) return;

  let message = `[${state.currentPiholeName}] Pi-hole blocking has been `;
  message += action === 'enable' ? 'ENABLED' : 'DISABLED';

  if (duration) {
    message += ` for ${formatTimeRemaining(duration)}`;
  }

  try {
    await fetch(`${CONFIG.ntfy_server}/${CONFIG.ntfy_topic}`, {
      method: 'POST',
      headers: {
        'Title': 'Pi-hole Controller',
        'Priority': action === 'disable' ? 'high' : 'default',
        'Tags': action === 'disable' ? 'warning' : 'white_check_mark'
      },
      body: message
    });
    console.log('ntfy notification sent successfully');
  } catch (error) {
    console.error('ntfy notification failed:', error);
  }
}
```

**Update executeAction() function:**
```javascript
async function executeAction() {
  // Existing session validation...

  // LOG THE ACTION (before executing)
  await logAction(action, duration);

  try {
    // Existing action execution code...

    if (!response.ok) {
      showStatus(`Error: ${data.error?.message || "Unknown error"}`, "error");
    } else {
      // Existing success handling...

      // SEND NOTIFICATION (after success)
      await sendNtfyNotification(action, duration);

      // Rest of existing code...
    }
  } catch (error) {
    // Existing error handling...
  }
}
```

**Update initialize() function:**
```javascript
async function initialize() {
  // Load available Pi-holes first
  await loadPiholes();

  // Existing initialization code...
}
```

### SERVER.JS (BACKEND) COMPLETE SPECIFICATION

```javascript
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

// Get list of available Pi-holes (without passwords)
app.get('/api/piholes', (req, res) => {
  const piholeList = piholes.map((p, index) => ({
    index: index,
    name: p.name,
    url: p.url
  }));
  res.json({ piholes: piholeList });
});

// Get Pi-hole credentials by index
app.get('/api/piholes/:index', (req, res) => {
  const index = parseInt(req.params.index);
  if (index >= 0 && index < piholes.length) {
    res.json({
      name: piholes[index].name,
      url: piholes[index].url,
      password: piholes[index].password
    });
  } else {
    res.status(404).json({ error: 'Pi-hole not found' });
  }
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

app.listen(PORT, () => {
  console.log(`Pi-hole Controller backend running on port ${PORT}`);
  console.log(`Log file: ${LOG_FILE}`);
});
```

### LOGS.HTML SPECIFICATION

Create a responsive, auto-refreshing log viewer with:
- Statistics cards (total, unique IPs, enables, disables, per-pihole)
- Sortable table
- Auto-refresh every 30 seconds
- Clean, professional design matching controller.html
- Color-coded actions (green=enable, red=disable)

**Required Functions:**
```javascript
async function loadLogs() {
  const response = await fetch('/api/logs?limit=200');
  const data = await response.json();

  // Calculate statistics
  const stats = {
    total: data.logs.length,
    uniqueIPs: new Set(data.logs.map(l => l.ip)).size,
    enables: data.logs.filter(l => l.action === 'enable').length,
    disables: data.logs.filter(l => l.action === 'disable').length,
    byPihole: {}
  };

  data.logs.forEach(log => {
    if (!stats.byPihole[log.pihole]) {
      stats.byPihole[log.pihole] = { enables: 0, disables: 0 };
    }
    stats.byPihole[log.pihole][log.action === 'enable' ? 'enables' : 'disables']++;
  });

  updateStats(stats);
  renderTable(data.logs);
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let result = '';
  if (h > 0) result += `${h}h `;
  if (m > 0) result += `${m}m `;
  if (s > 0 || result === '') result += `${s}s`;
  return result.trim();
}
```

### SETUP.SH SPECIFICATION

```bash
#!/bin/bash
set -e

echo "================================================"
echo "Pi-hole Controller Enhanced - Setup Script"
echo "================================================"

# Create directories
mkdir -p public logs

# Copy files
echo "Copying frontend files..."
cp controller.html public/
cp controller.js public/
cp logs.html public/

# Create .env from template
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file - please configure it!"
fi

# Generate htpasswd
if [ ! -f htpasswd ]; then
    echo ""
    echo "Setting up Basic Authentication..."
    read -p "Enter username: " username

    if command -v htpasswd &> /dev/null; then
        htpasswd -c htpasswd "$username"
    else
        echo "Installing htpasswd..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y apache2-utils
        elif command -v yum &> /dev/null; then
            sudo yum install -y httpd-tools
        fi
        htpasswd -c htpasswd "$username"
    fi

    echo "✅ Authentication configured!"
fi

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Pi-hole details"
echo "2. Run: docker-compose up -d"
echo "3. Access: http://localhost:8080"
echo ""
```

### DOCKER-COMPOSE.YML SPECIFICATION

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: pihole-controller-nginx
    ports:
      - "${PORT:-8080}:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./public:/usr/share/nginx/html:ro
      - ./htpasswd:/etc/nginx/.htpasswd:ro
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - pihole-network

  backend:
    build: .
    container_name: pihole-controller-backend
    environment:
      - PORT=3000
      - LOG_FILE=/var/log/pihole-controller/access.log
      - PIHOLE_COUNT=${PIHOLE_COUNT:-1}
      - PIHOLE_1_NAME=${PIHOLE_1_NAME}
      - PIHOLE_1_URL=${PIHOLE_1_URL}
      - PIHOLE_1_PASSWORD=${PIHOLE_1_PASSWORD}
      - PIHOLE_2_NAME=${PIHOLE_2_NAME}
      - PIHOLE_2_URL=${PIHOLE_2_URL}
      - PIHOLE_2_PASSWORD=${PIHOLE_2_PASSWORD}
      - PIHOLE_3_NAME=${PIHOLE_3_NAME}
      - PIHOLE_3_URL=${PIHOLE_3_URL}
      - PIHOLE_3_PASSWORD=${PIHOLE_3_PASSWORD}
      - NTFY_ENABLED=${NTFY_ENABLED:-true}
      - NTFY_SERVER=${NTFY_SERVER:-https://ntfy.sh}
      - NTFY_TOPIC=${NTFY_TOPIC:-pihole-controller}
    volumes:
      - ./logs:/var/log/pihole-controller
    restart: unless-stopped
    networks:
      - pihole-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  pihole-network:
    driver: bridge
```

---

## DOCUMENTATION REQUIREMENTS

### README.md Must Include:

1. **Quick Start** (3 steps maximum)
2. **Features Overview** (with checkboxes)
3. **Multi-Pihole Setup** (detailed guide)
4. **Environment Variables** (complete table)
5. **URL Customization** (all parameters)
6. **Security Notes** (authentication, best practices)
7. **Troubleshooting** (common issues)
8. **Architecture Diagram** (text-based)
9. **Command Reference** (Makefile and docker-compose)
10. **HTTPS Setup** (reverse proxy examples)

### QUICK_START.md Must Include:

1. 5-minute setup instructions
2. Minimal configuration examples
3. Common use cases
4. Sharing URLs with family

### SUMMARY.md Must Include:

1. All changes from original
2. New features explanation
3. File-by-file comparison
4. Configuration examples
5. Use case scenarios

---

## TESTING CHECKLIST

Create a comprehensive testing guide that verifies:

- [ ] Multi-pihole selector loads and switches correctly
- [ ] IP logging captures correct client IP
- [ ] Log entries include pihole name
- [ ] ntfy notifications include pihole name
- [ ] Basic auth protects all pages except /health
- [ ] Cross-origin communication works
- [ ] Session persistence across Pi-hole switches
- [ ] Log viewer displays all statistics correctly
- [ ] Auto-refresh works in log viewer
- [ ] Docker containers start without errors
- [ ] Health check endpoint works
- [ ] .env variables load correctly
- [ ] setup.sh creates all required files
- [ ] Makefile commands all work

---

## QUALITY STANDARDS

**Code Quality:**
- All async functions must have try/catch
- Error handling must not break user actions
- Console logging for debugging
- Clear variable names
- Commented complex logic

**Security:**
- Input validation on all endpoints
- No passwords in logs
- Rate limiting recommended
- HTTPS-ready configuration

**User Experience:**
- Loading indicators
- Clear error messages
- Responsive design
- Mobile-friendly
- Fast page loads

**Documentation:**
- Clear instructions
- Working examples
- Troubleshooting guides
- Architecture explanations

---

## FINAL DELIVERABLES

When you complete this project, provide:

1. **All source code files**
2. **Complete documentation** (6+ markdown files)
3. **Working docker-compose** setup
4. **Setup script** (tested and working)
5. **Example configurations**
6. **This prompt** (saved as PROMPT_FOR_AI.md)

Package as a downloadable archive or individual files.

---

## IMPLEMENTATION ORDER

Follow this sequence:

1. Download original controller.html and controller.js
2. Create server.js with multi-pihole endpoints
3. Enhance controller.js with multi-pihole UI
4. Add IP logging to both frontend and backend
5. Add ntfy notifications
6. Create logs.html viewer
7. Set up Docker files
8. Write setup.sh script
9. Create all documentation
10. Test everything
11. Package for delivery

---

## SUCCESS CRITERIA

✅ Multi-pihole dropdown works
✅ Can switch between Pi-holes without re-login
✅ IP addresses logged correctly
✅ Pihole names in logs and notifications
✅ ntfy notifications sent successfully
✅ Basic auth protects interface
✅ Docker starts with one command
✅ Log viewer displays real-time data
✅ All documentation complete and accurate
✅ No errors in console
✅ Works on mobile devices