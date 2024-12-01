#!/bin/bash

# Unload the launch agent
launchctl unload ~/Library/LaunchAgents/com.etaweather.docker-compose.plist

# Remove the plist file
rm ~/Library/LaunchAgents/com.etaweather.docker-compose.plist

echo "Launch Agent uninstalled successfully."
