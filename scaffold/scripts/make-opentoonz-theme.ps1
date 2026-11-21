# 从 OpenToonz 官方 Light / Dark QSS 派生 Kinexa 主题
# 只替换结构与强调色，保留状态色（红/绿/橙）不动。
$ErrorActionPreference = 'Stop'

$refRoot = Join-Path $PSScriptRoot '..\..\reference\animation\opentoonz\stuff\config\qss'
$outRoot = Join-Path $PSScriptRoot '..\opentoonz-theme'
$refRoot = [System.IO.Path]::GetFullPath($refRoot)
$outRoot = [System.IO.Path]::GetFullPath($outRoot)

$lightMap = @{
  'd1d1d1' = 'fbf8f2'; 'bfbfbf' = 'f3eee4'; 'e5e5e5' = 'fff7e6'
  'adadad' = 'e9e2d4'; '7e7e7e' = 'd8d0c0'; '7098f0' = 'ffe8b8'
  '0e3486' = '7a5a00'; 'b5caf7' = 'fff0c9'; 'aabadd' = 'e8dcc0'
  '2b66e9' = 'e6c15a'; '341f88' = '6b5200'; '000d9e' = '6b5200'
  '000000' = '262420'; '000' = '262420'; 'f7f7f7' = 'ffffff'
  '1aff00' = 'ffe29a'; '828282' = '8a7a55'; '5e5e5e' = 'b9ae97'
  '181818' = '2b261c'; 'd2d2d2' = 'fdf6e8'; 'b0b0b0' = '9a958b'
  'c6c6c6' = 'c9c2b4'; '6b6b6b' = '56534b'; '545454' = '4b4841'
  '7d7d7d' = '8f8a80'; 'bdbdbd' = 'cfc8ba'; '666666' = '5f5b52'
}

$darkMap = @{
  '020202' = '161616'; '1c1c1c' = '1e1e1e'; '303030' = '262626'
  '4f4f4f' = '343434'; '5b5b5b' = '3a3a3a'; '686868' = '474747'
  'dfdfdf' = 'f2f0eb'; '4f7bc7' = 'ffe29a'; '7698d3' = 'ffe8b8'
  '3c4e6c' = '5a4310'; '424242' = '3a3a3a'
}

function Recolor([string]$text, [hashtable]$map) {
  $pattern = '#([0-9a-fA-F]{3,8})(?![0-9a-fA-F])'
  return [regex]::Replace($text, $pattern, {
    param($m)
    $hex = $m.Groups[1].Value.ToLower()
    if ($map.ContainsKey($hex)) { return '#' + $map[$hex] }
    return $m.Value
  })
}

function BuildTheme([string]$sourceFile, [string]$folder, [string]$fileName, [hashtable]$map) {
  $text = Get-Content -LiteralPath $sourceFile -Raw
  $text = Recolor $text $map
  # 统一圆角；OpenToonz 原版几乎全是直角。
  $text = $text -replace 'border-radius:\s*0;', 'border-radius: 4;'
  # 中文界面优先使用微软雅黑，避免 Qt 默认字体发虚。
  $text = "/* Kinexa 主题：奶油暖黄 + 中性暗色；由 OpenToonz 官方 QSS 派生 */`r`nQWidget { font-family: `"Microsoft YaHei UI`"; }`r`n" + $text
  $dir = Join-Path $outRoot $folder
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $dst = Join-Path $dir $fileName
  Set-Content -LiteralPath $dst -Value $text -Encoding utf8NoBOM
  return $dst
}

$light = BuildTheme (Join-Path $refRoot 'Light\Light.qss') 'Kinexa-Light' 'Kinexa-Light.qss' $lightMap
$dark = BuildTheme (Join-Path $refRoot 'Dark\Dark.qss') 'Kinexa-Dark' 'Kinexa-Dark.qss' $darkMap

Get-ChildItem -LiteralPath $outRoot -Recurse | Select-Object FullName, Length
