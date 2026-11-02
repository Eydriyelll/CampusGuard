@echo off
cd /d "%~dp0web"
echo Open on your phone (same Wi-Fi): http://YOUR-PC-IP:8080   (find the IP with: ipconfig)
python -m http.server 8080
