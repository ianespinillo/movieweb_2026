#Requires -Version 5.1
<#
  MovieWeb - entorno de desarrollo a prueba de boludos (APB)

  Uso:
    scripts\dev.ps1                -> levanta todo (start)
    scripts\dev.ps1 -Action stop   -> detiene los contenedores (los datos quedan)
    scripts\dev.ps1 -Action reset  -> borra y recrea la base desde cero (pide confirmación)

  En Windows lo normal es ejecutar los .cmd de la raíz (INICIAR / DETENER / RESET_BD).
#>
[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'reset')]
    [string]$Action = 'start'
)

$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'docker-compose.yml'))) {
    Write-Host 'No encuentro docker-compose.yml al lado de scripts/. El repo está incompleto o el archivo se movió.' -ForegroundColor Red
    exit 1
}
Set-Location $root

# ─── Helpers ────────────────────────────────────────────────────────────────

function Say([string]$msg, [string]$color = 'Gray') {
    Write-Host $msg -ForegroundColor $color
}

function Fail([string]$msg, [string]$hint = '') {
    Write-Host ''
    Write-Host 'ERROR: ' -ForegroundColor Red -NoNewline
    Write-Host $msg -ForegroundColor Red
    if ($hint) {
        Write-Host ''
        Write-Host 'Qué hacer:' -ForegroundColor Yellow
        Write-Host $hint -ForegroundColor Yellow
    }
    exit 1
}

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Fail 'No tenés Docker instalado.' @'
1) Baja e instalá Docker Desktop: https://www.docker.com/products/docker-desktop/
2) Reiniciá la PC.
3) Volvé a ejecutar este archivo.
'@
    }
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        Fail 'Docker está instalado pero no está funcionando.' @'
1) Abrí Docker Desktop.
2) Esperá a que el icono de la bandeja diga "Docker Desktop is running".
3) Volvé a ejecutar este archivo.
'@
    }
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        Fail 'Tu Docker no trae el plugin de Compose (falla "docker compose").' `
            'Actualizá Docker Desktop a la última versión y volvé a intentar.'
    }
}

function Ensure-EnvFile {
    $envPath = Join-Path $root 'api\.env'
    $examplePath = Join-Path $root 'api\.env.example'
    if (-not (Test-Path $envPath)) {
        if (-not (Test-Path $examplePath)) {
            Fail 'Faltan api/.env y api/.env.example: no hay cómo configurar la API.' `
                'Pedile al que subió el repo que incluya api/.env.example (que api/.env real esté en .gitignore es normal).'
        }
        try {
            Copy-Item -LiteralPath $examplePath -Destination $envPath -ErrorAction Stop
        } catch {
            Fail 'No pude crear api/.env a partir del ejemplo.' `
                "Copiá manualmente: copiá api/.env.example y pegalo como api/.env. Detalle: $($_.Exception.Message)"
        }
        Say '  Se creó api/.env a partir de api/.env.example' 'DarkGray'
    }
    # Aviso de TMDB sin mostrar valores del archivo
    $envText = Get-Content -LiteralPath $envPath -Raw -ErrorAction SilentlyContinue
    if ($envText -notmatch '(?m)^\s*TMDB_API_KEY\s*=\s*\S') {
        Say '  AVISO: TMDB_API_KEY está vacía o ausente en api/.env: no se van a ver posters, fotos ni trailers.' 'Yellow'
        Say '  (Key gratis en https://www.themoviedb.org/settings/api -> pegala en api/.env y volvé a levantar)' 'Yellow'
    }
}

function Get-RunningServices {
    $out = & docker compose ps --status running --services
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($out | Where-Object { $_ -and "$_".Trim() })
}

function Test-PortInUse([int]$port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        if (-not $ar.AsyncWaitHandle.WaitOne(400, $false)) { return $false }
        return $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Assert-PortsFree([string[]]$running) {
    # Ojo: nada de claves Int32 en [ordered]/hashtable -> PowerShell resuelve mal
    # el indexer y devuelve null. Usamos lista de objetos.
    #
    # Puertos DUROS (de la app): si los ocupa otro, el stack no puede funcionar -> error.
    # Puertos de BASE DE DATOS: un PostgreSQL/MongoDB nativo de Windows convive
    # (Docker bindea igual); solo avisamos, porque bloquear rompería el arranque
    # en máquinas como la del profe, donde el PG nativo está siempre encendido.
    $hard = @(
        @{ Port = 4200;  Service = 'web';  Label = 'frontend Angular' }
        @{ Port = 3500;  Service = 'api';  Label = 'la API' }
    )
    $soft = @(
        @{ Port = 5432;  Service = 'postgres'; Label = 'PostgreSQL' }
        @{ Port = 27017; Service = 'mongo';    Label = 'MongoDB' }
    )
    $busy = @()
    foreach ($entry in $hard) {
        if ($running -contains $entry.Service) { continue }
        if (Test-PortInUse $entry.Port) { $busy += "$($entry.Port) ($($entry.Label))" }
    }
    if ($busy.Count -gt 0) {
        Fail ('No pude usar estos puertos porque ya están ocupados por otro programa: ' + ($busy -join ', ')) @'
Si el culpable es otra app (XAMPP, otro proyecto, un servidor que dejaste corriendo), cerrala y volvé a ejecutar este archivo.
Si es un servidor de "algo raro", reiniciá la PC y probá de nuevo.
'@
    }
    $softBusy = @()
    foreach ($entry in $soft) {
        if ($running -contains $entry.Service) { continue }
        if (Test-PortInUse $entry.Port) { $softBusy += "$($entry.Port) ($($entry.Label))" }
    }
    if ($softBusy.Count -gt 0) {
        Say ('  AVISO: el puerto ' + ($softBusy -join ', ') + ' ya lo usa otra instalación (¿PostgreSQL o MongoDB nativos de Windows?).') 'Yellow'
        Say '  Igual voy a intentar levantar: si más abajo falla algo de la base, detené esos servicios' 'Yellow'
        Say '  (Inicio -> escribí "Servicios" -> PostgreSQL/MongoDB -> Detener) y volvé a ejecutar.' 'Yellow'
    }
}

function Invoke-ComposeUp {
    <# Arranca el stack en un job con tope de tiempo: "docker compose up" puede
       quedarse esperando indefinidamente si una dependencia nunca queda healthy
       (p.ej. un script SQL de db/ que truena en el primer arranque). Devuelve
       el exit code de compose, o -1 si se superó el tope.
       No se recibe output en el loop (Receive-Job bloquea hasta el próximo
       fragmento y anularía el tope): solo heartbeats; el detalle se imprime
       únicamente si falla. #>
    Say 'Levantando MovieWeb (build + contenedores)...' 'Cyan'
    Say 'Primera vez: puede tardar 5-10 minutos mientras descarga imágenes.' 'DarkGray'
    $job = Start-Job -ArgumentList $root -ScriptBlock {
        param($dir)
        Set-Location $dir
        docker compose up --build -d 2>&1 | ForEach-Object { "$_" }
        "===EXITCODE=$LASTEXITCODE==="
    }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $timedOut = $false
    while (-not (Wait-Job $job -Timeout 20)) {
        if ($sw.Elapsed.TotalSeconds -gt 720) { $timedOut = $true; break }
        $txt = '  ...arrancando ({0}m {1:d2}s). No cierres esta ventana.' -f [int]$sw.Elapsed.TotalMinutes, $sw.Elapsed.Seconds
        Say $txt 'DarkGray'
    }
    if ($timedOut) { Stop-Job $job -ErrorAction SilentlyContinue }
    $lines = Receive-Job $job
    Remove-Job $job -Force -ErrorAction SilentlyContinue
    $raw = ($lines | Out-String)
    $exit = -2
    if ($raw -match '===EXITCODE=(-?\d+)==') { $exit = [int]$Matches[1] }
    if ($exit -ne 0) { Write-Host $raw }
    if ($timedOut) { return -1 }
    return $exit
}

function Wait-Ready([int]$timeoutSec = 420) {
    # Devuelve: 'ready' | 'crashed' | 'timeout'
    Say ''
    Say 'Esperando a que todo responda (la primera vez puede tardar varios minutos)...' 'Cyan'
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    $started = Get-Date
    $apiOk = $false
    $webOk = $false
    while ((Get-Date) -lt $deadline) {
        if (-not $apiOk) {
            try {
                $r = Invoke-WebRequest -Uri 'http://localhost:3500/api/health' -UseBasicParsing -TimeoutSec 3
                if ($r.StatusCode -eq 200) {
                    $apiOk = $true
                    Say '  [ok] API      -> http://localhost:3500' 'Green'
                }
            } catch { }
        }
        if ($apiOk -and -not $webOk) {
            try {
                $r = Invoke-WebRequest -Uri 'http://localhost:4200/' -UseBasicParsing -TimeoutSec 5
                if ($r.StatusCode -eq 200) {
                    $webOk = $true
                    Say '  [ok] Frontend -> http://localhost:4200' 'Green'
                }
            } catch { }
        }
        if ($apiOk -and $webOk) { return 'ready' }
        # Detección de contenedores caídos (pasada una gracia de 20s para no
        # confundir con el arranque normal "Created/Starting")
        if (((Get-Date) - $started).TotalSeconds -gt 20) {
            $all = & docker compose ps -a --format '{{.Service}}|{{.Status}}'
            foreach ($line in @($all)) {
                if ("$line" -match '\|(Exited|Restarting|Dead)') { return 'crashed' }
            }
        }
        Start-Sleep -Seconds 3
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ''
    return 'timeout'
}

function Show-Diagnostics {
    Write-Host ''
    Say '--- Estado de los contenedores ---' 'Yellow'
    & docker compose ps -a
    Write-Host ''
    Say '--- Últimos logs (api y web) ---' 'Yellow'
    & docker compose logs --tail=40 api web
    Write-Host ''
    Say 'Pistas:' 'Yellow'
    Say '  1) Leé los logs de arriba: el primer "error" casi siempre lo explica todo.'
    Say '  2) Reinicio limpio: DETENER.cmd y después INICIAR.cmd.'
    Say '  3) Si el error aparece en una tuya, deshacé el cambio: git checkout -- <archivo>'
    Say '  4) Si nada funciona, sacale una foto a esta pantalla y pegala en el grupo.'
}

function Show-Success {
    Write-Host ''
    Say '==========================================' 'Green'
    Say '   TODO LISTO - MovieWeb está arriba' 'Green'
    Say '==========================================' 'Green'
    Say '  App:     http://localhost:4200' 'White'
    Say '  API:     http://localhost:3500/api/health' 'White'
    Write-Host ''
    Say '  Detener (guarda los datos):  DETENER.cmd' 'Gray'
    Say '  Borrar y recrear la base:    RESET_BD.cmd' 'Gray'
    Say '  Logs en vivo:                docker compose logs -f' 'Gray'
    Write-Host ''
}

# ─── Acciones ───────────────────────────────────────────────────────────────

function Invoke-Start {
    Assert-Docker
    Ensure-EnvFile

    $running = Get-RunningServices
    Assert-PortsFree $running

    $upExit = Invoke-ComposeUp
    if ($upExit -eq -1) {
        Show-Diagnostics
        Fail 'El arranque se colgó esperando más de 12 minutos.' @'
Causas típicas:
  - Internet lento: la imagen no terminó de bajar. Volvé a ejecutar, continúa donde estaba.
  - Alguna base no queda "sana": mirá "docker compose logs postgres" o "docker compose logs mongo".
'@
    }
    if ($upExit -ne 0) {
        Show-Diagnostics
        Fail 'docker compose up terminó con errores (mirá el bloque de arriba).' `
            'Los motivos más comunes: un puerto ocupado o una imagen que no se pudo construir.'
    }

    $state = Wait-Ready
    if ($state -eq 'ready') {
        Show-Success
        exit 0
    }
    Show-Diagnostics
    if ($state -eq 'crashed') {
        Fail 'Un contenedor se cortó apenas arrancó (aparece como Exited o Restarting arriba).' `
            'Si es postgres en la primera ejecución, el error está en un script SQL de db/: mirá "docker compose logs postgres".'
    }
    Fail 'El stack no terminó de responder dentro del tiempo esperado (7 minutos).' `
        'Los logs de arriba muestran qué quedó trabado.'
}

