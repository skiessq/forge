@echo off
title ClipForge Studio
color 0B
cd /d "%~dp0"

echo ========================================================
echo                  CLIPFORGE STUDIO
echo       Turn Long Clips into 9:16 Vertical Shorts
echo ========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js from https://nodejs.org/ and restart this script.
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules\" (
    echo [INFO] First time setup: Installing dependencies...
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
    echo.
)

echo [INFO] Starting ClipForge local server...
echo [INFO] Opening http://localhost:3000 in your browser...
echo.

:: Open browser after a short delay in background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Start the Next.js dev server
call npm.cmd run dev

pause
