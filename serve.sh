#!/bin/bash
# Serve the phone app on your Wi-Fi for testing. Open the printed address on your phone (same Wi-Fi).
cd "$(dirname "$0")/web"
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
echo "Open on your phone:  http://$IP:8080"
python3 -m http.server 8080
