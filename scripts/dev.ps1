#Requires -Version 5.1
<#
  MovieWeb - arranque de desarrollo (npm + Turborepo).

  Uso:
    scripts\dev.ps1                -> instala dependencias (si hace falta) y levanta API + frontend
    scripts\dev.ps1 -Action stop   -> libera los puertos 3500 y 4200
    scripts\dev.ps1 -Action reset  -> recrea la base PostgreSQL 'movies' desde db/ (pide confirmación)

  Requiere Node.js 20+ y PostgreSQL / MongoDB nativos (no hay contenedores).
  En Windows lo normal es ejecutar los .cmd de la raíz (INICIAR / DETENER / RESET_BD).
#>
[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'reset')]
    [string]$Action = 'start'
)

$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

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

function Get-EnvMap {
    # Lee api/.env a un hashtable SIN imprimir sus valores.
    $map = @{}
    $envPath = Join-Path $root 'api\.env'
    if (Test-Path $envPath) {
        foreach ($line in Get-Content -LiteralPath $envPath) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
                $map[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
            }
        }
    }
    return $map
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

function Assert-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Fail 'No tenés Node.js instalado.' 'Instalá Node 20 o superior desde https://nodejs.org y volvé a ejecutar.'
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Fail 'No tenés npm disponible.' 'Reinstalá Node.js (npm viene incluido) desde https://nodejs.org.'
    }
    Say ("  Node {0}  /  npm {1}" -f (& node -v), (& npm -v)) 'DarkGray'
}

function Ensure-EnvFile {
    $envPath = Join-Path $root 'api\.env'
    $examplePath = Join-Path $root 'api\.env.example'
    if (-not (Test-Path $envPath)) {
        if (-not (Test-Path $examplePath)) {
            Fail 'Faltan api/.env y api/.env.example: no hay cómo configurar la API.' 'Pedile al que subió el repo que incluya api/.env.example.'
        }
        Copy-Item -LiteralPath $examplePath -Destination $envPath -ErrorAction Stop
        Say '  Se creó api/.env a partir de api/.env.example' 'DarkGray'
    }
    $envText = Get-Content -LiteralPath $envPath -Raw -ErrorAction SilentlyContinue
    if ($envText -notmatch '(?m)^\s*TMDB_API_KEY\s*=\s*\S') {
        Say '  AVISO: TMDB_API_KEY está vacía en api/.env: no se verán posters, fotos ni trailers.' 'Yellow'
        Say '  (Key gratis en https://www.themoviedb.org/settings/api)' 'Yellow'
    }
}

function Test-Databases {
    # Las bases son nativas: solo avisamos si no responden (no las levantamos nosotros).
    $map = Get-EnvMap
    $pgHost = if ($map['DB_HOST']) { $map['DB_HOST'] } else { 'localhost' }
    $pgPort = if ($map['DB_PORT']) { [int]$map['DB_PORT'] } else { 5432 }
    if (Test-PortInUse $pgPort) {
        Say ("  [ok] PostgreSQL -> {0}:{1}" -f $pgHost, $pgPort) 'Green'
    } else {
        Say ("  AVISO: PostgreSQL no responde en {0}:{1}." -f $pgHost, $pgPort) 'Yellow'
        Say '  Arrancá el servicio de PostgreSQL (o revisá api/.env) antes de usar la API.' 'Yellow'
    }
    if (Test-PortInUse 27017) {
        Say '  [ok] MongoDB -> localhost:27017' 'Green'
    } else {
        Say '  AVISO: MongoDB no responde en localhost:27017.' 'Yellow'
        Say '  Arrancá el servicio de MongoDB antes de usar el timeline.' 'Yellow'
    }
}

function Invoke-Start {
    Assert-Node
    Ensure-EnvFile
    Test-Databases

    if (-not (Test-Path (Join-Path $root 'node_modules'))) {
        Say ''
        Say 'Instalando dependencias (npm install)...' 'Cyan'
        & npm install
        if ($LASTEXITCODE -ne 0) { Fail 'Falló npm install.' 'Revisá el error de arriba (¿tenés internet?).' }
    }

    Say ''
    Say '==========================================' 'Green'
    Say '   MovieWeb - levantando con Turborepo' 'Green'
    Say '==========================================' 'Green'
    Say '  App:  http://localhost:4200' 'White'
    Say '  API:  http://localhost:3500/api/health' 'White'
    Say '  Para detener: Ctrl+C en esta ventana (o DETENER.cmd).' 'DarkGray'
    Say ''
    & npm run dev
}

