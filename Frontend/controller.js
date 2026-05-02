// ====================================================
// CONFIGURATION
// ====================================================
const CONFIG = {
  preset_durations: [
    { label: "10 sec", value: 10 },
    { label: "30 sec", value: 30 },
    { label: "1 min", value: 60 },
    { label: "5 min", value: 300 },
    { label: "10 min", value: 600 },
    { label: "Custom", value: "custom" },
  ],
  refresh_interval: 5,
  session_refresh_buffer: 30,
  storage_key: "piholeSession",
  custom_duration_key: "piholeCustomDuration",
  controller_version: "2.0.0-enhanced",
  fetch_timeout_ms: 10000,
  github_url: "https://github.com/mikeswanson/PiHoleController",
  // New Configs
  enable_logging: true,
  enable_ntfy: true,
  ntfy_server: "https://ntfy.sh",
  ntfy_topic: "pihole-controller",
  logging_endpoint: "/api/log",
};

// ====================================================
// STATE MANAGEMENT
// ====================================================
let state = {
  piholes: [], // Array of { name, url, password, sid, sidValidity, sidCreatedAt, csrf, blockingStatus, timer }
  timerEndTime: null,
  countdownInterval: null,
  autoRefreshInterval: null,
  sessionCheckInterval: null,
};

// Helper function to parse boolean parameters strictly
function parseStrictBoolean(value, defaultValue) {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
// Note: url and pwd params are deprecated in favor of backend config,
// but we keep them for backward compatibility if backend returns nothing.
const paramPiholeUrl = urlParams.get("url");
const paramApiPassword = urlParams.get("pwd");

const action = urlParams.get("action"); // 'enable', 'disable', or null
const duration = urlParams.get("duration")
  ? parseInt(urlParams.get("duration"))
  : null;
const customTitle = urlParams.get("title") || "Pi-hole Controller";
const showEnableDisable = parseStrictBoolean(
  urlParams.get("showButtons"),
  true
);
const showPresets = parseStrictBoolean(urlParams.get("showPresets"), true);
const showTips = parseStrictBoolean(urlParams.get("showTips"), true);
const showFooter = parseStrictBoolean(urlParams.get("showFooter"), true);
const customPresets = urlParams.get("presets"); // Custom comma-separated preset times

// Process custom presets
if (customPresets) {
  try {
    const presetItems = customPresets.split(",");
    const customPresetArray = [];

    presetItems.forEach((item) => {
      const parts = item.split(":");
      if (parts.length === 2) {
        const label = decodeURIComponent(parts[0].trim());
        const value = parts[1].trim().toLowerCase();

        if (value === "custom") {
          customPresetArray.push({ label, value: "custom" });
        } else {
          let numValue = parseInt(value);
          if (!isNaN(numValue)) {
            if (value.endsWith("m")) {
              numValue *= 60;
            }
            customPresetArray.push({ label, value: numValue });
          }
        }
      }
    });

    if (customPresetArray.length > 0) {
      CONFIG.preset_durations = customPresetArray;
    }
  } catch (e) {
    console.error("Error parsing custom presets:", e);
  }
}

// ====================================================
// DOM ELEMENTS
// ====================================================
const elements = {
  loginCard: document.getElementById("login-card"),
  mainCard: document.getElementById("main-card"),
  loginForm: document.getElementById("login-form"),
  loginStatus: document.getElementById("login-status"),
  piholeUrlInput: document.getElementById("pihole-url-input"),
  passwordInput: document.getElementById("password-input"),
  statusDisplay: document.getElementById("status-display"),
  timerDisplay: document.getElementById("timer-display"),
  enableButton: document.getElementById("enable-button"),
  disableButton: document.getElementById("disable-button"),
  presetContainer: document.getElementById("preset-container"),
  customDurationDiv: document.getElementById("custom-duration"),
  applyCustomButton: document.getElementById("apply-custom"),
  apiSettingsLink: document.getElementById("api-settings-link"),
  adminLink: document.getElementById("admin-link"),
};

// ====================================================
// MULTI-PIHOLE & LOGGING FUNCTIONS
// ====================================================

async function loadPiholes() {
  try {
    const response = await fetch('/api/piholes');
    if (response.ok) {
      const data = await response.json();
      if (data.piholes && data.piholes.length > 0) {
        // Initialize state for each pihole
        state.piholes = data.piholes.map(p => ({
          ...p,
          sid: null,
          sidValidity: null,
          sidCreatedAt: null,
          csrf: null,
          blockingStatus: null
        }));
        console.log(`Loaded ${state.piholes.length} Pi-holes from backend.`);
        return true;
      }
    }
  } catch (e) {
    console.warn("Failed to load Pi-holes from backend (might be standalone mode):", e);
  }

  // Fallback to URL params if no backend config
  if (paramPiholeUrl && paramApiPassword) {
    state.piholes = [{
      name: "Pi-hole",
      url: paramPiholeUrl,
      password: paramApiPassword,
      sid: null,
      sidValidity: null,
      sidCreatedAt: null,
      csrf: null,
      blockingStatus: null
    }];
    console.log("Loaded single Pi-hole from URL parameters.");
    return true;
  }

  return false;
}

async function logAction(action, duration, pihole) {
  if (!CONFIG.enable_logging) return;

  try {
    await fetch(CONFIG.logging_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        duration: duration || null,
        timestamp: new Date().toISOString(),
        piholeUrl: pihole.url,
        piholeName: pihole.name,
        userAgent: navigator.userAgent
      })
    });
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

