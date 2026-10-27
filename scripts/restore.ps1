<#
.SYNOPSIS
  กู้ฐานข้อมูลจากไฟล์ backup — ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด

.EXAMPLE
  .\scripts\restore.ps1 -DumpFile data\backups\db-20261027-2130.dump
  .\scripts\restore.ps1 -DumpFile ... -ReceiptsFrom E:\expense-backup\receipts   # กู้รูปด้วย
#>
param(
    [Parameter(Mandatory)] [string]$DumpFile,
    [string]$ReceiptsFrom
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$compose = Join-Path $root 'docker-compose.yml'
$DumpFile = (Resolve-Path $DumpFile).Path

# เหมือนใน backup.ps1: ตัดสินจาก exit code ไม่ใช่ข้อความใน stderr
function Invoke-Docker {
    # ใช้ $args (ไม่ใช่ param) — ไม่งั้น PowerShell จะตีความ -T เป็นพารามิเตอร์ของฟังก์ชันนี้เอง
    $ErrorActionPreference = 'Continue'
    $output = & docker compose -f $compose @args 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($args -join ' ') ล้มเหลว:`n$output" }
    $output | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }
}

Write-Host "จะกู้ข้อมูลจาก: $DumpFile" -ForegroundColor Yellow
Write-Host 'ข้อมูลรายจ่ายปัจจุบันในฐานข้อมูลจะถูกแทนที่ทั้งหมด' -ForegroundColor Yellow
$answer = Read-Host 'พิมพ์ RESTORE เพื่อยืนยัน'
if ($answer -ne 'RESTORE') { Write-Host 'ยกเลิก'; exit 1 }

# หยุด API ก่อน กันแอปเขียนข้อมูลระหว่างกู้
Invoke-Docker stop api | Out-Null
try {
    Invoke-Docker cp $DumpFile db:/tmp/restore.dump | Out-Null
    # --clean --if-exists: ลบตาราง/ข้อมูลเดิมแล้วสร้างใหม่จาก backup
    Invoke-Docker exec -T db pg_restore -U expense -d expense --clean --if-exists --no-owner /tmp/restore.dump | Out-Null
    Invoke-Docker exec -T db rm -f /tmp/restore.dump | Out-Null

    if ($ReceiptsFrom) {
        robocopy $ReceiptsFrom (Join-Path $root 'data\receipts') /MIR /XD tmp /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "กู้รูปไม่สำเร็จ (robocopy exit $LASTEXITCODE)" }
    }
}
finally {
    Invoke-Docker start api | Out-Null
}
Write-Host 'กู้ข้อมูลเสร็จแล้ว ✓' -ForegroundColor Green
$global:LASTEXITCODE = 0
