#!/bin/bash

# Get the absolute path of the application directory
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Create the LaunchAgents directory if it doesn't exist
mkdir -p ~/Library/LaunchAgents

# Copy and configure the plist file
cp "${APP_DIR}/osx/com.etaweather.docker-compose.plist" ~/Library/LaunchAgents/
sed -i '' "s|REPLACE_WITH_APP_PATH|${APP_DIR}|g" ~/Library/LaunchAgents/com.etaweather.docker-compose.plist

# Load the launch agent
launchctl load ~/Library/LaunchAgents/com.etaweather.docker-compose.plist

echo "Launch Agent installed successfully. The service will start automatically on login."
echo "You can find logs in ~/Library/Logs/etaweather-docker-compose.{log,err}"
