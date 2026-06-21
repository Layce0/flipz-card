# Cleanup script for VirtualBox
$ErrorActionPreference = "Continue"

Write-Host "Cleaning up VirtualBox..."

# Stop and delete services
$services = @("VBoxNetAdp", "VBoxSup", "VBoxUSBMon", "VBoxNetLwf", "VBoxSDS")
foreach ($svc in $services) {
    Write-Host "Processing service: $svc"
    sc.exe stop $svc 2>&1 | Out-Null
    sc.exe delete $svc 2>&1 | Out-Null
}

# Delete folders
$folders = @(
    "C:\Program Files\Oracle\VirtualBox",
    "$env:USERPROFILE\.VirtualBox",
    "$env:APPDATA\VirtualBox",
    "$env:LOCALAPPDATA\VirtualBox"
)
foreach ($folder in $folders) {
    if (Test-Path $folder) {
        Write-Host "Deleting folder: $folder"
        Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Delete registry keys
$regKeys = @(
    "HKLM:\SOFTWARE\Oracle\VirtualBox",
    "HKCU:\Software\Oracle\VirtualBox",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{32B822F6-0014-44F1-B755-8146EBA5A8E3}"
)
foreach ($key in $regKeys) {
    if (Test-Path $key) {
        Write-Host "Deleting registry key: $key"
        Remove-Item -Path $key -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Delete driver files if possible
$driverFiles = @(
    "C:\Windows\System32\drivers\VBoxNetAdp6.sys",
    "C:\Windows\System32\drivers\VBoxNetLwf.sys",
    "C:\Windows\System32\drivers\VBoxSup.sys",
    "C:\Windows\System32\drivers\VBoxUSBMon.sys"
)
foreach ($file in $driverFiles) {
    if (Test-Path $file) {
        Write-Host "Deleting driver file: $file"
        Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Cleanup finished."
