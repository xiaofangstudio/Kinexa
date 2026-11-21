# 生成 Kinexa 奶油暖黄图标（无第三方依赖，只用 Windows 自带 System.Drawing）
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\src-tauri\icons'
$outDir = [System.IO.Path]::GetFullPath($outDir)
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$brand = [System.Drawing.Color]::FromArgb(255, 226, 154)
$ink = [System.Drawing.Color]::FromArgb(48, 38, 12)

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [single]([math]::Max(1, $size * 0.035))
  $box = [single]($size - $pad * 2)
  $radius = [single]($box * 0.26)
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddArc($pad, $pad, $radius * 2, $radius * 2, 180, 90)
  $gp.AddArc($pad + $box - $radius * 2, $pad, $radius * 2, $radius * 2, 270, 90)
  $gp.AddArc($pad + $box - $radius * 2, $pad + $box - $radius * 2, $radius * 2, $radius * 2, 0, 90)
  $gp.AddArc($pad, $pad + $box - $radius * 2, $radius * 2, $radius * 2, 90, 90)
  $gp.CloseFigure()
  $brush = New-Object System.Drawing.SolidBrush($brand)
  $g.FillPath($brush, $gp)

  $s = $box / 32.0
  $pen = New-Object System.Drawing.Pen($ink, [single]($s * 2.4))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, [single]($pad + 11 * $s), [single]($pad + 8.6 * $s), [single]($pad + 11 * $s), [single]($pad + 23.4 * $s))
  $g.DrawLine($pen, [single]($pad + 11.6 * $s), [single]($pad + 16.4 * $s), [single]($pad + 18.8 * $s), [single]($pad + 9.8 * $s))
  $g.DrawLine($pen, [single]($pad + 11.6 * $s), [single]($pad + 16.4 * $s), [single]($pad + 18.8 * $s), [single]($pad + 23 * $s))
  $dot = New-Object System.Drawing.SolidBrush($ink)
  $dotR = [single]($s * 1.8)
  $g.FillEllipse($dot, [single]($pad + 24.3 * $s - $dotR), [single]($pad + 23.4 * $s - $dotR), $dotR * 2, $dotR * 2)

  $pen.Dispose(); $brush.Dispose(); $dot.Dispose(); $gp.Dispose(); $g.Dispose()
  return $bmp
}

$sizes = @(16, 32, 48, 64, 128, 256)
$pngs = @{}
foreach ($sz in $sizes) {
  $bmp = New-IconBitmap $sz
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs[$sz] = $ms.ToArray()
  $ms.Dispose(); $bmp.Dispose()
}

# ICO：头 + 目录 + 各尺寸 PNG
$fs = [System.IO.File]::Create((Join-Path $outDir 'icon.ico'))
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
foreach ($sz in $sizes) {
  $bytes = $pngs[$sz]
  $dim = if ($sz -ge 256) { 0 } else { $sz }
  $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$bytes.Length); $bw.Write([UInt32]$offset)
  $offset += $bytes.Length
}
foreach ($sz in $sizes) { $bw.Write($pngs[$sz]) }
$bw.Close(); $fs.Close()

# Tauri 需要的其它尺寸
foreach ($pair in @(@(32,'32x32.png'), @(128,'128x128.png'), @(256,'128x128@2x.png'), @(512,'icon.png'))) {
  $bmp = New-IconBitmap $pair[0]
  $bmp.Save((Join-Path $outDir $pair[1]), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Get-ChildItem $outDir | Select-Object Name, Length
