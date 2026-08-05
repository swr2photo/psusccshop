$files = Get-ChildItem -Path "d:\shop\psusccshop\src" -Recurse -Include *.tsx,*.ts
foreach ($file in $files) {
    $content = Get-Content $file.FullName
    $newContent = $content -replace '\b(\w+|\)|\])\.toLocaleString\(', '$1?.toLocaleString('
    if (Compare-Object $content $newContent) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding utf8
    }
}
