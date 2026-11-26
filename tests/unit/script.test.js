/** @jest-environment jsdom */

const fs = require("node:fs");
const path = require("node:path");

const appHtml = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  };
}

function expense(overrides = {}) {
  return {
    id: 1,
    description: "Mercado",
    amount: 12500,
    category: "Alimentación",
    date: "2024-02-29",
    ...overrides,
  };
}

async function settleAsyncHandlers() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function startApp(fetchMock = jest.fn().mockResolvedValue(jsonResponse([]))) {
  jest.resetModules();
  document.open();
  document.write(appHtml);
  document.close();
  global.fetch = fetchMock;
  require("../../script.js");
  await settleAsyncHandlers();
  return fetchMock;
}

function element(selector) {
  return document.querySelector(selector);
}

async function submitForm() {
  element("#expense-form").dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
  await settleAsyncHandlers();
}

function fillExpenseForm({
  description = "  Transporte  ",
  amount = "1250",
  category = "Alimentación",
  date = "2024-02-29",
} = {}) {
  element("#description").value = description;
  element("#amount").value = amount;
  element("#category").value = category;
  element("#date").value = date;
}

describe("script.js", () => {
  afterEach(() => {
    delete global.fetch;
  });

  test("loads expenses, sorts categories, renders dates and COP amounts", async () => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse([
      expense({ amount: 1234 }),
    ])));

    expect(element("#category").options).toHaveLength(13);
    expect(element("#category").options[1].text).toBe("Alimentación");
    expect(element("#expense-list").children).toHaveLength(1);
    expect(element(".expense-description").textContent).toBe("Mercado");
    expect(element(".expense-meta").textContent).toContain("29/2/2024");
    expect(element(".expense-amount").textContent).toContain("$");
    expect(element(".expense-amount").textContent).toContain("1.234");
    expect(element("#total-amount").textContent).toContain("1.234");
    expect(element("#empty-message").hidden).toBe(true);
    expect(element("#status-message").textContent).toBe("");
  });

  test("renders an empty list and zero total after a successful empty load", async () => {
    await startApp();

    expect(element("#expense-list").children).toHaveLength(0);
    expect(element("#total-amount").textContent).toContain("$");
    expect(element("#empty-message").textContent)
      .toBe("Aún no hay gastos registrados.");
    expect(element("#empty-message").hidden).toBe(false);
  });

  test.each([
    ["missing year", "", "Alimentación · "],
    ["zero month", "2024-00-01", "Alimentación · 2024-00-01"],
    ["zero day", "2024-01-00", "Alimentación · 2024-01-00"],
  ])("preserves a date with a %s component", async (_label, date, expectedMeta) => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse([
      expense({ date }),
    ])));

    expect(element(".expense-meta").textContent).toBe(expectedMeta);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["an array", []],
    ["a missing integer id", expense({ id: undefined })],
    ["a non-integer id", expense({ id: 1.5 })],
    ["a non-string description", expense({ description: 5 })],
    ["an empty description", expense({ description: " \t " })],
    ["a string amount", expense({ amount: "12500" })],
    ["a NaN amount", expense({ amount: Number.NaN })],
    ["an infinite amount", expense({ amount: Number.POSITIVE_INFINITY })],
    ["a zero amount", expense({ amount: 0 })],
    ["a negative amount", expense({ amount: -1 })],
    ["a non-string category", expense({ category: null })],
    ["a non-string date", expense({ date: 20240229 })],
  ])("rejects API expense with %s", async (_label, invalidExpense) => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse([invalidExpense])));

    expect(element("#status-message").textContent)
      .toBe("No se pudieron cargar los gastos: Los datos recibidos no tienen un formato válido.");
    expect(element("#empty-message").textContent)
      .toBe("No se pudo conectar con la base de datos.");
    expect(element("#expense-list").children).toHaveLength(0);
  });

  test("reports an invalid top-level response instead of a list", async () => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse({ expenses: [] })));

    expect(element("#status-message").textContent)
      .toContain("Los datos recibidos no tienen un formato válido.");
    expect(element("#empty-message").textContent)
      .toBe("No se pudo conectar con la base de datos.");
  });

  test("shows the server message when the initial request fails", async () => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse(
      { error: "Base de datos no disponible" },
      500,
    )));

    expect(element("#status-message").textContent)
      .toBe("No se pudieron cargar los gastos: Base de datos no disponible");
    expect(element("#empty-message").textContent)
      .toBe("No se pudo conectar con la base de datos.");
  });

  test("uses the status fallback when an error response is not JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: jest.fn().mockRejectedValue(new Error("invalid JSON")),
    });
    await startApp(fetchMock);

    expect(element("#status-message").textContent)
      .toBe("No se pudieron cargar los gastos: Error del servidor (502).");
  });

  test("shows a network error from the initial request", async () => {
    await startApp(jest.fn().mockRejectedValue(new Error("sin conexión")));

    expect(element("#status-message").textContent)
      .toBe("No se pudieron cargar los gastos: sin conexión");
  });

  test("keeps the all-category total while filtering visible expenses", async () => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse([
      expense({ amount: 1000 }),
      expense({
        id: 2,
        description: "Bus",
        amount: 2500,
        category: "Transporte",
      }),
    ])));

    element("#category-filter").value = "Transporte";
    element("#category-filter").dispatchEvent(new Event("change"));

    expect(element("#expense-list").children).toHaveLength(1);
    expect(element(".expense-description").textContent).toBe("Bus");
    expect(element("#total-amount").textContent).toContain("3.500");
    expect(element("#empty-message").hidden).toBe(true);
  });

  test("shows the filtered-empty message when no expense matches", async () => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse([
      expense({ amount: 1000 }),
    ])));

    element("#category-filter").value = "Ocio";
    element("#category-filter").dispatchEvent(new Event("change"));

    expect(element("#expense-list").children).toHaveLength(0);
    expect(element("#empty-message").textContent)
      .toBe("No hay gastos en esta categoría.");
    expect(element("#empty-message").hidden).toBe(false);
    expect(element("#total-amount").textContent).toContain("1.000");
  });

  test("adds saved categories and retains a selected category while available", async () => {
    await startApp(jest.fn().mockResolvedValue(jsonResponse([
      expense({ category: "Transporte" }),
    ])));

    const filter = element("#category-filter");
    expect([...filter.options].map((option) => option.value))
      .toContain("Transporte");
    filter.value = "Transporte";
    filter.dispatchEvent(new Event("change"));

    expect(filter.value).toBe("Transporte");
    expect(element("#expense-list").children).toHaveLength(1);
  });

  test("resets a selected custom category after its last expense is deleted", async () => {
    const fetchMock = jest.fn((url, options = {}) => {
      if (options.method === "DELETE") {
        return Promise.resolve(jsonResponse(null, 204));
      }
      return Promise.resolve(jsonResponse([expense({ category: "Temporal" })]));
    });
    await startApp(fetchMock);
    element("#category-filter").value = "Temporal";
    element("#category-filter").dispatchEvent(new Event("change"));

    element('.delete-button[aria-label="Eliminar gasto: Mercado"]').click();
    await settleAsyncHandlers();

    expect(element("#category-filter").value).toBe("");
    expect(element("#expense-list").children).toHaveLength(0);
    expect(element("#empty-message").textContent)
      .toBe("Aún no hay gastos registrados.");
  });

  test("removes an expense after a successful 204 delete response", async () => {
    const fetchMock = jest.fn((url, options = {}) => {
      if (options.method === "DELETE") {
        return Promise.resolve(jsonResponse(null, 204));
      }
      return Promise.resolve(jsonResponse([expense()]));
    });
    await startApp(fetchMock);

    element(".delete-button").click();
    await settleAsyncHandlers();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/expenses/1",
      { method: "DELETE" },
    );
    expect(element("#expense-list").children).toHaveLength(0);
    expect(element("#empty-message").textContent)
      .toBe("Aún no hay gastos registrados.");
  });

  test("keeps an expense and reports the server error when delete fails", async () => {
    const fetchMock = jest.fn((url, options = {}) => {
      if (options.method === "DELETE") {
        return Promise.resolve(jsonResponse(
          { error: "No se encontró el gasto." },
          404,
        ));
      }
      return Promise.resolve(jsonResponse([expense()]));
    });
    await startApp(fetchMock);

    element(".delete-button").click();
    await settleAsyncHandlers();

    expect(element("#expense-list").children).toHaveLength(1);
    expect(element("#status-message").textContent)
      .toBe("No se pudo eliminar el gasto: No se encontró el gasto.");
  });

  test("requires a non-blank description and focuses that field", async () => {
    await startApp();
    fillExpenseForm({ description: "   " });

    await submitForm();

    expect(element("#status-message").textContent)
      .toBe("Escribe una descripción para el gasto.");
    expect(document.activeElement).toBe(element("#description"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["blank", ""],
    ["zero", "0"],
    ["negative", "-2"],
  ])("rejects a %s form amount and focuses the amount field", async (_label, amount) => {
    await startApp();
    fillExpenseForm({ amount });

    await submitForm();

    expect(element("#status-message").textContent)
      .toBe("El valor debe ser un número mayor que cero.");
    expect(document.activeElement).toBe(element("#amount"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("requires category and date before submitting", async () => {
    await startApp();
    fillExpenseForm({ category: "", date: "" });

    await submitForm();

    expect(element("#status-message").textContent)
      .toBe("Completa la categoría y la fecha del gasto.");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("posts trimmed form values, renders the response and resets the form", async () => {
    const savedExpense = expense({ description: "Transporte", amount: 1250 });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(savedExpense, 201));
    await startApp(fetchMock);
    fillExpenseForm();

    await submitForm();

    expect(fetchMock).toHaveBeenLastCalledWith("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Transporte",
        amount: 1250,
        category: "Alimentación",
        date: "2024-02-29",
      }),
    });
    expect(element("#expense-list").children).toHaveLength(1);
    expect(element(".expense-description").textContent).toBe("Transporte");
    expect(element("#description").value).toBe("");
    expect(document.activeElement).toBe(element("#description"));
  });

  test("reports a server error when saving fails", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: "Error de escritura" }, 500));
    await startApp(fetchMock);
    fillExpenseForm();

    await submitForm();

    expect(element("#status-message").textContent)
      .toBe("No se pudo guardar el gasto: Error de escritura");
    expect(element("#expense-list").children).toHaveLength(0);
  });

  test("rejects a malformed expense returned after saving", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: "invalid" }, 201));
    await startApp(fetchMock);
    fillExpenseForm();

    await submitForm();

    expect(element("#status-message").textContent)
      .toBe("No se pudo guardar el gasto: El servidor devolvió un gasto con formato inválido.");
    expect(element("#expense-list").children).toHaveLength(0);
  });
});
