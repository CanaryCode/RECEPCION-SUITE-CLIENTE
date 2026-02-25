$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$RootDir = $PSScriptRoot
# Subir un nivel desde scripts/admin
$BaseDir = (Get-Item "$RootDir\..\..").FullName

# Icono
$IconPath = "$BaseDir\resources\images\icono.ico"

# Acceso Directo Encender
$ShortcutOn = $WshShell.CreateShortcut("$DesktopPath\Encender Recepcion.lnk")
$ShortcutOn.TargetPath = "$BaseDir\ENCENDER_SERVIDOR.bat"
$ShortcutOn.WorkingDirectory = "$BaseDir"
$ShortcutOn.IconLocation = $IconPath
$ShortcutOn.Save()

# Acceso Directo Apagar
$ShortcutOff = $WshShell.CreateShortcut("$DesktopPath\Apagar Recepcion.lnk")
$ShortcutOff.TargetPath = "$BaseDir\APAGAR_SERVIDOR.bat"
$ShortcutOff.WorkingDirectory = "$BaseDir"
$ShortcutOff.IconLocation = $IconPath
$ShortcutOff.Save()

Write-Host "Iconos creados en el Escritorio con exito." -ForegroundColor Green
