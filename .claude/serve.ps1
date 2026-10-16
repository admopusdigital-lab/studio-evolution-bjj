# Servidor local de pre-visualizacao do redesign (somente leitura).
# Serve a pasta site/ ao lado desta pasta .claude e, como o publicador do Artifact faz,
# envolve o index.html com doctype e viewport antes de entregar.
$root = Join-Path (Split-Path -Parent $PSScriptRoot) 'site'
$types = @{ '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.jpg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp'; '.mp4' = 'video/mp4' }
$l = New-Object Net.HttpListener
$l.Prefixes.Add('http://localhost:8765/')
$l.Start()
while ($l.IsListening) {
  $c = $l.GetContext()
  $path = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
  if ($path -eq '') { $path = 'index.html' }
  $file = [IO.Path]::GetFullPath((Join-Path $root $path))
  if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
    $b = [IO.File]::ReadAllBytes($file)
    if ($path -eq 'index.html') {
      $head = [Text.Encoding]::UTF8.GetBytes('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>')
      $b = $head + $b
    }
    $c.Response.ContentType = $types[[IO.Path]::GetExtension($file).ToLower()]
    $c.Response.Headers.Add('Cache-Control', 'no-store')
    $c.Response.ContentLength64 = $b.Length
    try { $c.Response.OutputStream.Write($b, 0, $b.Length) } catch {}
  } else {
    $c.Response.StatusCode = 404
  }
  try { $c.Response.Close() } catch {}
}
