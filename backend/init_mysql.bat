@echo off
setlocal

set "HOST=localhost"
set "PORT=3306"
set "USER=root"
set "PASS=root"
set "SCRIPT=%~dp0mysql-schema\init.sql"
set "MYSQL_PATH=D:\phpenv\server\mysql\mysql-8.0\bin\mysql.exe"

echo [MySQL Init] Initializing schema for Papersketch (tenant MVP)...
echo.

if exist "%MYSQL_PATH%" (
  echo Found MySQL client at "%MYSQL_PATH%"
) else (
  echo Could not find MySQL client at "%MYSQL_PATH%". Please ensure the path is correct.
  goto :eof
)

echo Using MySQL client at "%MYSQL_PATH%".
echo Executing: %USER%@%HOST%:%PORT%
"%MYSQL_PATH%" -u%USER% -p%PASS% < "%SCRIPT%"
echo Initialization script executed.
echo.
pause
