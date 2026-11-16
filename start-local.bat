@echo off
cd /d "%~dp0"
start "AQUA TWIN Backend" "%~dp0backend\start.bat"
start "AQUA TWIN Frontend" "%~dp0frontend\start.bat"
echo Starting both services. Open http://localhost:5173 after the terminals finish loading.
pause
