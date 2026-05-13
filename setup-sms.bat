@echo off
REM Shuletech SMS System Setup Script (Windows)
REM This script configures the SMS system with Africa's Talking credentials

setlocal enabledelayedexpansion

echo.
echo 🚀 Shuletech SMS System Setup
echo ==============================
echo.

REM Step 1: Check if .env.local exists
echo Step 1: Checking environment configuration...
if exist ".env.local" (
    echo ⚠️  .env.local already exists
) else (
    echo ✓ Creating .env.local
    type nul > .env.local
)

echo.
echo Step 2: Setting up Africa's Talking credentials...
echo ===================================================
echo.
echo Please enter your Africa's Talking API credentials:
echo.

REM Get API Key
set /p API_KEY="Africa's Talking API Key: "
if "!API_KEY!"=="" (
    echo ❌ API Key cannot be empty
    exit /b 1
)

REM Get Username
set /p USERNAME="Africa's Talking Username (default: shuletech): "
if "!USERNAME!"=="" (
    set USERNAME=shuletech
)

REM Get Sender ID
set /p SENDER_ID="Sender ID for SMS (default: SHULETECH): "
if "!SENDER_ID!"=="" (
    set SENDER_ID=SHULETECH
)

echo.
echo Step 3: Updating .env.local...
echo ===============================

REM Create new .env.local with variables
(
    echo AFRICAS_TALKING_API_KEY=!API_KEY!
    echo AFRICAS_TALKING_USERNAME=!USERNAME!
    echo AFRICAS_TALKING_SENDER_ID=!SENDER_ID!
) > .env.local

echo ✓ Environment variables updated
echo.

REM Step 4: Install dependencies
echo Step 4: Installing dependencies...
echo ====================================

if exist "package.json" (
    where npm >nul 2>nul
    if !errorlevel! equ 0 (
        echo Installing npm packages...
        call npm install
        echo ✓ Dependencies installed
    ) else (
        where yarn >nul 2>nul
        if !errorlevel! equ 0 (
            echo Installing yarn packages...
            call yarn install
            echo ✓ Dependencies installed
        ) else (
            where pnpm >nul 2>nul
            if !errorlevel! equ 0 (
                echo Installing pnpm packages...
                call pnpm install
                echo ✓ Dependencies installed
            ) else (
                echo ❌ No package manager found (npm, yarn, or pnpm required)
                exit /b 1
            )
        )
    )
)

echo.
echo Step 5: Verifying configuration...
echo ====================================

REM Check if .env.local contains our variables
findstr /c:"AFRICAS_TALKING_API_KEY" .env.local >nul 2>nul
if !errorlevel! equ 0 (
    echo ✓ API Key configured
) else (
    echo ❌ API Key configuration failed
    exit /b 1
)

findstr /c:"AFRICAS_TALKING_USERNAME" .env.local >nul 2>nul
if !errorlevel! equ 0 (
    echo ✓ Username configured
) else (
    echo ❌ Username configuration failed
    exit /b 1
)

findstr /c:"AFRICAS_TALKING_SENDER_ID" .env.local >nul 2>nul
if !errorlevel! equ 0 (
    echo ✓ Sender ID configured
) else (
    echo ❌ Sender ID configuration failed
    exit /b 1
)

echo.
echo Step 6: Next Steps
echo ====================================
echo.
echo ✅ SMS System Setup Complete!
echo.
echo 📝 Configuration Summary:
echo    - Username: !USERNAME!
echo    - Sender ID: !SENDER_ID!
echo.
echo 🚀 Next steps:
echo.
echo 1. If you're deploying to Vercel, add these environment variables:
echo    - AFRICAS_TALKING_API_KEY=!API_KEY!
echo    - AFRICAS_TALKING_USERNAME=!USERNAME!
echo    - AFRICAS_TALKING_SENDER_ID=!SENDER_ID!
echo.
echo 2. Run your development server:
echo    npm run dev
echo.
echo 3. Access the SMS Management:
echo    - Super Admin: http://localhost:3000/super-admin/sms-management
echo    - Password: shuletech
echo.
echo 4. Test the integration:
echo    - Check Africa's Talking balance displays
echo    - Buy SMS from Super Admin
echo    - Enable SMS for schools
echo.
echo 📚 For more help, see: docs/SMS_PRODUCTION_SETUP.md
echo.
echo ✅ Happy testing! 🎉
echo.

pause
