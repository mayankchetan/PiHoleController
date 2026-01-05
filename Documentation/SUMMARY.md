# Project Summary

This project enhances the original PiHoleController with production-grade features.

## Key Changes

1.  **Multi-Pihole Architecture**:
    - Moved from single-target URL parameters to backend-managed configuration.
    - "Transparent" UI controls all instances simultaneously.

2.  **Backend Service**:
    - Added Node.js/Express backend.
    - Proxies configuration to frontend (keeping API keys secure in transit if using HTTPS).
    - Centralized logging.

3.  **Security**:
    - Replaced URL-parameter passwords with HTTP Basic Authentication via Nginx.
    - API keys stored in server-side environment variables.

4.  **Observability**:
    - **Logs**: Dedicated `logs.html` viewer for audit trails.
    - **Notifications**: Integration with ntfy.sh.

## File Structure Comparison

| File | Original Role | Enhanced Role |
|------|---------------|---------------|
| `controller.html` | Main UI | Main UI (Unchanged visually) |
| `controller.js` | Logic | Logic + Multi-target handling + Logging hooks |
| `server.js` | (None) | Backend API, Logging, Config provider |
| `logs.html` | (None) | Log Viewer UI |
| `docker-compose.yml` | (None) | Orchestration |
