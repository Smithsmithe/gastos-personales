"use strict";

const STORAGE_KEY = "gastosPersonales";
const categoryOptions = [
  "Alimentación",
  "Aseo",
  "Arriendo",
  "Carro",
  "Casa",
  "Domicilios",
  "Hobbies",
  "Moto",
  "Ocio",
  "Otros",
  "Ropa",
  "Servicios",
];
const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const form = document.querySelector("#expense-form");
const categorySelect = document.querySelector("#category");
const expenseList = document.querySelector("#expense-list");
const totalAmount = document.querySelector("#total-amount");
const emptyMessage = document.querySelector("#empty-message");
const statusMessage = document.querySelector("#status-message");
const categoryFilter = document.querySelector("#category-filter");

function isExpense(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.description === "string" &&
    value.description.trim() !== "" &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    typeof value.category === "string" &&
    typeof value.date === "string"
  );
}

function loadExpenses() {
  try {
    const savedExpenses = localStorage.getItem(STORAGE_KEY);
    if (savedExpenses === null) {
      return [];
    }

    const parsedExpenses = JSON.parse(savedExpenses);
    if (!Array.isArray(parsedExpenses) || !parsedExpenses.every(isExpense)) {
      throw new Error("Los datos guardados no tienen un formato válido.");
    }

    const normalizedExpenses = parsedExpenses.map((expense) =>
      expense.category.toLocaleLowerCase("es-CO") === "casa"
        ? { ...expense, category: "Casa" }
        : expense,
    );
    if (normalizedExpenses.some((expense, index) => expense !== parsedExpenses[index])) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedExpenses));
      } catch (error) {
        statusMessage.textContent = `No se pudo actualizar la categoría guardada: ${error.message}`;
      }
    }
    return normalizedExpenses;
  } catch (error) {
    statusMessage.textContent = `No se pudieron cargar los gastos guardados: ${error.message}`;
    return [];
  }
}

let expenses = loadExpenses();

function displayDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) {
    return date;
  }
  return new Intl.DateTimeFormat("es-ES").format(new Date(year, month - 1, day));
}

categoryOptions
  .sort((first, second) => first.localeCompare(second, "es"))
  .forEach((category) => categorySelect.add(new Option(category, category)));

function renderCategoryFilter() {
  const selectedCategory = categoryFilter.value;
  const savedCategories = [...new Set(expenses.map((expense) => expense.category))];
  const allCategories = [...new Set([...categoryOptions, ...savedCategories])]
    .sort((first, second) => first.localeCompare(second, "es"));

  categoryFilter.replaceChildren(new Option("Todas las categorías", ""));
  allCategories.forEach((category) => {
    categoryFilter.add(new Option(category, category));
  });

  if ([...categoryFilter.options].some((option) => option.value === selectedCategory)) {
    categoryFilter.value = selectedCategory;
  }
}

function renderExpenses() {
  renderCategoryFilter();
  expenseList.replaceChildren();
  let total = 0;

  expenses.forEach((expense, index) => {
    total += expense.amount;

    if (categoryFilter.value && expense.category !== categoryFilter.value) {
      return;
    }

    const item = document.createElement("li");
    item.className = "expense-item";

    const details = document.createElement("div");
    details.className = "expense-details";

    const description = document.createElement("p");
    description.className = "expense-description";
    description.textContent = expense.description;

    const meta = document.createElement("p");
    meta.className = "expense-meta";
    meta.textContent = `${expense.category} · ${displayDate(expense.date)}`;

    const actions = document.createElement("div");
    actions.className = "expense-actions";

    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = currencyFormatter.format(expense.amount);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Eliminar";
    deleteButton.setAttribute("aria-label", `Eliminar gasto: ${expense.description}`);
    deleteButton.addEventListener("click", () => deleteExpense(index));

    details.append(description, meta);
    actions.append(amount, deleteButton);
    item.append(details, actions);
    expenseList.append(item);
  });

  totalAmount.textContent = currencyFormatter.format(total);
  emptyMessage.textContent = expenses.length === 0
    ? "Aún no hay gastos registrados."
    : "No hay gastos en esta categoría.";
  emptyMessage.hidden = expenseList.childElementCount > 0;
}

function saveExpenses(updatedExpenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedExpenses));
  expenses = updatedExpenses;
  statusMessage.textContent = "";
  renderExpenses();
}

function deleteExpense(index) {
  const updatedExpenses = expenses.filter((_, expenseIndex) => expenseIndex !== index);
  try {
    saveExpenses(updatedExpenses);
  } catch (error) {
    statusMessage.textContent = `No se pudo guardar el cambio: ${error.message}`;
  }
}

categoryFilter.addEventListener("change", renderExpenses);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  statusMessage.textContent = "";

  const formData = new FormData(form);
  const description = formData.get("description").trim();
  const amount = Number(formData.get("amount"));
  const category = formData.get("category").trim();
  const date = formData.get("date");

  if (!description) {
    statusMessage.textContent = "Escribe una descripción para el gasto.";
    form.elements.description.focus();
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    statusMessage.textContent = "El valor debe ser un número mayor que cero.";
    form.elements.amount.focus();
    return;
  }

  if (!category || !date) {
    statusMessage.textContent = "Completa la categoría y la fecha del gasto.";
    return;
  }

  const updatedExpenses = [...expenses, { description, amount, category, date }];
  try {
    saveExpenses(updatedExpenses);
    form.reset();
    form.elements.description.focus();
  } catch (error) {
    statusMessage.textContent = `No se pudo guardar el gasto: ${error.message}`;
  }
});

renderExpenses();