async function sendNtfyNotification(action, duration, pihole) {
  if (!CONFIG.enable_ntfy) return;

  let message = `[${pihole.name}] Pi-hole blocking has been ${action.toUpperCase()}`;
  if (duration) {
    message += ` for ${formatTimeRemaining(duration)}`;
  }

  try {
    // We send this to the backend? Or direct?
    // Prompt says: "Frontend Integration... fetch(`${CONFIG.ntfy_server}/${CONFIG.ntfy_topic}`..."
    // BUT CORS might be an issue if self-hosted or ntfy.sh doesn't allow it from our origin.
    // However, user explicitly provided frontend code. We'll use that.

    // Note: If using self-hosted ntfy without CORS headers, this might fail from browser.
    // Ideally this should be proxied, but per instructions we implement in frontend.
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
  }
}

// ====================================================
// SESSION STORAGE FUNCTIONS (Updated for Multi)
// ====================================================
function saveSessionData() {
  const sessionData = state.piholes.map(p => ({
    url: p.url,
    sid: p.sid,
    sidCreatedAt: p.sidCreatedAt,
    sidValidity: p.sidValidity,
    csrf: p.csrf
  }));

  try {
    localStorage.setItem(CONFIG.storage_key, JSON.stringify(sessionData));
    // console.log("Session data saved to localStorage");
  } catch (e) {
    console.error("Error saving session to localStorage:", e);
  }
}

function loadSessionData() {
  try {
    const data = localStorage.getItem(CONFIG.storage_key);
    if (data) {
      const sessionData = JSON.parse(data);
      if (Array.isArray(sessionData)) {
        // Map saved sessions back to configured piholes
        state.piholes.forEach(p => {
          const saved = sessionData.find(s => s.url === p.url);
          if (saved) {
            p.sid = saved.sid;
            p.sidCreatedAt = saved.sidCreatedAt;
            p.sidValidity = saved.sidValidity;
            p.csrf = saved.csrf;
          }
        });
        console.log("Session data loaded from localStorage");
        // Verify validity of at least one? Or just proceed to auth check
        return true;
      }
    }
  } catch (e) {
    console.error("Error loading session from localStorage:", e);
  }
  return false;
}

function clearSessionData() {
  try {
    localStorage.removeItem(CONFIG.storage_key);
    console.log("Session data cleared from localStorage");
  } catch (e) {
    console.error("Error clearing session from localStorage:", e);
  }
}

