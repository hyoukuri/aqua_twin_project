@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm install
  if errorlevel 1 (echo npm installation failed. & pause & exit /b 1)
)
call npm run dev
pause
