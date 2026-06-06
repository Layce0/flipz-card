@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo   Configuration automatique des Secrets Apple pour iOS
echo ========================================================
echo.

echo Verification des outils necessaires...
where gh >nul 2>nul
if %errorlevel% neq 0 (
    echo Installation de GitHub CLI (l'outil officiel de GitHub)...
    winget install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements --silent
    :: Ajout temporaire au PATH au cas ou
    set "PATH=%PATH%;%ProgramFiles%\GitHub CLI\"
)

echo.
set /p GHTOKEN="1. Collez votre Token GitHub (le meme qu'avant) : "
:: Connexion à GitHub CLI
echo %GHTOKEN% | gh auth login --with-token >nul 2>&1

if %errorlevel% neq 0 (
    echo Erreur lors de la connexion a GitHub. Verifiez votre Token.
    pause
    exit /b
)

echo.
echo Parfait. Connecte a GitHub.
echo.
set /p APPLEID="2. Entrez votre identifiant Apple (Email) : "
set /p APPLEPASS="3. Entrez votre mot de passe Apple : "

echo.
echo Envoi securise des secrets vers votre projet GitHub...
echo %APPLEID% | gh secret set APPLE_ID --repo Layce0/daily-card-quest
echo %APPLEID% | gh secret set FASTLANE_USER --repo Layce0/daily-card-quest
echo %APPLEPASS% | gh secret set FASTLANE_PASSWORD --repo Layce0/daily-card-quest

echo.
echo [Succes] C'est fait ! Les secrets sont configures sur GitHub en toute securite.
echo Vous pouvez maintenant aller sur :
echo https://github.com/Layce0/daily-card-quest/actions
echo Et cliquer sur "Re-run all jobs" pour relancer la compilation.
echo.
pause
