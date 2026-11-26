const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { expect, test } = require("@playwright/test");

const projectDirectory = path.resolve(__dirname, "../..");

async function clearExpenses(request) {
  const response = await request.get("/api/expenses");
  expect(response.ok()).toBe(true);

  const expenses = await response.json();
  await Promise.all(
    expenses.map((expense) => request.delete(`/api/expenses/${expense.id}`)),
  );
}

async function createExpense(request, expense) {
  const response = await request.post("/api/expenses", { data: expense });
  expect(response.status()).toBe(201);
  return response.json();
}

async function fillExpenseForm(page, {
  description,
  amount,
  category = "Alimentación",
  date = "2026-11-25",
}) {
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Valor").fill(String(amount));
  await page.getByLabel("Categoría", { exact: true }).selectOption(category);
  await page.getByLabel("Fecha").fill(date);
}

async function submitExpense(page, expense) {
  await fillExpenseForm(page, expense);
  await page.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: expense.description }),
  ).toBeVisible();
}

async function stepWithScreenshot(page, testInfo, title, action) {
  return test.step(title, async () => {
    const result = await action();
    await testInfo.attach(title, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    return result;
  });
}

async function reservePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => {
    listener.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function startIsolatedServer(port, databasePath) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      GASTOS_DB_PATH: databasePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let output = "";
  let settled = false;
  let timeout;
  const ready = new Promise((resolve, reject) => {
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    timeout = setTimeout(
      () => fail(new Error(`El servidor aislado no inició. ${output}`)),
      15_000,
    );
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (!settled && output.includes("Aplicación disponible")) {
        settled = true;
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", fail);
    child.once("exit", (code, signal) => {
      fail(new Error(
        `El servidor aislado terminó antes de iniciar (código ${code}, señal ${signal}). ${output}`,
      ));
    });
  });

  return { child, ready };
}

async function stopIsolatedServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = once(child, "exit");
  child.kill("SIGTERM");
  let timeout;
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(false), 5_000);
    }),
  ]);
  clearTimeout(timeout);

  if (!stopped) {
    const forceExit = once(child, "exit");
    child.kill("SIGKILL");
    await forceExit;
  }
}

