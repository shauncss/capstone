@echo off

:START
cls
echo ========================================
echo        CLINIC KIOSK DEV RUNNER
echo ========================================
echo.

REM --- CLEANUP ---
REM Kill previous node processes 
taskkill /F /IM node.exe >nul 2>&1

cd /d "%~dp0"
set BACKEND_DIR=%~dp0Backend
set FRONTEND_DIR=%~dp0Frontend
set BACKEND_PORT=5000
set FRONTEND_PORT=5173

REM Run Backend
echo [1/3] Starting Backend...
start /b cmd /c "cd /d "%BACKEND_DIR%" && set PORT=%BACKEND_PORT% && npm run dev <nul >nul 2>&1"

REM Run Frontend
echo [2/3] Starting Frontend (Background)...
start /b cmd /c "cd /d "%FRONTEND_DIR%" && set PORT=%FRONTEND_PORT% && npm run dev -- --host <nul >nul 2>&1"

REM Wait a moment then open browser
ping -n 3 127.0.0.1 >nul
echo [3/3] Opening Browser...
start "" http://localhost:%FRONTEND_PORT%/?dev=1

echo.
echo ========================================================
echo   System Running...
echo.
echo   To RESTART: Press [R]
echo   To QUIT:    Press [Q]
echo ========================================================

choice /C RQ /N /M "Select Option:"

if errorlevel 2 goto QUIT
if errorlevel 1 goto START

:QUIT
echo.
echo Closing...
taskkill /F /IM node.exe >nul 2>&1
exit