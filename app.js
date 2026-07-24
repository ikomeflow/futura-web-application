const STORAGE_KEY = "futura-group-ledger-v2";
const THEME_KEY = "futura-group-theme";
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
const summaryCards = document.querySelector("#summaryCards");
const dialog = document.querySelector("#paymentDialog");
const form = document.querySelector("#paymentForm");
const propertyGrid = document.querySelector("#propertyGrid");
const overviewView = document.querySelector("#overviewView");
const propertiesView = document.querySelector("#propertiesView");
const tenantsView = document.querySelector("#tenantsView");
const paymentsView = document.querySelector("#paymentsView");
const overviewNav = document.querySelector("#overviewNav");
const propertiesNav = document.querySelector("#propertiesNav");
const tenantsNav = document.querySelector("#tenantsNav");
const paymentsNav = document.querySelector("#paymentsNav");
const tenantSearch = document.querySelector("#tenantSearch");
const paymentSearch = document.querySelector("#paymentSearch");
const paymentStatusFilter = document.querySelector("#paymentStatusFilter");
const themeToggle = document.querySelector("#themeToggle");
const themeIcon = document.querySelector("#themeIcon");
const themeLabel = document.querySelector("#themeLabel");
const themeHint = document.querySelector("#themeHint");

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Switch to day mode" : "Switch to night mode");
  themeIcon.textContent = isDark ? "☀" : "☾";
  themeLabel.textContent = isDark ? "Day mode" : "Night mode";
  themeHint.textContent = isDark ? "Switch to light" : "Switch to dark";
}

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

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

  document.querySelector(".summary-card-link").addEventListener("click", () => navigateTo("properties"));

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

  renderProperties();
  renderTenants(tenantSearch.value);
  renderPayments(paymentSearch.value, paymentStatusFilter.value);
}