test.describe("Flujos de gastos en el navegador", () => {
  test.beforeEach(async ({ request }) => {
    await clearExpenses(request);
  });

  test("carga la aplicación y muestra los controles principales", async ({ page }, testInfo) => {
    await stepWithScreenshot(page, testInfo, "Abrir la aplicación", () =>
      page.goto("/"),
    );
    await stepWithScreenshot(page, testInfo, "Comprobar elementos principales", async () => {
      await expect(page).toHaveTitle("Registro de gastos personales");
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Gastos personales",
      })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Registrar gasto" }))
        .toBeVisible();
      await expect(page.getByRole("heading", { name: "Gastos registrados" }))
        .toBeVisible();
      await expect(page.getByLabel("Descripción")).toBeVisible();
      await expect(page.getByLabel("Valor")).toBeVisible();
      await expect(page.getByLabel("Categoría", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Fecha")).toBeVisible();
      await expect(page.getByLabel("Filtrar por categoría")).toBeVisible();
      await expect(page.locator("#empty-message"))
        .toHaveText("Aún no hay gastos registrados.");
    });
  });

  test("marca como obligatorios los campos vacíos del formulario", async ({ page }, testInfo) => {
    await page.goto("/");
    await stepWithScreenshot(page, testInfo, "Enviar formulario sin completar", async () => {
      await page.getByRole("button", { name: "Guardar gasto" }).click();

      for (const selector of [
        "#description",
        "#amount",
        "#category",
        "#date",
      ]) {
        const isValid = await page.locator(selector)
          .evaluate((input) => input.validity.valid);
        expect(isValid).toBe(false);
      }
      await expect(page.locator("#status-message")).toHaveText("");
    });
  });

  test("rechaza descripciones en blanco aunque el campo no esté vacío", async ({ page }, testInfo) => {
    await page.goto("/");
    await stepWithScreenshot(page, testInfo, "Validar descripción en blanco", async () => {
      await fillExpenseForm(page, {
        description: "   ",
        amount: 1250,
      });

      await page.getByRole("button", { name: "Guardar gasto" }).click();

      await expect(page.locator("#status-message"))
        .toHaveText("Escribe una descripción para el gasto.");
      await expect(page.getByLabel("Descripción")).toBeFocused();
      await expect(page.getByRole("listitem")).toHaveCount(0);
    });
  });

  test("el navegador impide importes iguales o inferiores a cero", async ({ page }, testInfo) => {
    await page.goto("/");
    await stepWithScreenshot(page, testInfo, "Validar importe no positivo", async () => {
      await fillExpenseForm(page, {
        description: "Importe no válido",
        amount: 0,
      });

      const isAmountValid = await page.getByLabel("Valor")
        .evaluate((input) => input.validity.valid);
      expect(isAmountValid).toBe(false);
      await page.getByRole("button", { name: "Guardar gasto" }).click();

      await expect(page.getByRole("listitem")).toHaveCount(0);
      await expect(page.locator("#status-message")).toHaveText("");
    });
  });

  test("el servidor rechaza datos inválidos enviados desde el navegador", async ({ page }, testInfo) => {
    await page.goto("/");
    await stepWithScreenshot(page, testInfo, "Rechazar datos inválidos en la API", async () => {
      const result = await page.evaluate(async () => {
        const response = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "Importe inválido",
            amount: 0,
            category: "Otros",
            date: "2026-11-25",
          }),
        });
        return { status: response.status, body: await response.json() };
      });

      expect(result.status).toBe(400);
      expect(result.body.error)
        .toBe("El valor debe ser un número mayor que cero.");
      await expect(page.getByRole("listitem")).toHaveCount(0);
    });
  });

  test("registra un gasto, lo muestra en el listado y actualiza el total", async ({ page }, testInfo) => {
    await stepWithScreenshot(page, testInfo, "Abrir formulario de gastos", () =>
      page.goto("/"),
    );
    const description = `Gasto ${randomUUID()}`;

    await stepWithScreenshot(page, testInfo, "Registrar y comprobar el gasto", async () => {
      await submitExpense(page, {
        description,
        amount: 12500,
        category: "Alimentación",
      });

      await expect(page.getByRole("listitem").filter({ hasText: description }))
        .toContainText("Alimentación");
      await expect(page.locator("#total-amount")).toContainText("12.500");
      await expect(page.locator("#status-message")).toHaveText("");
    });
  });

  test("consulta en la interfaz gastos que ya existen en SQLite", async ({ page, request }, testInfo) => {
    const description = `Gasto guardado ${randomUUID()}`;
    await test.step("Preparar el gasto en la base de pruebas", () =>
      createExpense(request, {
        description,
        amount: 9800,
        category: "Casa",
        date: "2026-11-24",
      }),
    );

    await stepWithScreenshot(page, testInfo, "Consultar el gasto en la interfaz", async () => {
      await page.goto("/");

      await expect(page.getByRole("listitem").filter({ hasText: description }))
        .toBeVisible();
      await expect(page.locator("#total-amount")).toContainText("9.800");
    });
  });

  test("filtra por categoría sin alterar el total general", async ({ page, request }, testInfo) => {
    await test.step("Preparar gastos de dos categorías", async () => {
      await createExpense(request, {
        description: `Almuerzo ${randomUUID()}`,
        amount: 1200,
        category: "Alimentación",
        date: "2026-11-24",
      });
    });
    const travelDescription = `Taxi ${randomUUID()}`;
    await test.step("Añadir el gasto de transporte", () =>
      createExpense(request, {
        description: travelDescription,
        amount: 3000,
        category: "Transporte",
        date: "2026-11-25",
      }),
    );

    await stepWithScreenshot(page, testInfo, "Consultar todos los gastos", () =>
      page.goto("/"),
    );
    await stepWithScreenshot(page, testInfo, "Filtrar por transporte", async () => {
      await page.getByLabel("Filtrar por categoría")
        .selectOption("Transporte");

      await expect(page.getByRole("listitem")).toHaveCount(1);
      await expect(page.getByRole("listitem").first())
        .toContainText(travelDescription);
      await expect(page.locator("#total-amount")).toContainText("4.200");
    });
  });

  test("recalcula el total al añadir más de un gasto", async ({ page }, testInfo) => {
    await stepWithScreenshot(page, testInfo, "Abrir la aplicación", () =>
      page.goto("/"),
    );
    await stepWithScreenshot(page, testInfo, "Añadir el primer gasto", () =>
      submitExpense(page, {
        description: `Primer gasto ${randomUUID()}`,
        amount: 12000,
      }),
    );
    await stepWithScreenshot(page, testInfo, "Añadir el segundo y comprobar la suma", async () => {
      await submitExpense(page, {
        description: `Segundo gasto ${randomUUID()}`,
        amount: 500,
        category: "Ocio",
      });

      await expect(page.getByRole("listitem")).toHaveCount(2);
      await expect(page.locator("#total-amount")).toContainText("12.500");
    });
  });

  test("elimina un gasto y actualiza listado y total", async ({ page, request }, testInfo) => {
    const removedDescription = `Eliminar ${randomUUID()}`;
    const remainingDescription = `Conservar ${randomUUID()}`;
    await test.step("Preparar gastos antes de eliminar", async () => {
      await createExpense(request, {
        description: removedDescription,
        amount: 1500,
        category: "Casa",
        date: "2026-11-24",
      });
      await createExpense(request, {
        description: remainingDescription,
        amount: 2500,
        category: "Aseo",
        date: "2026-11-25",
      });
    });
    await stepWithScreenshot(page, testInfo, "Mostrar gastos existentes", () =>
      page.goto("/"),
    );

    await stepWithScreenshot(page, testInfo, "Eliminar un gasto y validar actualización", async () => {
      await page.getByRole("button", {
        name: `Eliminar gasto: ${removedDescription}`,
      }).click();

      await expect(page.getByRole("listitem").filter({
        hasText: removedDescription,
      })).toHaveCount(0);
      await expect(page.getByRole("listitem").filter({
        hasText: remainingDescription,
      })).toBeVisible();
      await expect(page.locator("#total-amount")).toContainText("2.500");
      await expect(page.locator("#empty-message")).toBeHidden();
    });
  });

  test("mantiene los datos de SQLite después de reiniciar el servidor", async ({ page }, testInfo) => {
    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "gastos-e2e-restart-"),
    );
    const databasePath = path.join(temporaryDirectory, "gastos.db");
    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const description = `Persistencia ${randomUUID()}`;
    let server;

    try {
      await test.step("Iniciar servidor con SQLite temporal", async () => {
        server = startIsolatedServer(port, databasePath);
        await server.ready;
      });
      await stepWithScreenshot(page, testInfo, "Abrir aplicación aislada", () =>
        page.goto(baseUrl),
      );
      await stepWithScreenshot(page, testInfo, "Guardar gasto antes del reinicio", async () => {
        await submitExpense(page, {
          description,
          amount: 7650,
          category: "Casa",
        });
        await expect(page.locator("#total-amount")).toContainText("7.650");
      });

      await test.step("Detener y reiniciar el mismo servidor", async () => {
        await stopIsolatedServer(server.child);
        server = undefined;

        server = startIsolatedServer(port, databasePath);
        await server.ready;
      });
      await stepWithScreenshot(page, testInfo, "Consultar los datos tras reiniciar", async () => {
        await page.goto(baseUrl);

        await expect(page.getByRole("listitem").filter({ hasText: description }))
          .toBeVisible();
        await expect(page.locator("#total-amount")).toContainText("7.650");
      });
    } finally {
      if (server) {
        await stopIsolatedServer(server.child);
      }
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
