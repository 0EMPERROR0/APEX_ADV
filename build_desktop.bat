@echo off
REM ===========================================================================
REM A.P.E.X Desktop Application — Windows Setup & Build Script
REM ===========================================================================

echo [A.P.E.X] Preparing Desktop Application Build...

REM 1. Check Python installation
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.10+ from python.org
    pause
    exit /b 1
)

REM 2. Check Node.js installation
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js from nodejs.org
    pause
    exit /b 1
)

REM 3. Setup Virtual Environment if not exists
if not exist "venv\" (
    echo [A.P.E.X] Creating Python virtual environment...
    python -m venv venv
)

echo [A.P.E.X] Activating virtual environment...
call venv\Scripts\activate.bat

REM 4. Install Python dependencies
echo [A.P.E.X] Installing Python requirements...
pip install -r requirements.txt

REM 5. Install Node dependencies and build React UI
echo [A.P.E.X] Building React UI into local static assets...
call npm install
call npm run build

REM 6. Launch Application
echo [A.P.E.X] Launching Native Windows Desktop Application...
python main.py

pause
