"use strict";

class RequestValidationError extends Error {}

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

module.exports = { RequestValidationError, validateExpense };
