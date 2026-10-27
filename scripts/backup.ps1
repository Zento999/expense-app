<#
.SYNOPSIS
  สำรองข้อมูลรายจ่าย: ฐานข้อมูล (เก็บย้อนหลังหลายชุด) + รูปสลิป/บิล (สำเนาล่าสุด)

.EXAMPLE
  .\scripts\backup.ps1                          # เก็บที่ data\backups
  .\scripts\backup.ps1 -Dest E:\expense-backup  # เก็บลง external drive (แนะนำ)
#>
param(
    [string]$Dest = (Join-Path $PSScriptRoot '..\data\backups'),
    [int]$Keep = 14  # เก็บไฟล์ฐานข้อมูลล่าสุดกี่ชุด
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$compose = Join-Path $root 'docker-compose.yml'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'

# รันคำสั่งภายนอก (docker) แล้วเช็ค exit code จริง
# PowerShell 5.1 มองข้อความที่ docker เขียนลง stderr (เช่น progress ของ cp) เป็น error
# ทั้งที่คำสั่งสำเร็จ — จึงต้องปิด Stop ชั่วคราว แล้วตัดสินจาก exit code แทน
function Invoke-Docker {
    # ใช้ $args (ไม่ใช่ param) — ไม่งั้น PowerShell จะตีความ -T เป็นพารามิเตอร์ของฟังก์ชันนี้เอง
    $ErrorActionPreference = 'Continue'
    $output = & docker compose -f $compose @args 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($args -join ' ') ล้มเหลว:`n$output" }
    $output | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }
}

New-Item -ItemType Directory -Force $Dest | Out-Null
$Dest = (Resolve-Path $Dest).Path
$dumpFile = Join-Path $Dest "db-$stamp.dump"

# 1) ฐานข้อมูล
# ให้ pg_dump เขียนไฟล์ใน container แล้วค่อย copy ออกมา — ห้ามใช้ ">" ใน PowerShell 5.1
# เพราะมันแปลง output เป็นข้อความ UTF-16 ทำให้ไฟล์ binary พังจน restore ไม่ได้
# -Fc = custom format: บีบอัดในตัว และ restore แบบเลือกตารางได้
Write-Host '1/3 กำลัง dump ฐานข้อมูล...'
Invoke-Docker exec -T db pg_dump -U expense -d expense -Fc -f /tmp/backup.dump | Out-Null

# ตรวจว่าไฟล์อ่านได้จริงก่อนเก็บ (backup ที่ restore ไม่ได้ = ไม่มี backup)
$tables = Invoke-Docker exec -T db pg_restore --list /tmp/backup.dump | Select-String 'TABLE DATA'
if ($tables.Count -lt 2) { throw 'ไฟล์ dump ผิดปกติ (ไม่พบข้อมูลตาราง)' }

Invoke-Docker cp db:/tmp/backup.dump $dumpFile | Out-Null
Invoke-Docker exec -T db rm -f /tmp/backup.dump | Out-Null
$sizeKb = [math]::Round((Get-Item $dumpFile).Length / 1KB, 1)
Write-Host "    -> $dumpFile ($sizeKb KB, $($tables.Count) ตาราง)"

# 2) รูป: mirror ไปที่ปลายทาง (copy เฉพาะไฟล์ใหม่/เปลี่ยน, ไม่เอา tmp)
Write-Host '2/3 กำลังสำรองรูป...'
$receiptsSrc = Join-Path $root 'data\receipts'
$receiptsDst = Join-Path $Dest 'receipts'
robocopy $receiptsSrc $receiptsDst /MIR /XD tmp /NFL /NDL /NJH /NJS /NP | Out-Null
# robocopy: exit code 0–7 = สำเร็จ, 8 ขึ้นไป = มีไฟล์ copy ไม่ได้
if ($LASTEXITCODE -ge 8) { throw "robocopy ล้มเหลว (exit $LASTEXITCODE)" }
$imageCount = (Get-ChildItem $receiptsDst -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "    -> $receiptsDst ($imageCount ไฟล์)"

# 3) ลบ dump เก่าเกินจำนวนที่กำหนด
Write-Host "3/3 เก็บล่าสุด $Keep ชุด..."
$old = @(Get-ChildItem $Dest -Filter 'db-*.dump' | Sort-Object Name -Descending | Select-Object -Skip $Keep)
$old | Remove-Item
if ($old.Count -gt 0) { Write-Host "    ลบชุดเก่า $($old.Count) ไฟล์" }

Write-Host 'เสร็จแล้ว ✓' -ForegroundColor Green
$global:LASTEXITCODE = 0  # robocopy ตั้งค่า 1 ได้แม้สำเร็จ — รีเซ็ตให้ Task Scheduler เห็นว่าผ่าน
