# Gastos personales

Aplicación local para registrar, consultar, filtrar y eliminar gastos. La
interfaz está hecha con HTML, CSS y JavaScript; un servidor Node.js gestiona
los datos en SQLite.

## Requisitos

- Node.js 22.13 o posterior.
- La aplicación no necesita paquetes npm en tiempo de ejecución.

## Ejecución

Desde la carpeta del proyecto, inicia el servidor:

```powershell
node server.js
```

Abre <http://127.0.0.1:8000> en el navegador. No abras `index.html`
directamente: la aplicación necesita el servidor para consultar y guardar
gastos.

## Pruebas

Instala las dependencias de desarrollo y Chromium para Playwright:

```powershell
npm install
npx playwright install chromium
```

Ejecuta todas las pruebas o una suite concreta:

```powershell
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
```

Jest busca pruebas en `tests/unit/` y `tests/integration/`; Playwright, en
`tests/e2e/`. Playwright genera un informe HTML con pasos y capturas en
`playwright-report/`. Para abrirlo después de ejecutar las pruebas:

```powershell
npm run test:e2e:report
```

## Datos

La base de datos `gastos.db` se crea junto a `server.js` y conserva los datos
entre ejecuciones. Para usar otra ubicación, define `GASTOS_DB_PATH` antes de
iniciar el servidor. El puerto predeterminado es `8000`; puede cambiarse con la
variable de entorno `PORT`.