function Invoke-Stop {
    Assert-Docker
    Write-Host ''
    Say 'Deteniendo los contenedores de MovieWeb...' 'Cyan'
    & docker compose down
    if ($LASTEXITCODE -ne 0) {
        Fail 'No pude detener los contenedores.' 'Mirá el error de arriba.'
    }
    Say 'Listo. Los datos de la base quedaron guardados (para borrar todo está RESET_BD.cmd).' 'Green'
    exit 0
}

function Invoke-Reset {
    Assert-Docker
    Write-Host ''
    Write-Host '  ATENCIÓN: esto BORRA todas las bases de datos locales' -ForegroundColor Red
    Write-Host '  (películas cargadas, usuarios, ratings, timeline... todo).' -ForegroundColor Red
    Write-Host ''
    $answer = Read-Host 'Escribí SI para confirmar, o cualquier otra cosa para cancelar'
    if ($answer -ne 'SI') {
        Say 'Cancelado: no se tocó nada.' 'Yellow'
        exit 0
    }
    Say 'Borrando volúmenes y recreando desde cero...' 'Cyan'
    & docker compose down -v
    if ($LASTEXITCODE -ne 0) {
        Fail 'No pude borrar los volúmenes.' 'Mirá el error de arriba.'
    }
    Invoke-Start   # vuelve a levantar todo + recarga los scripts de db/
}

switch ($Action) {
    'start' { Invoke-Start }
    'stop'  { Invoke-Stop }
    'reset' { Invoke-Reset }
}
