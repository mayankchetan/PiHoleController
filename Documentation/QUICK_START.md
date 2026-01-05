# Quick Start Guide

## 5-Minute Setup

1.  **Run Setup Script**
    ```bash
    ./Scripts/setup.sh
    ```
    Follow the prompts to create your admin username and password.

2.  **Edit Configuration**
    Open the generated `.env` file with your preferred text editor.
    Update the `PIHOLE_X_URL` and `PIHOLE_X_PASSWORD` fields with your real Pi-hole details.

3.  **Start the Service**
    ```bash
    make up
    ```

4.  **Access**
    Open your browser to: `http://localhost:8080`
    Login with the username/password you created in step 1.

## Sharing with Family

Since authentication is handled by the server, you can share the base URL (e.g., `http://pi-controller.local`) with family members. They will only need the Basic Auth username/password, not the individual Pi-hole API keys.

## Common Use Cases

- **"Dinner Time"**: Click "Disable for 30 min" to temporarily allow ads/tracking/services during dinner.
- **Troubleshooting**: Quickly disable all DNS blocking to check if a site issue is caused by Pi-hole.
- **Remote Management**: If exposed securely via VPN or HTTPS, control your home network from anywhere.
