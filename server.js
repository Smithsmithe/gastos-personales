"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const appDirectory = __dirname;
const databasePath = path.resolve(
  process.env.GASTOS_DB_PATH || path.join(appDirectory, "gastos.db"),
);
const port = Number(process.env.PORT || 8000);
const maximumRequestSize = 1024 * 1024;
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/script.js", ["script.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

class RequestValidationError extends Error {}

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    date TEXT NOT NULL
  )
`);

function sendJson(response, status, payload) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  response.writeHead(status, {
    ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maximumRequestSize) {
        reject(new Error("El contenido de la solicitud es demasiado grande."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        if (size === 0) {
          throw new RequestValidationError("El contenido de la solicitud está vacío.");
        }
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new RequestValidationError("El cuerpo debe contener JSON válido."));
      }
    });
    request.on("error", reject);
  });
}

function validateExpense(expense) {
  if (!expense || typeof expense !== "object" || Array.isArray(expense)) {
    throw new RequestValidationError("El cuerpo debe ser un objeto JSON.");
  }
  if (typeof expense.description !== "string" || !expense.description.trim()) {
    throw new RequestValidationError("La descripción es obligatoria.");
  }
  if (
    typeof expense.amount !== "number" ||
    !Number.isFinite(expense.amount) ||
    expense.amount <= 0
  ) {
    throw new RequestValidationError("El valor debe ser un número mayor que cero.");
  }
  if (typeof expense.category !== "string" || !expense.category.trim()) {
    throw new RequestValidationError("La categoría es obligatoria.");
  }
  const parsedDate = new Date(`${expense.date}T00:00:00.000Z`);
  if (
    typeof expense.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expense.date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== expense.date
  ) {
    throw new RequestValidationError("La fecha no es válida.");
  }
}

function sendStaticFile(response, file, contentType) {
  try {
    const content = fs.readFileSync(path.join(appDirectory, file));
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  } catch {
    sendJson(response, 500, { error: "No se pudo cargar la aplicación." });
  }
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;

  try {
    if (request.method === "GET" && pathname === "/api/expenses") {
      const expenses = database.prepare(
        "SELECT id, description, amount, category, date FROM expenses ORDER BY id",
      ).all();
      sendJson(response, 200, expenses);
      return;
    }

    if (request.method === "POST" && pathname === "/api/expenses") {
      const expense = await readJson(request);
      validateExpense(expense);
      const result = database.prepare(
        "INSERT INTO expenses (description, amount, category, date) VALUES (?, ?, ?, ?)",
      ).run(
        expense.description.trim(),
        expense.amount,
        expense.category.trim(),
        expense.date,
      );
      const savedExpense = database.prepare(
        "SELECT id, description, amount, category, date FROM expenses WHERE id = ?",
      ).get(Number(result.lastInsertRowid));
      sendJson(response, 201, savedExpense);
      return;
    }

    const deleteMatch = pathname.match(/^\/api\/expenses\/(\d+)$/);
    if (request.method === "DELETE" && deleteMatch) {
      const result = database.prepare("DELETE FROM expenses WHERE id = ?")
        .run(Number(deleteMatch[1]));
      if (result.changes === 0) {
        sendJson(response, 404, { error: "No se encontró el gasto." });
        return;
      }
      sendJson(response, 204);
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "Recurso no encontrado." });
      return;
    }

    const staticFile = staticFiles.get(pathname);
    if (request.method === "GET" && staticFile) {
      sendStaticFile(response, ...staticFile);
      return;
    }
    sendJson(response, 404, { error: "Recurso no encontrado." });
  } catch (error) {
    if (error instanceof RequestValidationError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    console.error("Error al procesar la solicitud:", error);
    sendJson(response, 500, { error: "No se pudo completar la operación." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Aplicación disponible en http://127.0.0.1:${port}`);
  console.log(`Base de datos SQLite: ${databasePath}`);
});

function closeServer() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
