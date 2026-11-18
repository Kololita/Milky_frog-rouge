param([string]$Name = '*')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore,WindowsBase
$projectPath = Split-Path -Parent $PSScriptRoot
$sourceFolder = Join-Path $projectPath 'assets-source/images/buffs/refined'
$outputFolder = Join-Path $projectPath 'public/images/buffs'
$brushConverter = New-Object Windows.Media.BrushConverter
foreach ($svgFile in Get-ChildItem -LiteralPath $sourceFolder -Filter "$Name.svg") {
    [xml]$svg = Get-Content -LiteralPath $svgFile.FullName -Raw
    $visual = New-Object Windows.Media.DrawingVisual
    $context = $visual.RenderOpen()
    $context.PushTransform((New-Object Windows.Media.ScaleTransform 2,2))
    foreach ($group in $svg.svg.g) {
        $fill = $null
        if ($group.fill -and $group.fill -ne 'none') { $fill = $brushConverter.ConvertFromString([string]$group.fill) }
        $pen = $null
        if ($group.stroke -and $group.stroke -ne 'none') {
            $pen = New-Object Windows.Media.Pen ($brushConverter.ConvertFromString([string]$group.stroke)),([double]$group.'stroke-width')
            $pen.StartLineCap = $pen.EndLineCap = [Windows.Media.PenLineCap]::Round
            $pen.LineJoin = [Windows.Media.PenLineJoin]::Round
        }
        foreach ($shape in $group.ChildNodes) {
            if ($shape.Name -eq 'path') { $context.DrawGeometry($fill,$pen,[Windows.Media.Geometry]::Parse([string]$shape.d)) }
            elseif ($shape.Name -eq 'circle') { $context.DrawEllipse($fill,$pen,(New-Object Windows.Point ([double]$shape.cx),([double]$shape.cy)),[double]$shape.r,[double]$shape.r) }
        }
    }
    $context.Close()
    $bitmap = New-Object Windows.Media.Imaging.RenderTargetBitmap 128,128,96,96,([Windows.Media.PixelFormats]::Pbgra32)
    $bitmap.Render($visual)
    $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $stream = [IO.File]::Create((Join-Path $outputFolder ($svgFile.BaseName + '.png')))
    try { $encoder.Save($stream) } finally { $stream.Dispose() }
    Write-Output ($svgFile.BaseName + '.png')
}