function renderProperties() {
  propertyGrid.innerHTML = propertyPortfolio.map(property => {
    const tenants = records.filter(record => buildingName(record) === property.name);
    const expected = tenants.reduce((sum, record) => sum + record.amount, 0);
    const collected = tenants.filter(record => record.paidDate)
      .reduce((sum, record) => sum + record.amount, 0);
    const outstanding = expected - collected;
    const ledgerRows = tenants.map(record => {
      const unit = record.property.split(" · ")[1] || "Unit";
      const status = getStatus(record);
      return `<tr>
        <td><strong>${record.tenant}</strong></td>
        <td>${unit}</td>
        <td>${currency.format(record.amount)}</td>
        <td>${formatDate(record.dueDate)}</td>
        <td>${formatDate(record.paidDate)}</td>
        <td><span class="status ${status}">${status}</span></td>
      </tr>`;
    }).join("") || '<tr><td colspan="6" class="empty">No payment activity yet.</td></tr>';

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
        <h3>Payment ledger</h3>
        <div class="property-ledger-wrap">
          <table class="property-ledger">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Rent</th>
                <th>Due date</th>
                <th>Paid on</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${ledgerRows}</tbody>
          </table>
        </div>
      </div>
    </article>`;
  }).join("");
}

function renderTenants(query = "") {
  const normalized = query.trim().toLowerCase();
  const filtered = records.filter(record =>
    `${record.tenant} ${record.property}`.toLowerCase().includes(normalized)
  );
  const paidCount = records.filter(record => getStatus(record) === "paid").length;
  const pendingCount = records.length - paidCount;

  document.querySelector("#tenantSummary").innerHTML = [
    ["Active tenants", records.length],
    ["Rent up to date", paidCount],
    ["Need attention", pendingCount]
  ].map(([label, value]) => `
    <article class="mini-summary-card"><span>${label}</span><strong>${value}</strong></article>
  `).join("");

  document.querySelector("#tenantTable").innerHTML = filtered.map(record => {
    const parts = record.property.split(" · ");
    const status = getStatus(record);
    return `<tr>
      <td><strong>${record.tenant}</strong></td>
      <td>${parts[0]}</td>
      <td>${parts[1] || "Unit"}</td>
      <td>${currency.format(record.amount)}</td>
      <td><span class="status ${status}">${status}</span></td>
    </tr>`;
  }).join("") || '<tr><td colspan="5" class="empty">No matching tenants found.</td></tr>';
}

function renderPayments(query = "", statusFilter = "all") {
  const normalized = query.trim().toLowerCase();
  const filtered = records.filter(record => {
    const matchesSearch = `${record.tenant} ${record.property}`.toLowerCase().includes(normalized);
    const matchesStatus = statusFilter === "all" || getStatus(record) === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const collected = records.filter(record => record.paidDate)
    .reduce((sum, record) => sum + record.amount, 0);
  const outstanding = records.filter(record => !record.paidDate)
    .reduce((sum, record) => sum + record.amount, 0);

  document.querySelector("#paymentSummary").innerHTML = [
    ["Transactions", records.length],
    ["Collected", currency.format(collected)],
    ["Outstanding", currency.format(outstanding)]
  ].map(([label, value]) => `
    <article class="mini-summary-card"><span>${label}</span><strong>${value}</strong></article>
  `).join("");

  document.querySelector("#allPaymentTable").innerHTML = filtered.map(record => {
    const status = getStatus(record);
    return `<tr>
      <td><strong>${record.tenant}</strong></td>
      <td>${record.property}</td>
      <td>${currency.format(record.amount)}</td>
      <td>${formatDate(record.dueDate)}</td>
      <td>${formatDate(record.paidDate)}</td>
      <td><span class="status ${status}">${status}</span></td>
    </tr>`;
  }).join("") || '<tr><td colspan="6" class="empty">No matching payments found.</td></tr>';
}

function showView(view) {
  const views = { overview: overviewView, properties: propertiesView, tenants: tenantsView, payments: paymentsView };
  const navItems = { overview: overviewNav, properties: propertiesNav, tenants: tenantsNav, payments: paymentsNav };
  Object.entries(views).forEach(([name, element]) => {
    element.hidden = name !== view;
  });
  Object.entries(navItems).forEach(([name, element]) => {
    element.classList.toggle("active", name === view);
  });
}

function currentViewFromUrl() {
  const requested = window.location.hash.replace("#", "");
  return ["overview", "properties", "tenants", "payments"].includes(requested)
    ? requested
    : "overview";
}

function navigateTo(view) {
  if (currentViewFromUrl() === view) {
    showView(view);
    return;
  }
  window.history.pushState({ view }, "", `#${view}`);
  showView(view);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector("#addPaymentButton").addEventListener("click", () => dialog.showModal());
document.querySelector("#addPropertyPaymentButton").addEventListener("click", () => dialog.showModal());
document.querySelector("#addTenantPaymentButton").addEventListener("click", () => dialog.showModal());
document.querySelector("#addLedgerPaymentButton").addEventListener("click", () => dialog.showModal());
overviewNav.addEventListener("click", () => navigateTo("overview"));
propertiesNav.addEventListener("click", () => navigateTo("properties"));
tenantsNav.addEventListener("click", () => navigateTo("tenants"));
paymentsNav.addEventListener("click", () => navigateTo("payments"));
document.querySelector("#openTenantsButton").addEventListener("click", () => navigateTo("tenants"));
document.querySelector("#openPaymentsButton").addEventListener("click", () => navigateTo("payments"));
tenantSearch.addEventListener("input", event => renderTenants(event.target.value));
paymentSearch.addEventListener("input", event => renderPayments(event.target.value, paymentStatusFilter.value));
paymentStatusFilter.addEventListener("change", event => renderPayments(paymentSearch.value, event.target.value));
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    // Theme still changes for this visit when browser storage is unavailable.
  }
});
window.addEventListener("popstate", () => {
  showView(currentViewFromUrl());
  window.scrollTo({ top: 0 });
});
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
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

applyTheme(loadTheme());
render();
window.history.replaceState({ view: currentViewFromUrl() }, "", window.location.href);
showView(currentViewFromUrl());
