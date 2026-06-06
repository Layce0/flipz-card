Write-Host "=== Installation des outils portables ===

# GitHub CLI
$ghUrl = 'https://github.com/cli/cli/releases/download/v2.55.0/gh_2.55.0_windows_amd64.zip'
$ghZip = "$env:USERPROFILE\Downloads\gh.zip"
Invoke-WebRequest -Uri $ghUrl -OutFile $ghZip -UseBasicParsing
Expand-Archive -Path $ghZip -DestinationPath "$env:USERPROFILE\gh" -Force
# Ajouter gh au PATH pour le processus courant
$env:Path = "$env:USERPROFILE\gh;$env:Path"

# OpenSSL
$sslUrl = 'https://slproweb.com/download/Win64OpenSSL-3_2_0.zip'
$sslZip = "$env:USERPROFILE\Downloads\OpenSSL.zip"
Invoke-WebRequest -Uri $sslUrl -OutFile $sslZip -UseBasicParsing
Expand-Archive -Path $sslZip -DestinationPath "$env:USERPROFILE\OpenSSL" -Force
# Ajouter OpenSSL/bin au PATH
$env:Path = "$env:USERPROFILE\OpenSSL\bin;$env:Path"

Write-Host "\nInstallation terminée. Vérifiez les versions :"
# Utiliser les exécutables avec le chemin complet
& "$env:USERPROFILE\gh\gh.exe" --version
& "$env:USERPROFILE\OpenSSL\bin\openssl.exe" version