function isSessionValid(pihole) {
  if (!pihole.sid || !pihole.sidCreatedAt || !pihole.sidValidity) return false;
  const now = Date.now();
  const expirationTime = pihole.sidCreatedAt + pihole.sidValidity * 1000;
  return now < expirationTime;
}

// ====================================================
// UI HELPER FUNCTIONS
// ====================================================
function showStatus(message, type) {
  elements.statusDisplay.className = `status ${type}`;
  elements.statusDisplay.textContent = message;
}

function formatTimeRemaining(totalSeconds) {
  if (totalSeconds <= 0) return "0s";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let timeString = "";
  if (hours > 0) {
    timeString += `${hours}h `;
  }
  if (hours > 0 || minutes > 0) {
    timeString += `${minutes}m `;
  }
  timeString += `${seconds}s`;
  return timeString;
}

// Helper: fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = CONFIG.fetch_timeout_ms) {
  const controller = new AbortController();
  const id = setTimeout(() => {
    try { controller.abort(); } catch (_) {}
  }, timeoutMs);
  try {
    const opts = { ...options, signal: controller.signal };
    return await fetch(url, opts);
  } finally {
    clearTimeout(id);
  }
}

// Helper: treat both 401 and 403 as unauthorized
function isUnauthorized(response) {
  return response && (response.status === 401 || response.status === 403);
}

// Helper: check origin
function isSameOrigin(url) {
  try {
    return new URL(url).origin === window.location.origin;
  } catch (e) {
    return false;
  }
}

function getFetchOptions(method, body = null, pihole) {
  const options = { method, headers: {} };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  if (isSameOrigin(pihole.url)) {
    options.credentials = "include";
    if (pihole.csrf) {
      options.headers["X-CSRF-Token"] = pihole.csrf;
    }
  }
  return options;
}

// ====================================================
// CORE LOGIC (Multi-Pihole)
// ====================================================

