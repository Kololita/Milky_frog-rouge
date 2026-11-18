$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
& node (Join-Path $PSScriptRoot 'audit_docs_images.mjs')
if($LASTEXITCODE -ne 0){throw 'Image reference audit failed.'}
$report=Get-Content -LiteralPath (Join-Path $projectRoot 'output/docs-image-cleanup.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$docsPath=[System.IO.Path]::GetFullPath((Join-Path $projectRoot 'docs'))
# Validate every target before deleting any files. No recursive filesystem changes.
foreach($file in $report.remove){
  $target=[System.IO.Path]::GetFullPath($file.path)
  if([System.IO.Path]::GetDirectoryName($target) -ne $docsPath -or [System.IO.Path]::GetExtension($target) -notmatch '^\.(png|jpe?g|webp|gif)$'){throw "Unexpected cleanup target: $target"}
}
foreach($file in $report.remove){Remove-Item -LiteralPath $file.path}
Write-Output "DOCS_IMAGES_CLEANED: $($report.remove.Count) removed, $($report.keep.Count) preserved, $($report.removedBytes) bytes freed."
