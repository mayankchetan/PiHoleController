# Deployment Checklist

Before going into production, ensure:

- [ ] **Security**: `htpasswd` file is generated and contains strong credentials.
- [ ] **Configuration**: `.env` file is created and `PIHOLE_COUNT` matches your setup.
- [ ] **Connectivity**: All Pi-hole URLs in `.env` are reachable from the Docker host.
- [ ] **Persistence**: Volume paths in `docker-compose.yml` are correct for your system.
- [ ] **Logging**: Log directory exists and is writable (handled by setup script).
- [ ] **Notifications**: `NTFY_TOPIC` is unique/secret if using public ntfy.sh server.
- [ ] **HTTPS**: (Optional but Recommended) Reverse proxy with SSL is configured in front of Nginx.