function Invoke-Stop {
    $ports = @(3500, 4200)
    $stopped = 0
    foreach ($p in $ports) {
        $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        foreach ($c in @($conns)) {
            $procId = $c.OwningProcess
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) {
                Say ("  Deteniendo {0} (PID {1}) en el puerto {2}" -f $proc.ProcessName, $procId, $p) 'Cyan'
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                $stopped++
            }
        }
    }
    if ($stopped -eq 0) {
        Say 'No había nada escuchando en 3500/4200.' 'Yellow'
    } else {
        Say 'Listo: desarrollo detenido.' 'Green'
    }
    exit 0
}

function Invoke-Reset {
    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        Fail 'No encontré "psql" en el PATH.' 'Agregá la carpeta bin de PostgreSQL al PATH (o usá pgAdmin) y volvé a ejecutar.'
    }
    Write-Host ''
    Write-Host '  ATENCIÓN: esto BORRA y recrea el esquema de PostgreSQL (películas, usuarios, ratings...).' -ForegroundColor Red
    Write-Host '  La base de MongoDB NO se toca.' -ForegroundColor Red
    Write-Host ''
    $answer = Read-Host 'Escribí SI para confirmar, o cualquier otra cosa para cancelar'
    if ($answer -ne 'SI') {
        Say 'Cancelado: no se tocó nada.' 'Yellow'
        exit 0
    }

    $map = Get-EnvMap
    $dbUser = if ($map['DB_USER']) { $map['DB_USER'] } else { 'postgres' }
    $dbHost = if ($map['DB_HOST']) { $map['DB_HOST'] } else { 'localhost' }
    $dbPort = if ($map['DB_PORT']) { $map['DB_PORT'] } else { '5432' }
    $dbName = if ($map['DB_DATABASE']) { $map['DB_DATABASE'] } else { 'movies' }
    if ($map['DB_PASSWORD']) { $env:PGPASSWORD = $map['DB_PASSWORD'] }

    $dbDir = Join-Path $root 'db'
    Push-Location $dbDir
    try {
        Say 'Cargando 00_load_all.sql (esquema + datos)...' 'Cyan'
        & psql --single-transaction -v ON_ERROR_STOP=1 -h $dbHost -p $dbPort -U $dbUser -d $dbName -f '00_load_all.sql'
        if ($LASTEXITCODE -ne 0) { Fail 'Falló la carga de 00_load_all.sql.' 'Revisá las credenciales en api/.env, que el servidor PostgreSQL esté arriba y que la base "movies" exista.' }
        Say 'Cargando 13_users.sql...' 'Cyan'
        & psql --single-transaction -v ON_ERROR_STOP=1 -h $dbHost -p $dbPort -U $dbUser -d $dbName -f '13_users.sql'
        if ($LASTEXITCODE -ne 0) { Fail 'Falló la carga de 13_users.sql.' 'Mirá el error de arriba.' }
        Say 'Cargando 14_people_indexes.sql...' 'Cyan'
        & psql --single-transaction -v ON_ERROR_STOP=1 -h $dbHost -p $dbPort -U $dbUser -d $dbName -f '14_people_indexes.sql'
        if ($LASTEXITCODE -ne 0) { Fail 'Falló la carga de 14_people_indexes.sql.' 'Mirá el error de arriba.' }
        Say 'Cargando 15_seed_users.sql (usuarios de prueba)...' 'Cyan'
        & psql --single-transaction -v ON_ERROR_STOP=1 -h $dbHost -p $dbPort -U $dbUser -d $dbName -f '15_seed_users.sql'
        if ($LASTEXITCODE -ne 0) { Fail 'Falló la carga de 15_seed_users.sql.' 'Mirá el error de arriba.' }
    } finally {
        Pop-Location
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    Say 'Base PostgreSQL "movies" recreada.' 'Green'
}

switch ($Action) {
    'start' { Invoke-Start }
    'stop'  { Invoke-Stop }
    'reset' { Invoke-Reset }
}
