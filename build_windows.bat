@echo off
REM Builds CampusGuard.exe (native Windows app window + C++ engine) and launches it.
REM Run from the "x64 Native Tools Command Prompt for VS" (Visual Studio / Build Tools with "Desktop development with C++").
REM Needs: Git (to download the webview library once) and the Edge WebView2 runtime (already on Windows 10/11).
setlocal
cd /d "%~dp0"
set "WV=core\third_party\webview"
if not exist "%WV%\core\include\webview\webview.h" (
  echo Downloading the webview library...
  git clone --depth 1 --branch 0.10.0 https://github.com/webview/webview "%WV%" || (echo Git failed. Install Git for Windows, or download https://github.com/webview/webview/archive/refs/tags/0.10.0.zip and unzip it to %WV% & exit /b 1)
)
set "WD=%CD:\=/%/web"
cl /nologo /std:c++17 /EHsc /O2 /utf-8 /I core\include /I "%WV%\core\include" "/DWEB_DIR=\"%WD%\"" core\src\gui.cpp /Fe:CampusGuard.exe /link /SUBSYSTEM:WINDOWS /ENTRY:mainCRTStartup user32.lib ole32.lib shell32.lib shlwapi.lib advapi32.lib version.lib
if errorlevel 1 (echo Build failed. & exit /b 1)
echo Built CampusGuard.exe - launching...
start "" CampusGuard.exe
