param([string]$Source)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot=Split-Path -Parent $PSScriptRoot
if(-not $Source){$Source=Join-Path $projectRoot 'assets-source/images/zodiac-sheet.png'}
$destination=Join-Path $projectRoot 'public/images/zodiac'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$regions=@(
  @('01-rat',400,410,270,305),@('02-ox',70,1080,260,305),
  @('03-tiger',50,405,280,305),@('04-rabbit',95,730,200,300),
  @('05-dragon',70,45,275,330),@('06-snake',400,40,250,335),
  @('07-horse',690,1070,310,315),@('08-goat',690,775,315,265),
  @('09-monkey',690,400,320,310),@('10-rooster',680,40,335,335),
  @('11-dog',390,745,270,290),@('12-pig',365,1095,300,260)
)
$sheet=[System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $Source).Path)
try {
  if($sheet.Width -ne 1080 -or $sheet.Height -ne 1411){throw 'Expected the original 1080 x 1411 zodiac sheet.'}
  foreach($entry in $regions){
    $crop=$sheet.Clone([System.Drawing.Rectangle]::new($entry[1],$entry[2],$entry[3],$entry[4]),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $tile=[System.Drawing.Bitmap]::new(360,360)
    $graphics=[System.Drawing.Graphics]::FromImage($tile)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.DrawImageUnscaled($crop,[int]((360-$crop.Width)/2),[int]((360-$crop.Height)/2))
      $tile.Save((Join-Path $destination ($entry[0]+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally {$graphics.Dispose();$tile.Dispose();$crop.Dispose()}
  }
} finally {$sheet.Dispose()}
Write-Output 'ZODIAC_SPLIT: 12 original-pixel crops, 360 x 360 PNG, white padding, no resampling.'
