# Простой HTTP-сервер с поддержкой MIME-типов
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8080/')
$listener.Start()

Write-Host "HTTP-сервер запущен на http://localhost:8080/"
Write-Host "Рабочая директория: $(Get-Location)"
Write-Host "Нажмите Ctrl+C для остановки"

# Таблица MIME-типов
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/markdown; charset=utf-8'
}

function Get-MimeType($filePath) {
    $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
    if ($mimeTypes.ContainsKey($extension)) {
        return $mimeTypes[$extension]
    }
    return 'application/octet-stream'
}

try {
    while ($true) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ($localPath -eq '') {
            $localPath = 'index.html'
        }
        
        $filePath = Join-Path (Get-Location) $localPath
        
        Write-Host "$($request.HttpMethod) $localPath"
        
        if (Test-Path $filePath -PathType Leaf) {
            $mimeType = Get-MimeType $filePath
            $response.ContentType = $mimeType
            
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
            $response.StatusCode = 200
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        
        $response.Close()
    }
} catch {
    Write-Host "Ошибка: $_"
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "Сервер остановлен"
}