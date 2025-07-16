@echo off
echo PostgreSQL Database Setup Script
echo =====================================

:: PostgreSQL installation path
set PG_PATH=C:\Program Files\PostgreSQL\17\bin
set PG_DATA=C:\Program Files\PostgreSQL\17\data

:: Check if PostgreSQL is installed
if not exist "%PG_PATH%" (
    echo Error: PostgreSQL not found at %PG_PATH%
    pause
    exit /b 1
)

:: Initialize database cluster if it doesn't exist
if not exist "%PG_DATA%" (
    echo Initializing PostgreSQL database cluster...
    "%PG_PATH%\initdb.exe" -D "%PG_DATA%" -U postgres --pwprompt --encoding=UTF8 --locale=C
    if errorlevel 1 (
        echo Error: Failed to initialize database cluster
        pause
        exit /b 1
    )
)

:: Start PostgreSQL service
echo Starting PostgreSQL service...
net start postgresql-x64-17
if errorlevel 1 (
    echo Error: Failed to start PostgreSQL service
    pause
    exit /b 1
)

:: Create attendance database
echo Creating attendance database...
"%PG_PATH%\psql.exe" -U postgres -c "CREATE DATABASE attendance;"
if errorlevel 1 (
    echo Warning: Database might already exist
)

:: Create test database
echo Creating test database...
"%PG_PATH%\psql.exe" -U postgres -c "CREATE DATABASE attendance_test;"
if errorlevel 1 (
    echo Warning: Test database might already exist
)

echo PostgreSQL setup completed successfully!
pause