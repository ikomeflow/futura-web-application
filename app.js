const STORAGE_KEY = "futura-homes-ledger-v1";
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "XAF",
  currencyDisplay: "code",
  maximumFractionDigits: 0
});

const starterRecords = [
  { id: 1, tenant: "Amara K.", property: "Palm Residence · A2", amount: 1200, dueDate: "2026-07-05", paidDate: "2026-07-03" },
  { id: 2, tenant: "Daniel T.", property: "Lakeview Court · B1", amount: 950, dueDate: "2026-07-05", paidDate: "2026-07-05" },
  { id: 3, tenant: "Esther N.", property: "Palm Residence · A4", amount: 1200, dueDate: "2026-07-05", paidDate: "" },
  { id: 4, tenant: "Joel M.", property: "Garden Terraces · C3", amount: 800, dueDate: "2026-07-10", paidDate: "2026-07-09" },
  { id: 5, tenant: "Mireille E.", property: "Lakeview Court · B4", amount: 950, dueDate: "2026-07-10", paidDate: "" },
  { id: 6, tenant: "Patrick S.", property: "Garden Terraces · C1", amount: 800, dueDate: "2026-07-15", paidDate: "2026-07-14" }
];

let records = loadRecords();
const paymentTable = document.querySelector("#paymentTable");
const summaryCards = document.querySelector("#summaryCards");
const dialog = document.querySelector("#paymentDialog");
const form = document.querySelector("#paymentForm");
const searchInput = document.querySelector("#searchInput");

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || starterRecords;
  } catch {
    return starterRecords;
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getStatus(record) {
  if (record.paidDate) return "paid";
  return new Date(`${record.dueDate}T23:59:59`) < new Date() ? "overdue" : "due";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function render() {
  const paid = records.filter(record => record.paidDate);
  const outstanding = records.filter(record => !record.paidDate);
  const totalRent = records.reduce((sum, record) => sum + record.amount, 0);
  const collected = paid.reduce((sum, record) => sum + record.amount, 0);
  const outstandingTotal = totalRent - collected;
  const properties = new Set(records.map(record => record.property.split(" · ")[0])).size;
  const rate = totalRent ? Math.round((collected / totalRent) * 100) : 0;

  summaryCards.innerHTML = [
    ["Properties", properties, `${records.length} occupied units`],
    ["Monthly rent", currency.format(totalRent), "Expected this month"],
    ["Collected", currency.format(collected), `${paid.length} payments received`],
    ["Outstanding", currency.format(outstandingTotal), `${outstanding.length} payments pending`]
  ].map(([label, value, detail]) => `
    <article class="summary-card">
      <span class="label">${label}</span>
      <div class="value">${value}</div>
      <span class="detail">${detail}</span>
    </article>`).join("");

  document.querySelector("#collectionRate").textContent = `${rate}% collected`;
  document.querySelector("#collectionProgress").style.width = `${rate}%`;
  document.querySelector("#collectedAmount").textContent = `${currency.format(collected)} received`;
  document.querySelector("#outstandingAmount").textContent = `${currency.format(outstandingTotal)} remaining`;

  document.querySelector("#overdueList").innerHTML = outstanding.length
    ? outstanding.slice(0, 3).map(record => `
      <div class="overdue-item">
        <div><strong>${record.tenant}</strong><span>${record.property}</span></div>
        <div class="amount">${currency.format(record.amount)}<span>Due ${formatDate(record.dueDate)}</span></div>
      </div>`).join("")
    : '<p class="empty">Everything is paid. Nice work.</p>';

  renderTable(searchInput.value);
}

function renderTable(query = "") {
  const normalized = query.trim().toLowerCase();
  const filtered = records.filter(record =>
    `${record.tenant} ${record.property}`.toLowerCase().includes(normalized)
  );
  paymentTable.innerHTML = filtered.map(record => {
    const status = getStatus(record);
    return `<tr>
      <td><strong>${record.tenant}</strong><small>Tenant</small></td>
      <td>${record.property}</td>
      <td>${currency.format(record.amount)}</td>
      <td>${formatDate(record.dueDate)}</td>
      <td>${formatDate(record.paidDate)}</td>
      <td><span class="status ${status}">${status}</span></td>
    </tr>`;
  }).join("") || '<tr><td colspan="6" class="empty">No matching records found.</td></tr>';
}

document.querySelector("#addPaymentButton").addEventListener("click", () => dialog.showModal());
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
searchInput.addEventListener("input", event => renderTable(event.target.value));
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
form.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(form);
  records.unshift({
    id: Date.now(),
    tenant: data.get("tenant").trim(),
    property: data.get("property").trim(),
    amount: Number(data.get("amount")),
    dueDate: data.get("dueDate"),
    paidDate: data.get("paidDate")
  });
  saveRecords();
  form.reset();
  dialog.close();
  render();
});

render();
