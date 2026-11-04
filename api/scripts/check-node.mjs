// Corta con un mensaje claro si la versión de Node no alcanza. Lo usan setup-db.mjs
// (importándolo primero) y scripts/dev.ps1. Son las versiones que exige Angular 22
// (engines de @angular/cli): con otra, la API arranca pero `ng serve` no.
const REQUIRED = '22.22.3 o superior dentro de la 22, 24.15 o superior dentro de la 24, o 26 en adelante';

const [major, minor, patch] = process.versions.node.split('.').map(Number);
const supported =
  (major === 22 && (minor > 22 || (minor === 22 && patch >= 3))) ||
  (major === 24 && minor >= 15) ||
  major >= 26;

if (!supported) {
  console.error(`\nERROR: esta app necesita Node ${REQUIRED}. Tenés Node ${process.versions.node}.`);
  console.error('Qué hacer: instalá la versión LTS desde https://nodejs.org y volvé a ejecutar.');
  process.exit(1);
}
