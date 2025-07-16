@echo off
echo Starting PostgreSQL with Docker Compose...
echo ==========================================

:: Check if Docker is running
echo Checking Docker status...
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running or not found
    echo Please start Docker Desktop first
    pause
    exit /b 1
)

:: Start PostgreSQL container
echo Starting PostgreSQL container...
docker-compose -f docker-compose.simple.yml up -d

:: Wait for PostgreSQL to be ready
echo Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak >nul

:: Check if PostgreSQL is running
docker exec mcp-attendance-postgres pg_isready -U postgres
if errorlevel 1 (
    echo Warning: PostgreSQL might not be fully ready yet
    echo Please wait a moment and try again
) else (
    echo PostgreSQL is ready!
)

:: Display connection information
echo.
echo PostgreSQL Connection Information:
echo ==================================
echo Host: localhost
echo Port: 5432
echo Database: attendance
echo User: postgres
echo Password: password
echo.
echo Connection String: postgresql://postgres:password@localhost:5432/attendance
echo.

:: Initialize database schema
echo Initializing database schema...
npm run tsx scripts/init-postgresql.ts

if errorlevel 1 (
    echo Warning: Database initialization failed
    echo You may need to run it manually later
) else (
    echo Database initialized successfully!
)

echo.
echo PostgreSQL is ready to use!
pause