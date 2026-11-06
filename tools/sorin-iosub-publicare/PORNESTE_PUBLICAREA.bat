@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================================
echo   SORIN IOSUB - Publicare incrementala in Cloudflare R2
echo ================================================================
echo Registru: state\publicate.json
echo Jurnal:   logs\publicari.csv
echo.
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 publica_lucrari.py
) else (
    python publica_lucrari.py
)
set "EXIT_CODE=%errorlevel%"
echo.
echo Cod iesire: %EXIT_CODE%
pause
exit /b %EXIT_CODE%
