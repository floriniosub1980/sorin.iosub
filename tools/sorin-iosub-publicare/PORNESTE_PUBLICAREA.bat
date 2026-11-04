@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ================================================================
echo   SORIN IOSUB - Publicare fotografii si actualizare artworks.json
 echo ================================================================
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 publica_lucrari.py
) else (
    python publica_lucrari.py
)
echo.
echo Cod iesire: %errorlevel%
pause
