Write-Host "=== Génération du fichier .p12 ===\n"
$certDir = "$env:USERPROFILE\apple_certs"
$cer = Join-Path $certDir "flipz.cer"
$key = Join-Path $certDir "flipz.key"
$p12 = Join-Path $certDir "flipz.p12"

if (-Not (Test-Path $cer) -or -Not (Test-Path $key)) {
    Write-Error "Le fichier flipz.cer ou flipz.key est manquant dans $certDir"
    exit 1
}

$pwd = Read-Host -AsSecureString "Entrez un mot‑de‑passe qui protègera le fichier .p12"
$plainPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd))

# Utiliser OpenSSL (déjà ajouté au PATH par install_tools.ps1)
openssl pkcs12 -export -inkey $key -in $cer -out $p12 -password pass:$plainPwd

Write-Host "\nFichier $p12 créé avec succès."
