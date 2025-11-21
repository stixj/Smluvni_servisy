@echo off
REM Ensure we are in the directory of this script (project root)
cd /d "%~dp0"
chcp 65001 >nul
echo ========================================
echo Starting local web server...
echo (Generating latest data_output.json from Smluvni servisy Excel...)
echo ========================================
echo.

REM Check if Python is available
where python >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=python
    goto :check_port
)

where py >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=py
    goto :check_port
)

where python3 >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=python3
    goto :check_port
)

echo ERROR: Python is not installed or not in PATH!
echo Please install Python from https://www.python.org/
echo.
pause
exit /b 1

:check_port
REM Use port 8001
set PORT=8001
echo Checking port %PORT%...
netstat -ano | findstr ":%PORT% " >nul
if %errorlevel% == 0 (
    echo.
    echo ERROR: Port %PORT% is already in use!
    echo Please close the application using this port or kill the process.
    echo.
    echo To find and kill the process, run:
    echo netstat -ano ^| findstr ":%PORT% "
    echo Then use: taskkill /PID [PID_NUMBER] /F
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Server starting on port %PORT%
echo ========================================
echo.
echo Running Excel to JSON conversion...
%PYTHON_CMD% convert_excel.py
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Excel to JSON conversion failed. Continuing with last data_output.json if available.
    echo.
)

echo.
echo Open your browser and go to:
echo http://localhost:%PORT%/
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start server in background and open browser
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%/"

%PYTHON_CMD% -m http.server %PORT%

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not start server!
    echo Please check if Python is installed correctly.
    echo Tried command: %PYTHON_CMD%
    echo.
    pause
)

