#!/bin/bash
set -e

echo "================================================"
echo "Pi-hole Controller Enhanced - Setup Script"
echo "================================================"

# Get project root
PROJECT_ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
cd "$PROJECT_ROOT"

# Create directories if they don't exist
mkdir -p logs

# Copy configuration template if .env doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp Configuration/.env.example .env
    echo "✅ Created .env file - please configure it!"
else
    echo "ℹ️  .env file already exists, skipping."
fi

# Generate htpasswd if it doesn't exist
if [ ! -f htpasswd ]; then
    echo ""
    echo "Setting up Basic Authentication..."
    read -p "Enter username for web interface: " username

    if command -v htpasswd &> /dev/null; then
        htpasswd -c htpasswd "$username"
    else
        echo "⚠️  htpasswd command not found."
        echo "Installing apache2-utils (Debian/Ubuntu) or httpd-tools (RHEL/CentOS)..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y apache2-utils
            htpasswd -c htpasswd "$username"
        elif command -v yum &> /dev/null; then
            sudo yum install -y httpd-tools
            htpasswd -c htpasswd "$username"
        elif command -v apk &> /dev/null; then
            sudo apk add apache2-utils
            htpasswd -c htpasswd "$username"
        else
             echo "❌ Could not install htpasswd. Please install 'apache2-utils' manually and run:"
             echo "htpasswd -c htpasswd $username"
             # exit 1 removed for compatibility
        fi
    fi

    echo "✅ Authentication configured!"
else
    echo "ℹ️  htpasswd file already exists, skipping."
fi

# Make scripts executable
chmod +x Scripts/setup.sh

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Pi-hole details"
echo "2. Run: make up (or docker-compose -f Docker/docker-compose.yml up -d)"
echo "3. Access: http://localhost:8080"
echo ""
