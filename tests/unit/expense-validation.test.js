const {
  RequestValidationError,
  validateExpense,
} = require("../../expense-validation");

const validExpense = {
  description: "Almuerzo",
  amount: 12500,
  category: "Alimentación",
  date: "2024-02-29",
};

function expectInvalidExpense(expense, message) {
  expect(() => validateExpense(expense)).toThrow(RequestValidationError);
  expect(() => validateExpense(expense)).toThrow(message);
}

describe("validateExpense", () => {
  test("accepts a complete expense and returns no replacement value", () => {
    expect(validateExpense(validExpense)).toBeUndefined();
  });

  test("accepts the smallest positive finite amount", () => {
    expect(validateExpense({ ...validExpense, amount: Number.MIN_VALUE }))
      .toBeUndefined();
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["an array", []],
    ["a string", "expense"],
    ["a number", 12],
  ])("rejects %s instead of an expense object", (_label, expense) => {
    expectInvalidExpense(expense, "El cuerpo debe ser un objeto JSON.");
  });

  test.each([
    ["missing", { ...validExpense, description: undefined }],
    ["non-string", { ...validExpense, description: 12 }],
    ["empty", { ...validExpense, description: "" }],
    ["whitespace-only", { ...validExpense, description: " \t " }],
  ])("rejects a %s description", (_label, expense) => {
    expectInvalidExpense(expense, "La descripción es obligatoria.");
  });

  test.each([
    ["missing", { ...validExpense, amount: undefined }],
    ["string", { ...validExpense, amount: "12500" }],
    ["null", { ...validExpense, amount: null }],
    ["NaN", { ...validExpense, amount: Number.NaN }],
    ["positive infinity", { ...validExpense, amount: Number.POSITIVE_INFINITY }],
    ["negative infinity", { ...validExpense, amount: Number.NEGATIVE_INFINITY }],
    ["zero", { ...validExpense, amount: 0 }],
    ["negative", { ...validExpense, amount: -0.01 }],
  ])("rejects a %s amount", (_label, expense) => {
    expectInvalidExpense(
      expense,
      "El valor debe ser un número mayor que cero.",
    );
  });

  test.each([
    ["missing", { ...validExpense, category: undefined }],
    ["non-string", { ...validExpense, category: 5 }],
    ["empty", { ...validExpense, category: "" }],
    ["whitespace-only", { ...validExpense, category: "  " }],
  ])("rejects a %s category", (_label, expense) => {
    expectInvalidExpense(expense, "La categoría es obligatoria.");
  });

  test.each([
    ["missing", { ...validExpense, date: undefined }],
    ["null", { ...validExpense, date: null }],
    ["non-string", { ...validExpense, date: 20240229 }],
    ["wrong format", { ...validExpense, date: "29-02-2024" }],
    ["timestamp", { ...validExpense, date: "2024-02-29T00:00:00Z" }],
    ["impossible day", { ...validExpense, date: "2023-02-29" }],
    ["out-of-range month", { ...validExpense, date: "2024-13-01" }],
  ])("rejects a %s date", (_label, expense) => {
    expectInvalidExpense(expense, "La fecha no es válida.");
  });

  test("accepts a valid date at the end of a leap year month", () => {
    expect(validateExpense({ ...validExpense, date: "2024-02-29" }))
      .toBeUndefined();
  });
});