async function createNewSession(pihole) {
  try {
    const options = getFetchOptions("POST", { password: pihole.password }, pihole);
    const response = await fetchWithTimeout(`${pihole.url}/api/auth`, options);
    const data = await response.json();

    if (response.ok && data.session?.valid) {
      pihole.sid = data.session.sid;
      pihole.sidValidity = data.session.validity;
      pihole.sidCreatedAt = Date.now();
      pihole.csrf = data.session.csrf || null;
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Auth failed for ${pihole.name}:`, error);
    return false;
  }
}

async function authenticateAll() {
  loadSessionData();

  const results = await Promise.allSettled(state.piholes.map(async (p) => {
    if (isSessionValid(p)) {
      // Verify existing session
      try {
        const options = getFetchOptions("GET", null, p);
        const response = await fetchWithTimeout(
          `${p.url}/api/dns/blocking?sid=${encodeURIComponent(p.sid)}`,
          options
        );
        if (response.ok) return true;
        p.sid = null; // Invalid
      } catch (e) {
        p.sid = null;
      }
    }
    // Create new session
    return await createNewSession(p);
  }));

  saveSessionData();

  // Return true if AT LEAST ONE is authenticated? Or All?
  // Let's require at least one to show the UI.
  const successCount = results.filter(r => r.status === "fulfilled" && r.value === true).length;
  return successCount > 0;
}

async function checkBlockingStatus() {
  // Update status for all
  await Promise.allSettled(state.piholes.map(async (p) => {
    if (!p.sid) await createNewSession(p); // Try to reconnect if dropped

    if (p.sid) {
      try {
        const options = getFetchOptions("GET", null, p);
        const response = await fetchWithTimeout(
          `${p.url}/api/dns/blocking?sid=${encodeURIComponent(p.sid)}`,
          options
        );
        if (response.ok) {
           const data = await response.json();
           p.blockingStatus = data.blocking === true || data.blocking === "enabled";
           p.timer = data.timer;
        }
      } catch (e) {
        console.error(`Status check failed for ${p.name}`, e);
      }
    }
  }));

  saveSessionData();
  updateGlobalStatusDisplay();
}

function updateGlobalStatusDisplay() {
  const activePiholes = state.piholes.filter(p => p.sid);
  if (activePiholes.length === 0) {
    showStatus("No active Pi-hole connections", "error");
    return;
  }

  const enabledCount = activePiholes.filter(p => p.blockingStatus).length;
  const timerPihole = activePiholes.find(p => p.timer); // Find one with a timer

  // Logic:
  // If all enabled -> "All X Pi-holes ENABLED"
  // If all disabled -> "All X Pi-holes DISABLED"
  // Mixed -> "X/Y Pi-holes ENABLED"

  let msg = "";
  let type = "info";
  let buttonState = { enable: false, disable: false };

  if (enabledCount === activePiholes.length) {
    msg = `${activePiholes.length} Pi-hole${activePiholes.length > 1 ? 's' : ''} blocking ENABLED`;
    type = "success";
    buttonState.enable = true; // Disable "Enable" button
    buttonState.disable = false;
  } else if (enabledCount === 0) {
    msg = `${activePiholes.length} Pi-hole${activePiholes.length > 1 ? 's' : ''} blocking DISABLED`;
    type = "warning";
    buttonState.enable = false;
    buttonState.disable = true; // Disable "Disable" button
  } else {
    msg = `${enabledCount}/${activePiholes.length} Pi-holes blocking ENABLED`;
    type = "info"; // Mixed state
    buttonState.enable = false;
    buttonState.disable = false;
  }

  if (timerPihole) {
    msg += ` (Timer active)`;
    startCountdown(timerPihole.timer);
  } else {
    stopCountdown();
    elements.timerDisplay.textContent = "";
  }

  showStatus(msg, type);

  elements.enableButton.disabled = buttonState.enable;
  elements.disableButton.disabled = buttonState.disable;
}

async function executeAction() {
  elements.enableButton.disabled = true;
  elements.disableButton.disabled = true;

  const blocking = action === "enable";
  const payload = { blocking };
  if (duration > 0 && action === "disable") {
    payload.timer = duration;
  }

  const results = await Promise.allSettled(state.piholes.map(async (p) => {
    if (!p.sid) await createNewSession(p);

    // Log intent (optional, or log success later)

    const options = getFetchOptions("POST", payload, p);
    const response = await fetchWithTimeout(
      `${p.url}/api/dns/blocking?sid=${encodeURIComponent(p.sid)}`,
      options
    );

    if (response.ok) {
      const data = await response.json();
      // Update session if returned
      if (data.session?.sid) {
        p.sid = data.session.sid;
        p.csrf = data.session.csrf || null;
        p.sidValidity = data.session.validity;
        p.sidCreatedAt = Date.now();
      }

      // Log Success
      await logAction(action, duration, p);
      await sendNtfyNotification(action, duration, p);

      return true;
    }
    throw new Error(response.statusText);
  }));

  // Refresh status
  await checkBlockingStatus();

  // Show Result Message
  const successCount = results.filter(r => r.status === "fulfilled").length;
  if (successCount === state.piholes.length) {
     const statusAction = action === "enable" ? "ENABLED" : "DISABLED";
     let finalMsg = `All ${state.piholes.length} Pi-holes ${statusAction}`;
     if (duration) finalMsg += ` for ${formatTimeRemaining(duration)}`;
     showStatus(finalMsg, action === "enable" ? "success" : "warning");
  } else {
     showStatus(`Action completed on ${successCount}/${state.piholes.length} Pi-holes`, "info");
  }
}

function setBlockingStatus(blocking, timer = null) {
  // We don't use the URL param reload anymore if we want to stay single-page-ish,
  // but the existing app relies on reloading with params to trigger actions in `initialize`.
  // To keep it transparent and simple without rewriting everything to AJAX-only events:
  // We will reload with params, and let `initialize` call `executeAction`.
  // Wait, `executeAction` is async.

  const actionUrl = generateActionUrl(blocking ? "enable" : "disable", timer);
  window.location.href = actionUrl;
}

// ====================================================
// TIMER FUNCTIONS
// ====================================================
function startCountdown(seconds) {
  stopCountdown();
  state.timerEndTime = Date.now() + seconds * 1000;
  updateTimerDisplay();
  state.countdownInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const now = Date.now();
  const timeRemaining = Math.max(0, Math.floor((state.timerEndTime - now) / 1000));

  if (timeRemaining <= 0) {
    elements.timerDisplay.textContent = "";
    stopCountdown();
    checkBlockingStatus();
  } else {
    elements.timerDisplay.textContent = formatTimeRemaining(timeRemaining);
  }
}

function stopCountdown() {
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
}

// ====================================================
// INITIALIZATION
// ====================================================
async function initialize() {
  document.title = customTitle;
  document.querySelectorAll("h1").forEach(el => el.textContent = customTitle);

  if (!showTips) document.querySelectorAll(".help-text").forEach(el => el.style.display = "none");
  if (!showFooter) { const f = document.querySelector(".footer"); if (f) f.style.display = "none"; }

  // Load Piholes
  const loaded = await loadPiholes();

  if (loaded && state.piholes.length > 0) {
    elements.loginCard.classList.add("hidden");
    elements.mainCard.classList.remove("hidden");

    // UI Customization
    if (!showEnableDisable && elements.enableButton) {
      const row = elements.enableButton.closest(".button-row");
      if (row) row.style.display = "none";
    }
    if (!showPresets) {
      if (elements.presetContainer) elements.presetContainer.style.display = "none";
      if (elements.customDurationDiv) elements.customDurationDiv.style.display = "none";
    }

    setupPresetButtons();
    updateAdminLink();

    // Authenticate
    const authSuccess = await authenticateAll();

    if (authSuccess) {
       if (action) {
         await executeAction();
       } else {
         await checkBlockingStatus();
       }

       if (CONFIG.refresh_interval > 0) {
         state.autoRefreshInterval = setInterval(checkBlockingStatus, CONFIG.refresh_interval * 1000);

         // Pause polling when page is hidden
         document.addEventListener("visibilitychange", () => {
           if (document.visibilityState === 'hidden') {
             if (state.autoRefreshInterval) {
               clearInterval(state.autoRefreshInterval);
               state.autoRefreshInterval = null;
             }
           } else {
             checkBlockingStatus();
             state.autoRefreshInterval = setInterval(checkBlockingStatus, CONFIG.refresh_interval * 1000);
           }
         });
       }
    } else {
       showStatus("Authentication failed for all Pi-holes", "error");
    }

  } else {
    // Show login if no config found
    logoutSession(); // Helper needs update? No, just clears storage.
    elements.loginCard.classList.remove("hidden");
    elements.mainCard.classList.add("hidden");
    updateAdminLink();
  }
}

// Helper needed for `logoutSession`?
// The concept of logout is less relevant if config is from backend, but if manual entry:
function logoutSession() {
  clearSessionData();
}

function updateAdminLink() {
  if (elements.adminLink) {
    // If multiple, just link to the first one or hide?
    if (state.piholes.length > 0) {
       elements.adminLink.href = `${state.piholes[0].url}/admin`;
    } else {
       elements.adminLink.href = "#";
    }
  }
}

// ====================================================
// EVENT LISTENERS & PRESETS (Preserved)
// ====================================================
function setupPresetButtons() {
  elements.presetContainer.innerHTML = "";
  const fragment = document.createDocumentFragment();
  CONFIG.preset_durations.forEach((preset) => {
    const button = document.createElement("button");
    button.textContent = preset.label;
    button.className = "preset-button";
    button.dataset.value = preset.value;
    button.addEventListener("click", () => {
      if (preset.value === "custom") {
        elements.customDurationDiv.style.display = "block";
        loadCustomDurationSettings();
      } else {
        setBlockingStatus(false, preset.value);
      }
    });
    button.style.backgroundColor = "#f7a145";
    button.style.color = "white";
    fragment.appendChild(button);
  });
  elements.presetContainer.appendChild(fragment);
}

// Helpers for URL builder needed? Yes, for reload
function buildUrlParams(baseParams = {}) {
  const params = new URLSearchParams();
  // We don't need to put pwd in url if using backend config,
  // but if we want to support the old way, we keep it.
  // Ideally, we keep the URL clean if using backend.

  if (paramPiholeUrl && paramApiPassword) {
     params.set("url", paramPiholeUrl);
     params.set("pwd", paramApiPassword);
  }

  if (customTitle !== "Pi-hole Controller") params.set("title", customTitle);
  if (!showEnableDisable) params.set("showButtons", "false");
  if (!showPresets) params.set("showPresets", "false");
  if (!showTips) params.set("showTips", "false");
  if (!showFooter) params.set("showFooter", "false");
  if (customPresets) params.set("presets", customPresets);

  if (baseParams.action) params.set("action", baseParams.action);
  if (baseParams.duration !== undefined && baseParams.duration !== null) {
    params.set("duration", baseParams.duration);
  }
  return params;
}

function generateActionUrl(action, duration = null) {
  const url = new URL(window.location.href);
  const params = buildUrlParams({
    action: action,
    duration: duration,
  });
  url.search = params.toString();
  return url.toString();
}

// Login Form (Manual Entry Fallback)
elements.loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const enteredUrl = elements.piholeUrlInput.value.trim();
  const enteredPassword = elements.passwordInput.value;

  const redirectUrl = new URL(window.location.href);
  // Add params
  redirectUrl.searchParams.set("url", enteredUrl);
  redirectUrl.searchParams.set("pwd", enteredPassword);
  window.location.href = redirectUrl.toString();
});

elements.enableButton.addEventListener("click", () => setBlockingStatus(true));
elements.disableButton.addEventListener("click", () => setBlockingStatus(false));

// Custom Duration logic
const customDurationValue = document.getElementById("custom-duration-value");
const toggleSeconds = document.getElementById("toggle-seconds");
const toggleMinutes = document.getElementById("toggle-minutes");
let customDurationUnit = "seconds";

function loadCustomDurationSettings() {
  try {
    const saved = localStorage.getItem(CONFIG.custom_duration_key);
    if (saved) {
      const s = JSON.parse(saved);
      if (s.value) customDurationValue.value = s.value;
      if (s.unit === "minutes") toggleMinutes.click();
    }
  } catch(e){}
}
function saveCustomDurationSettings() {
  localStorage.setItem(CONFIG.custom_duration_key, JSON.stringify({
    value: customDurationValue.value, unit: customDurationUnit
  }));
}

toggleSeconds.addEventListener("click", () => {
  toggleSeconds.classList.add("active"); toggleSeconds.style.backgroundColor = "#4CAF50";
  toggleMinutes.classList.remove("active"); toggleMinutes.style.backgroundColor = "#ccc";
  customDurationUnit = "seconds"; saveCustomDurationSettings();
});
toggleMinutes.addEventListener("click", () => {
  toggleMinutes.classList.add("active"); toggleMinutes.style.backgroundColor = "#4CAF50";
  toggleSeconds.classList.remove("active"); toggleSeconds.style.backgroundColor = "#ccc";
  customDurationUnit = "minutes"; saveCustomDurationSettings();
});
customDurationValue.addEventListener("change", saveCustomDurationSettings);

elements.applyCustomButton.addEventListener("click", () => {
  let dur = parseInt(customDurationValue.value);
  if (isNaN(dur) || dur <= 0) { alert("Invalid number"); return; }
  if (customDurationUnit === "minutes") dur *= 60;
  setBlockingStatus(false, dur);
});

// Version
document.getElementById("controller-version").innerHTML = `<a href="${CONFIG.github_url}" target="_blank">Pi-hole Controller ${CONFIG.controller_version}</a>`;

document.addEventListener("DOMContentLoaded", initialize);
