@echo off
REM Single-window dev runner: starts backend and frontend, opens browser to localhost.

cd /d "%~dp0"

set BACKEND_DIR=%~dp0Backend
set FRONTEND_DIR=%~dp0Frontend
set BACKEND_PORT=5000
set FRONTEND_PORT=5173

echo Starting backend (PORT=%BACKEND_PORT%)...
start /b cmd /c "cd /d "%BACKEND_DIR%" && set PORT=%BACKEND_PORT% && npm run dev"

REM Small delay so backend boot logs don't mix with frontend start
ping -n 2 127.0.0.1 >nul

echo Starting frontend (PORT=%FRONTEND_PORT%)...
start /b cmd /c "cd /d "%FRONTEND_DIR%" && set PORT=%FRONTEND_PORT% && npm run dev -- --host"

REM Give Vite a moment, then open browser
ping -n 3 127.0.0.1 >nul
start "" http://localhost:%FRONTEND_PORT%/?dev=1

echo Both servers started in this window. Press Ctrl+C to stop.
pause
exit /b 0
