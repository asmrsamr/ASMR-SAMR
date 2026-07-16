param([Parameter(Mandatory=$true)][string]$Path)

$full = (Resolve-Path -LiteralPath $Path).Path
$xl = $null
$wb = $null
try {
    $xl = New-Object -ComObject Excel.Application
    $xl.Visible = $false
    $xl.DisplayAlerts = $false
    $xl.AskToUpdateLinks = $false
    $wb = $xl.Workbooks.Open($full, 0)
    $xl.CalculateFullRebuild()
    $wb.Save()
    Write-Output "RECALC_OK"
}
catch {
    Write-Output "RECALC_FAIL: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($wb) { $wb.Close($false) | Out-Null }
    if ($xl) { $xl.Quit() }
    if ($wb) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null }
    if ($xl) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
