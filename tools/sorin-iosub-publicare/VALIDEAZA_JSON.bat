@echo off
chcp 65001 > nul
cd /d "%~dp0"
set /p CATALOG=Cale completa catre artworks.json: 
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 validate_artworks.py "%CATALOG%"
) else (
    python validate_artworks.py "%CATALOG%"
)
echo.
pause
