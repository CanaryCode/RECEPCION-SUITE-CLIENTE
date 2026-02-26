Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "Recepción Suite"
$form.Size = New-Object System.Drawing.Size(420,260)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(33, 37, 41)

$label = New-Object System.Windows.Forms.Label
$label.Text = "¿Qué módulo deseas abrir?"
$label.ForeColor = [System.Drawing.Color]::White
$label.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$label.Location = New-Object System.Drawing.Point(0, 30)
$label.Size = New-Object System.Drawing.Size(400, 30)
$label.TextAlign = "MiddleCenter"
$form.Controls.Add($label)

$btnWeb = New-Object System.Windows.Forms.Button
$btnWeb.Text = "💻 Recepción Web"
$btnWeb.Size = New-Object System.Drawing.Size(160, 60)
$btnWeb.Location = New-Object System.Drawing.Point(35, 90)
$btnWeb.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnWeb.BackColor = [System.Drawing.Color]::FromArgb(25, 135, 84) # BS5 Success
$btnWeb.ForeColor = [System.Drawing.Color]::White
$btnWeb.FlatStyle = "Flat"
$btnWeb.FlatAppearance.BorderSize = 0
$btnWeb.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnWeb.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($btnWeb)

$btnAdmin = New-Object System.Windows.Forms.Button
$btnAdmin.Text = "⚙️ Consola Admin"
$btnAdmin.Size = New-Object System.Drawing.Size(160, 60)
$btnAdmin.Location = New-Object System.Drawing.Point(210, 90)
$btnAdmin.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnAdmin.BackColor = [System.Drawing.Color]::FromArgb(13, 110, 253) # BS5 Primary
$btnAdmin.ForeColor = [System.Drawing.Color]::White
$btnAdmin.FlatStyle = "Flat"
$btnAdmin.FlatAppearance.BorderSize = 0
$btnAdmin.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnAdmin.DialogResult = [System.Windows.Forms.DialogResult]::Yes
$form.Controls.Add($btnAdmin)

$paramLabel = New-Object System.Windows.Forms.Label
$paramLabel.Text = "(El servidor local se iniciará automáticamente)"
$paramLabel.ForeColor = [System.Drawing.Color]::Gray
$paramLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Regular)
$paramLabel.Location = New-Object System.Drawing.Point(0, 175)
$paramLabel.Size = New-Object System.Drawing.Size(400, 30)
$paramLabel.TextAlign = "MiddleCenter"
$form.Controls.Add($paramLabel)

$form.Topmost = $true

$result = $form.ShowDialog()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output "WEB"
} elseif ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
    Write-Output "ADMIN"
} else {
    Write-Output "CANCEL"
}
