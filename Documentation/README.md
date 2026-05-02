# Pi-hole Controller Enhanced

A production-ready, containerized web application for controlling multiple Pi-hole instances with advanced features including IP logging, push notifications, and secure authentication.

## Features

- ✅ **Multi-Pihole Support**: Control multiple Pi-hole instances simultaneously.
- ✅ **Transparent UI**: Single-click Enable/Disable applies to all configured Pi-holes.
- ✅ **Secure**: Protected by HTTP Basic Authentication.
- ✅ **Logging**: Tracks all actions with Client IP, Timestamp, and User Agent.
- ✅ **Notifications**: Integration with ntfy.sh for push notifications.
- ✅ **Dockerized**: Easy deployment with Docker and Docker Compose.
- ✅ **Mobile Friendly**: Responsive design for all devices.

## Quick Start

1. **Setup**: Run the setup script to initialize configuration and authentication.
   ```bash
   make setup
   ```
2. **Configure**: Edit the `.env` file with your Pi-hole details.
   ```env
   PIHOLE_COUNT=2
   PIHOLE_1_URL=https://pi.hole
   PIHOLE_1_PASSWORD=your-app-password
   ...
   ```
3. **Start**: Launch the application.
   ```bash
   make up
   ```
   Access the controller at http://localhost:8080.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Web interface port | 8080 |
| `PIHOLE_COUNT` | Number of Pi-holes to control | 1 |
| `PIHOLE_x_NAME` | Name of Pi-hole #x | - |
| `PIHOLE_x_URL` | URL of Pi-hole #x | - |
| `PIHOLE_x_PASSWORD` | App password for Pi-hole #x | - |
| `NTFY_ENABLED` | Enable ntfy notifications | true |
| `NTFY_SERVER` | ntfy server URL | https://ntfy.sh |
| `NTFY_TOPIC` | ntfy topic name | pihole-controller |
| `LOG_FILE` | Path to access log | /var/log/pihole-controller/access.log |

## Multi-Pihole Setup

To control multiple Pi-holes, set `PIHOLE_COUNT` in your `.env` file and define configuration for each instance (incrementing the number):

```env
PIHOLE_COUNT=2

PIHOLE_1_NAME=Primary
PIHOLE_1_URL=http://192.168.1.10
PIHOLE_1_PASSWORD=xxx

PIHOLE_2_NAME=Secondary
PIHOLE_2_URL=http://192.168.1.11
PIHOLE_2_PASSWORD=xxx
```

## Security

The application is protected by Basic Authentication (configured via `htpasswd` during setup). Ensure you use a strong password.

For public access, it is **highly recommended** to run this behind a reverse proxy with HTTPS (SSL/TLS) enabled to encrypt your credentials.

## Troubleshooting

- **Connection Refused**: Ensure your Pi-hole URLs are correct and reachable from the Docker container.
- **Authentication Failed**: Check your Pi-hole App Passwords in `.env`.
- **Logs not appearing**: Check permissions on the `logs` directory.

## Architecture

```
User (Browser) <-> Nginx (Auth & Proxy) <-> Node.js Backend <-> Pi-hole APIs
```

## Commands

- `make setup`: Initialize project
- `make up`: Start containers
- `make logs`: View logs
- `make down`: Stop containers
