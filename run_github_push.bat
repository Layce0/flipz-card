@echo off
:: Verifier si on a les droits d'administrateur
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :admin
) else (
    echo Demande des droits administrateur...
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

:admin
:: Se placer dans le dossier actuel
cd /d "%~dp0"

echo ========================================================
echo   Envoi du projet Daily Card Quest sur GitHub (iOS CI)
echo ========================================================
echo.
echo Vous allez avoir besoin d'un Token GitHub (Personal Access Token)
echo que vous pouvez creer sur github.com dans Settings - Developer settings.
echo.

set /p TOKEN="Collez votre Token GitHub : "
set /p REPONAME="Nom du projet sur GitHub (ex: daily-card-quest-ios) : "

echo.
echo Lancement de l'envoi...
powershell -NoProfile -ExecutionPolicy Bypass -File push_to_github.ps1 -GitHubToken "%TOKEN%" -RepoName "%REPONAME%"

echo.
echo Appuyez sur une touche pour fermer.
pause
