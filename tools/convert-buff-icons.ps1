$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore,WindowsBase
$projectPath = Split-Path -Parent $PSScriptRoot
$runtimeFolder = Join-Path $projectPath 'public/images/buffs'
$sourceFolder = Join-Path $projectPath 'assets-source/images/buffs'
New-Item -ItemType Directory -Path $sourceFolder -Force | Out-Null
foreach ($svgFile in Get-ChildItem -LiteralPath $runtimeFolder -Filter '*.svg') {
    [xml]$svg = Get-Content -LiteralPath $svgFile.FullName -Raw
    $visual = New-Object Windows.Media.DrawingVisual
    $context = $visual.RenderOpen()
    $context.PushTransform((New-Object Windows.Media.ScaleTransform (128/28),(128/28)))
    $context.PushTransform((New-Object Windows.Media.TranslateTransform 2,2))
    foreach ($group in $svg.svg.g) {
        $brush = (New-Object Windows.Media.BrushConverter).ConvertFromString([string]$group.stroke)
        $pen = New-Object Windows.Media.Pen $brush,([double]$group.'stroke-width')
        $pen.StartLineCap = $pen.EndLineCap = [Windows.Media.PenLineCap]::Round
        $pen.LineJoin = [Windows.Media.PenLineJoin]::Round
        foreach ($shape in $group.ChildNodes) {
            if ($shape.Name -eq 'path') {
                $context.DrawGeometry($null,$pen,[Windows.Media.Geometry]::Parse([string]$shape.d))
            } elseif ($shape.Name -eq 'circle') {
                $context.DrawEllipse($null,$pen,(New-Object Windows.Point ([double]$shape.cx),([double]$shape.cy)),[double]$shape.r,[double]$shape.r)
            }
        }
    }
    $context.Close()
    $bitmap = New-Object Windows.Media.Imaging.RenderTargetBitmap 128,128,96,96,([Windows.Media.PixelFormats]::Pbgra32)
    $bitmap.Render($visual)
    $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $outputPath = Join-Path $runtimeFolder ($svgFile.BaseName + '.png')
    $stream = [IO.File]::Create($outputPath)
    try { $encoder.Save($stream) } finally { $stream.Dispose() }
    Move-Item -LiteralPath $svgFile.FullName -Destination (Join-Path $sourceFolder $svgFile.Name)
    Write-Output ($svgFile.BaseName + '.png: 128 x 128, transparent')
}
