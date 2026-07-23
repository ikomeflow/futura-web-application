const STORAGE_KEY = "futura-group-ledger-v2";
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "XAF",
  currencyDisplay: "code",
  maximumFractionDigits: 0
});

const propertyPortfolio = [
  { name: "Executive Hotel", type: "Hotel property" },
  { name: "Bakweri Town House", type: "Town house" },
  { name: "Orange Entrance Likomba Tiko", type: "Residential building" },
  { name: "Bimbia Bonabile", type: "Residential building" }
];

const starterRecords = [
  { id: 1, tenant: "Amara K.", property: "Executive Hotel · Suite 01", amount: 225000, dueDate: "2026-07-05", paidDate: "2026-07-03" },
  { id: 2, tenant: "Daniel T.", property: "Executive Hotel · Suite 02", amount: 225000, dueDate: "2026-07-05", paidDate: "" },
  { id: 3, tenant: "Esther N.", property: "Bakweri Town House · Unit A", amount: 150000, dueDate: "2026-07-05", paidDate: "2026-07-05" },
  { id: 4, tenant: "Joel M.", property: "Bakweri Town House · Unit B", amount: 150000, dueDate: "2026-07-10", paidDate: "2026-07-09" },
  { id: 5, tenant: "Mireille E.", property: "Orange Entrance Likomba Tiko · Unit 01", amount: 100000, dueDate: "2026-07-10", paidDate: "" },
  { id: 6, tenant: "Patrick S.", property: "Orange Entrance Likomba Tiko · Unit 02", amount: 100000, dueDate: "2026-07-15", paidDate: "2026-07-14" },
  { id: 7, tenant: "Carine B.", property: "Bimbia Bonabile · Unit 01", amount: 120000, dueDate: "2026-07-10", paidDate: "2026-07-08" },
  { id: 8, tenant: "Samuel L.", property: "Bimbia Bonabile · Unit 02", amount: 120000, dueDate: "2026-07-15", paidDate: "" }
];

let records = loadRecords();
const paymentTable = document.querySelector("#paymentTable");
const summaryCards = document.querySelector("#summaryCards");
const dialog = document.querySelector("#paymentDialog");
const form = document.querySelector("#paymentForm");
const searchInput = document.querySelector("#searchInput");
const propertyGrid = document.querySelector("#propertyGrid");
const overviewView = document.querySelector("#overviewView");
const propertiesView = document.querySelector("#propertiesView");
const overviewNav = document.querySelector("#overviewNav");
const propertiesNav = document.querySelector("#propertiesNav");

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

function buildingName(record) {
  return record.property.split(" · ")[0];
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
  const rate = totalRent ? Math.round((collected / totalRent) * 100) : 0;

  summaryCards.innerHTML = [
    ["Properties", propertyPortfolio.length, `${records.length} occupied units`],
    ["Monthly rent", currency.format(totalRent), "Expected this month"],
    ["Collected", currency.format(collected), `${paid.length} payments received`],
    ["Outstanding", currency.format(outstandingTotal), `${outstanding.length} payments pending`]
  ].map(([label, value, detail], index) => `
    <${index === 0 ? "button" : "article"}
      class="summary-card${index === 0 ? " summary-card-link" : ""}"
      ${index === 0 ? 'type="button" aria-label="Open properties"' : ""}>
      <span class="label">${label}</span>
      <div class="value">${value}</div>
      <span class="detail">${detail}</span>
      ${index === 0 ? '<span class="card-action">View houses →</span>' : ""}
    </${index === 0 ? "button" : "article"}>`).join("");

  document.querySelector(".summary-card-link").addEventListener("click", () => showView("properties"));

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
  renderProperties();
}

function renderProperties() {
  propertyGrid.innerHTML = propertyPortfolio.map(property => {
    const tenants = records.filter(record => buildingName(record) === property.name);
    const expected = tenants.reduce((sum, record) => sum + record.amount, 0);
    const collected = tenants.filter(record => record.paidDate)
      .reduce((sum, record) => sum + record.amount, 0);
    const outstanding = expected - collected;
    const activity = tenants.map(record => {
      const unit = record.property.split(" · ")[1] || "Unit";
      const status = getStatus(record);
      return `<div class="tenant-row">
        <div><strong>${record.tenant}</strong><small>${unit} · ${currency.format(record.amount)}</small></div>
        <span class="status ${status}">${status}</span>
      </div>`;
    }).join("") || '<p class="empty">No tenant activity yet.</p>';

    return `<article class="property-card" tabindex="0">
      <div class="property-card-header">
        <div><p class="eyebrow">${property.type}</p><h2>${property.name}</h2></div>
        <div class="property-price">${currency.format(expected)}<span>monthly building rent</span></div>
      </div>
      <div class="property-card-body">
        <div class="property-stats">
          <div class="property-stat"><strong>${tenants.length}</strong><span>Occupied units</span></div>
          <div class="property-stat"><strong>${currency.format(collected)}</strong><span>Collected</span></div>
          <div class="property-stat"><strong>${currency.format(outstanding)}</strong><span>Outstanding</span></div>
        </div>
        <h3>Tenant activity</h3>
        <div class="tenant-activity">${activity}</div>
      </div>
    </article>`;
  }).join("");
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

function showView(view) {
  const showProperties = view === "properties";
  overviewView.hidden = showProperties;
  propertiesView.hidden = !showProperties;
  overviewNav.classList.toggle("active", !showProperties);
  propertiesNav.classList.toggle("active", showProperties);
}

document.querySelector("#addPaymentButton").addEventListener("click", () => dialog.showModal());
document.querySelector("#addPropertyPaymentButton").addEventListener("click", () => dialog.showModal());
overviewNav.addEventListener("click", () => showView("overview"));
propertiesNav.addEventListener("click", () => showView("properties"));
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
