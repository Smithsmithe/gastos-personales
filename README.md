# 💰 Gastos Personales

Aplicación web sencilla para registrar y consultar gastos personales, desarrollada con HTML, CSS y JavaScript.

<img width="1907" height="932" alt="image" src="https://github.com/user-attachments/assets/f1345412-2f03-4d28-be57-cfa736852fc2" />


## 📋 Descripción

Este proyecto consiste en una aplicación web que permite llevar un registro básico de los gastos personales, consultar los importes registrados y visualizar el total acumulado.

La aplicación utiliza el almacenamiento local del navegador para conservar la información sin necesidad de un servidor o una base de datos externa.

## ✨ Funcionalidades

- Registrar gastos con descripción, valor, categoría y fecha.
- Consultar los gastos registrados.
- Calcular automáticamente el total acumulado.
- Eliminar gastos.
- Validar los datos introducidos.
- Filtrar los gastos por categoría.
- Mostrar los importes en pesos colombianos (COP).
- Conservar los registros mediante `localStorage`.

## 🛠️ Tecnologías utilizadas

- **HTML5:** estructura de la aplicación.
- **CSS3:** diseño y presentación de la interfaz.
- **JavaScript:** lógica, validaciones y gestión de gastos.
- **localStorage:** almacenamiento local de los registros.
- **Visual Studio Code:** entorno de desarrollo.
- **GitHub Copilot:** asistente de inteligencia artificial utilizado para generar y mejorar el código.

## 📁 Estructura del proyecto

```text
gastos-personales/
├── index.html
├── styles.css
├── script.js
├── README.md
└── DEPENDENCIAS.md
```

## 🚀 Instalación y ejecución

La aplicación no requiere instalación de paquetes ni configuración de un servidor.

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/Smithsmithe/gastos-personales.git
   ```

2. Entrar en la carpeta del proyecto:

   ```bash
   cd gastos-personales
   ```

3. Abrir el archivo `index.html` directamente en un navegador web moderno.

También se puede abrir la carpeta del proyecto en Visual Studio Code y ejecutar el archivo `index.html` desde el navegador.

## 💾 Almacenamiento de datos

Los gastos se almacenan en `localStorage`, por lo que permanecen disponibles al recargar o volver a abrir la aplicación en el mismo navegador.

La información no se sincroniza entre dispositivos y puede perderse si se eliminan los datos almacenados del navegador.

## 🔐 Seguridad y limitaciones

- La aplicación no utiliza autenticación de usuarios.
- No se conecta a bancos ni a servicios externos.
- Los datos se almacenan localmente en el navegador.
- No dispone de sincronización remota ni de una base de datos centralizada.
- No requiere dependencias externas para su ejecución.

## 🎓 Contexto académico

Proyecto desarrollado en el marco de la asignatura **Generalización de Código de Automatización en Desarrollo de Software con IA**.

El desarrollo se realizó mediante instrucciones en lenguaje natural dirigidas a GitHub Copilot, utilizando un proceso iterativo de generación, revisión y mejora del código.

## 📄 Licencia

Proyecto académico. No se ha especificado una licencia de distribución.
=======
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
