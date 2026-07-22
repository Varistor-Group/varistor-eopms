<#
.SYNOPSIS
  Resolves git merge conflicts in specified files.
  Keeps HEAD (current) or INCOMING (theirs) based on the passed strategy.
#>

param(
  [string]$FilePath,
  [ValidateSet('current','incoming')]
  [string]$Strategy
)

$lines = Get-Content -LiteralPath $FilePath -Encoding UTF8
$result = [System.Collections.Generic.List[string]]::new()
$inConflict = $false
$inIncoming = $false  # true after =======, false before

foreach ($line in $lines) {
  if ($line -match '^<<<<<<< ') {
    $inConflict = $true
    $inIncoming = $false
    continue
  }
  if ($inConflict -and $line -match '^=======') {
    $inIncoming = $true
    continue
  }
  if ($inConflict -and $line -match '^>>>>>>> ') {
    $inConflict = $false
    $inIncoming = $false
    continue
  }

  if ($inConflict) {
    # In HEAD section ($inIncoming = false) or INCOMING section ($inIncoming = true)
    if ($Strategy -eq 'current' -and -not $inIncoming) {
      $result.Add($line)
    } elseif ($Strategy -eq 'incoming' -and $inIncoming) {
      $result.Add($line)
    }
  } else {
    $result.Add($line)
  }
}

$content = $result -join "`r`n"
# Preserve final newline
$content = $content + "`r`n"
[System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Resolved $FilePath using strategy: $Strategy"
