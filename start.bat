@echo off
echo Starting PaperSketch JS...
echo.

echo Starting Backend...
start "Backend" cmd /k "cd /d %~dp0backend && npm run dev"

echo Starting Frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are starting!
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5173

pause
