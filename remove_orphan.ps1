$lines = Get-Content 'src\components\Payroll.tsx' -Encoding UTF8
$newLines = [System.Collections.Generic.List[string]]::new()
$skip = $false
$i = 0
foreach ($line in $lines) {
  $i++
  if ($i -eq 2805) { $skip = $true }
  if ($i -eq 2917) { $skip = $false }
  if (-not $skip) { $newLines.Add($line) }
}
[System.IO.File]::WriteAllLines('src\components\Payroll.tsx', $newLines, [System.Text.Encoding]::UTF8)
Write-Host "Done. Removed lines 2805-2916"
