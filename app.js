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

let db = null;
let currentUser = null;
let currentProfile = null;
let customerProfiles = [];
let records = [];
let recoveryMode = false;

const authView = document.querySelector("#authView");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const recoveryForm = document.querySelector("#recoveryForm");
const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
const authTabs = document.querySelector("#authTabs");
const showLoginButton = document.querySelector("#showLoginButton");
const showSignupButton = document.querySelector("#showSignupButton");
const authMessage = document.querySelector("#authMessage");
const setupNotice = document.querySelector("#setupNotice");
const summaryCards = document.querySelector("#summaryCards");
const dialog = document.querySelector("#paymentDialog");
const form = document.querySelector("#paymentForm");
const profileDialog = document.querySelector("#profileDialog");
const profileForm = document.querySelector("#profileForm");
const customerSelect = document.querySelector("#customerSelect");
const propertyGrid = document.querySelector("#propertyGrid");
const customerView = document.querySelector("#customerView");
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function setAuthMessage(message = "", type = "") {
  authMessage.textContent = message;
  authMessage.className = `auth-message${type ? ` ${type}` : ""}`;
}

function setAuthMode(mode, clearMessage = true) {
  const signingUp = mode === "signup";
  loginForm.hidden = signingUp;
  signupForm.hidden = !signingUp;
  recoveryForm.hidden = true;
  authTabs.hidden = false;
  forgotPasswordButton.hidden = signingUp;
  showLoginButton.classList.toggle("active", !signingUp);
  showLoginButton.setAttribute("aria-selected", String(!signingUp));
  showSignupButton.classList.toggle("active", signingUp);
  showSignupButton.setAttribute("aria-selected", String(signingUp));
  document.querySelector("#authTitle").textContent = signingUp ? "Create your account" : "Welcome back";
  document.querySelector("#authIntro").textContent = signingUp
    ? "Join the secure Futura Group customer portal."
    : "Sign in to view your Futura Group account.";
  if (clearMessage) setAuthMessage("");
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

function mapRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    tenant: row.tenant_name,
    property: row.property,
    amount: Number(row.amount),
    dueDate: row.due_date,
    paidDate: row.paid_date || ""
  };
}

function showAuth() {
  authView.hidden = false;
  appShell.hidden = true;
  document.body.classList.remove("customer-mode");
}

function showApp(role) {
  authView.hidden = true;
  appShell.hidden = false;
  const isCustomer = role !== "admin";
  appShell.classList.toggle("customer-mode", isCustomer);
  document.body.classList.toggle("customer-mode", isCustomer);
}

function setAccountDetails() {
  document.querySelector("#accountRole").textContent = currentProfile.role;
  document.querySelector("#accountName").textContent = currentProfile.full_name || "Futura user";
  document.querySelector("#accountEmail").textContent = currentProfile.email || currentUser.email || "";
}

async function loadProfile() {
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name, email, phone, role")
    .eq("id", currentUser.id)
    .single();
  if (error) throw error;
  currentProfile = data;

  const metadata = currentUser.user_metadata || {};
  const profileUpdates = {};
  if (!currentProfile.full_name && metadata.full_name) profileUpdates.full_name = metadata.full_name;
  if (!currentProfile.phone && metadata.phone) profileUpdates.phone = metadata.phone;
  if (Object.keys(profileUpdates).length) {
    const { error: updateError } = await db
      .from("profiles")
      .update(profileUpdates)
      .eq("id", currentUser.id);
    if (!updateError) currentProfile = { ...currentProfile, ...profileUpdates };
  }
}

async function loadSecureData() {
  if (currentProfile.role === "admin") {
    const [recordsResult, profilesResult] = await Promise.all([
      db.from("rent_records").select("*").order("due_date", { ascending: false }),
      db.from("profiles").select("id, full_name, email, phone, role").order("full_name")
    ]);
    if (recordsResult.error) throw recordsResult.error;
    if (profilesResult.error) throw profilesResult.error;
    records = (recordsResult.data || []).map(mapRecord);
    customerProfiles = (profilesResult.data || []).filter(profile => profile.role === "customer");
    populateCustomerSelect();
    renderAdmin();
  } else {
    const { data, error } = await db
      .from("rent_records")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("due_date", { ascending: false });
    if (error) throw error;
    records = (data || []).map(mapRecord);
    customerProfiles = [];
    renderCustomer();
  }
}

async function handleSession(session) {
  if (recoveryMode) return;
  if (!session?.user) {
    currentUser = null;
    currentProfile = null;
    records = [];
    showAuth();
    return;
  }

  currentUser = session.user;
  setAuthMessage("Loading your secure account…");
  try {
    await loadProfile();
    await loadSecureData();
    setAccountDetails();
    showApp(currentProfile.role);
    if (currentProfile.role === "admin") {
      showView(currentViewFromUrl());
    } else {
      showView("customer");
    }
    setAuthMessage("");
  } catch (error) {
    showAuth();
    setAuthMessage(error.message || "Your account could not be loaded.", "error");
  }
}

function populateCustomerSelect() {
  customerSelect.innerHTML = [
    '<option value="">Select a customer</option>',
    ...customerProfiles.map(profile =>
      `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.full_name || profile.email)} · ${escapeHtml(profile.email)}</option>`
    )
  ].join("");
}

function renderAdmin() {
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
      <span class="label">${escapeHtml(label)}</span>
      <div class="value">${escapeHtml(value)}</div>
      <span class="detail">${escapeHtml(detail)}</span>
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
        <div><strong>${escapeHtml(record.tenant)}</strong><span>${escapeHtml(record.property)}</span></div>
        <div class="amount">${escapeHtml(currency.format(record.amount))}<span>Due ${escapeHtml(formatDate(record.dueDate))}</span></div>
      </div>`).join("")
    : '<p class="empty">Everything is paid. Nice work.</p>';

  renderProperties();
  renderTenants(tenantSearch.value);
  renderPayments(paymentSearch.value, paymentStatusFilter.value);
}

function renderProperties() {
  const knownNames = new Set(propertyPortfolio.map(property => property.name));
  const dynamicProperties = records
    .map(buildingName)
    .filter(name => !knownNames.has(name))
    .map(name => ({ name, type: "Property" }));

  propertyGrid.innerHTML = [...propertyPortfolio, ...dynamicProperties].map(property => {
    const tenants = records.filter(record => buildingName(record) === property.name);
    const expected = tenants.reduce((sum, record) => sum + record.amount, 0);
    const collected = tenants.filter(record => record.paidDate)
      .reduce((sum, record) => sum + record.amount, 0);
    const outstanding = expected - collected;
    const ledgerRows = tenants.map(record => {
      const unit = record.property.split(" · ")[1] || "Unit";
      const status = getStatus(record);
      return `<tr>
        <td><strong>${escapeHtml(record.tenant)}</strong></td>
        <td>${escapeHtml(unit)}</td>
        <td>${escapeHtml(currency.format(record.amount))}</td>
        <td>${escapeHtml(formatDate(record.dueDate))}</td>
        <td>${escapeHtml(formatDate(record.paidDate))}</td>
        <td><span class="status ${status}">${status}</span></td>
      </tr>`;
    }).join("") || '<tr><td colspan="6" class="empty">No payment activity yet.</td></tr>';

    return `<article class="property-card" tabindex="0">
      <div class="property-card-header">
        <div><p class="eyebrow">${escapeHtml(property.type)}</p><h2>${escapeHtml(property.name)}</h2></div>
        <div class="property-price">${escapeHtml(currency.format(expected))}<span>monthly building rent</span></div>
      </div>
      <div class="property-card-body">
        <div class="property-stats">
          <div class="property-stat"><strong>${tenants.length}</strong><span>Occupied units</span></div>
          <div class="property-stat"><strong>${escapeHtml(currency.format(collected))}</strong><span>Collected</span></div>
          <div class="property-stat"><strong>${escapeHtml(currency.format(outstanding))}</strong><span>Outstanding</span></div>
        </div>
        <h3>Payment ledger</h3>
        <div class="property-ledger-wrap">
          <table class="property-ledger">
            <thead><tr><th>Tenant</th><th>Unit</th><th>Rent</th><th>Due date</th><th>Paid on</th><th>Status</th></tr></thead>
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

  document.querySelector("#tenantSummary").innerHTML = [
    ["Customer accounts", customerProfiles.length],
    ["Rent up to date", paidCount],
    ["Need attention", records.length - paidCount]
  ].map(([label, value]) => `
    <article class="mini-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>
  `).join("");

  document.querySelector("#tenantTable").innerHTML = filtered.map(record => {
    const parts = record.property.split(" · ");
    const profile = customerProfiles.find(item => item.id === record.userId);
    const status = getStatus(record);
    return `<tr>
      <td><strong>${escapeHtml(record.tenant)}</strong><small>${escapeHtml(profile?.email || "")}</small></td>
      <td>${escapeHtml(parts[0])}</td>
      <td>${escapeHtml(parts[1] || "Unit")}</td>
      <td>${escapeHtml(currency.format(record.amount))}</td>
      <td><span class="status ${status}">${status}</span></td>
    </tr>`;
  }).join("") || '<tr><td colspan="5" class="empty">No matching customers found.</td></tr>';
}

function renderPayments(query = "", statusFilter = "all") {
  const normalized = query.trim().toLowerCase();
  const filtered = records.filter(record => {
    const matchesSearch = `${record.tenant} ${record.property}`.toLowerCase().includes(normalized);
    return matchesSearch && (statusFilter === "all" || getStatus(record) === statusFilter);
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
    <article class="mini-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>
  `).join("");

  document.querySelector("#allPaymentTable").innerHTML = filtered.map(record => {
    const status = getStatus(record);
    return `<tr>
      <td><strong>${escapeHtml(record.tenant)}</strong></td>
      <td>${escapeHtml(record.property)}</td>
      <td>${escapeHtml(currency.format(record.amount))}</td>
      <td>${escapeHtml(formatDate(record.dueDate))}</td>
      <td>${escapeHtml(formatDate(record.paidDate))}</td>
      <td><span class="status ${status}">${status}</span></td>
    </tr>`;
  }).join("") || '<tr><td colspan="6" class="empty">No matching payments found.</td></tr>';
}

function renderCustomer() {
  const paid = records.filter(record => getStatus(record) === "paid");
  const outstanding = records.filter(record => getStatus(record) !== "paid");
  const outstandingAmount = outstanding.reduce((sum, record) => sum + record.amount, 0);
  const nextPayment = [...outstanding].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const latestProperty = nextPayment?.property || records[0]?.property || "Not assigned yet";
  const statusElement = document.querySelector("#customerAccountStatus");
  document.querySelector("#customerWelcome").textContent =
    `Welcome, ${currentProfile.full_name || "customer"}`;
  document.querySelector("#customerGlanceProperty").textContent = latestProperty;

  statusElement.className = "glance-status";
  if (nextPayment) {
    const status = getStatus(nextPayment);
    statusElement.textContent = status === "overdue" ? "Payment needs attention" : "Payment coming up";
    statusElement.classList.add("attention");
    document.querySelector("#customerNextPayment").textContent =
      `${currency.format(nextPayment.amount)} · ${formatDate(nextPayment.dueDate)}`;
    document.querySelector("#customerGlanceMessage").textContent =
      "Your next rent payment is shown here so you can plan ahead.";
  } else if (records.length) {
    statusElement.textContent = "Payments up to date";
    statusElement.classList.add("good");
    document.querySelector("#customerNextPayment").textContent = "No payment due";
    document.querySelector("#customerGlanceMessage").textContent =
      "You're all caught up. Your previous payments remain available below.";
  } else {
    statusElement.textContent = "Account ready";
    document.querySelector("#customerNextPayment").textContent = "No payment added yet";
    document.querySelector("#customerGlanceMessage").textContent =
      "Welcome to Futura. Your property and payment information will appear here when it is added.";
  }

  document.querySelector("#customerSummary").innerHTML = [
    ["Payment records", records.length],
    ["Paid", paid.length],
    ["Outstanding", currency.format(outstandingAmount)]
  ].map(([label, value]) => `
    <article class="mini-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>
  `).join("");

  document.querySelector("#customerProfile").innerHTML = [
    ["Name", currentProfile.full_name || "—"],
    ["Email", currentProfile.email || currentUser.email || "—"],
    ["Phone", currentProfile.phone || "—"],
    ["Property", latestProperty]
  ].map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  ).join("");

  document.querySelector("#customerPaymentTable").innerHTML = records.map(record => {
    const status = getStatus(record);
    return `<tr>
      <td>${escapeHtml(record.property)}</td>
      <td>${escapeHtml(currency.format(record.amount))}</td>
      <td>${escapeHtml(formatDate(record.dueDate))}</td>
      <td>${escapeHtml(formatDate(record.paidDate))}</td>
      <td><span class="status ${status}">${status}</span></td>
    </tr>`;
  }).join("") || '<tr><td colspan="5" class="empty">No payment records are linked to this account yet.</td></tr>';
}

function showView(view) {
  const views = {
    customer: customerView,
    overview: overviewView,
    properties: propertiesView,
    tenants: tenantsView,
    payments: paymentsView
  };
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
  if (currentProfile?.role !== "admin") return;
  if (currentViewFromUrl() !== view) {
    window.history.pushState({ view }, "", `#${view}`);
  }
  showView(view);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openPaymentDialog() {
  if (currentProfile?.role === "admin") dialog.showModal();
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) return;
  const data = new FormData(loginForm);
  setAuthMessage("Signing in…");
  const { error } = await db.auth.signInWithPassword({
    email: data.get("email").trim(),
    password: data.get("password")
  });
  if (error) setAuthMessage("The email or password is incorrect.", "error");
});

showLoginButton.addEventListener("click", () => setAuthMode("login"));
showSignupButton.addEventListener("click", () => setAuthMode("signup"));

signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) return;
  const data = new FormData(signupForm);
  const password = data.get("password");
  if (password !== data.get("confirmPassword")) {
    setAuthMessage("The passwords do not match.", "error");
    document.querySelector("#signupConfirmPassword").focus();
    return;
  }

  const email = data.get("email").trim();
  const fullName = data.get("fullName").trim();
  const phone = data.get("phone").trim();
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  setAuthMessage("Creating your secure account…");
  const { data: signupData, error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        full_name: fullName,
        phone
      }
    }
  });

  if (error) {
    const message = error.message?.toLowerCase().includes("already")
      ? "An account with this email already exists. Please sign in or reset your password."
      : error.message;
    setAuthMessage(message || "Your account could not be created. Please try again.", "error");
    return;
  }

  signupForm.reset();
  if (signupData.session) {
    setAuthMessage("Account created. Loading your private portal…", "success");
    return;
  }
  document.querySelector("#loginEmail").value = email;
  setAuthMode("login", false);
  setAuthMessage("Account created. Check your email and select the confirmation link, then sign in.", "success");
});

forgotPasswordButton.addEventListener("click", async () => {
  if (!db) return;
  const email = document.querySelector("#loginEmail").value.trim();
  if (!email) {
    setAuthMessage("Enter your email address first.", "error");
    document.querySelector("#loginEmail").focus();
    return;
  }
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  setAuthMessage(
    error ? error.message : "Check your email for a secure password-reset link.",
    error ? "error" : "success"
  );
});

recoveryForm.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(recoveryForm);
  if (data.get("password") !== data.get("confirmPassword")) {
    setAuthMessage("The passwords do not match.", "error");
    return;
  }
  const { error } = await db.auth.updateUser({ password: data.get("password") });
  if (error) {
    setAuthMessage(error.message, "error");
    return;
  }
  recoveryForm.reset();
  recoveryMode = false;
  setAuthMode("login", false);
  setAuthMessage("Your password has been updated.", "success");
});

document.querySelector("#signOutButton").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
});

document.querySelectorAll("#addPaymentButton, #addPropertyPaymentButton, #addTenantPaymentButton, #addLedgerPaymentButton")
  .forEach(button => button.addEventListener("click", openPaymentDialog));
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
    // The visual theme still changes when browser storage is unavailable.
  }
});
window.addEventListener("popstate", () => {
  if (currentProfile?.role === "admin") showView(currentViewFromUrl());
  window.scrollTo({ top: 0 });
});
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
document.querySelector("#viewCustomerPaymentsButton").addEventListener("click", () => {
  document.querySelector(".customer-ledger").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#editCustomerProfileButton").addEventListener("click", () => {
  if (currentProfile?.role !== "customer") return;
  document.querySelector("#profileFullName").value = currentProfile.full_name || "";
  document.querySelector("#profilePhone").value = currentProfile.phone || "";
  document.querySelector("#profileEmail").value = currentProfile.email || currentUser.email || "";
  const message = document.querySelector("#profileMessage");
  message.textContent = "";
  message.className = "auth-message";
  profileDialog.showModal();
});
document.querySelector("#closeProfileDialog").addEventListener("click", () => profileDialog.close());
profileDialog.addEventListener("click", event => {
  if (event.target === profileDialog) profileDialog.close();
});
profileForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!db || currentProfile?.role !== "customer") return;
  const data = new FormData(profileForm);
  const profileMessage = document.querySelector("#profileMessage");
  profileMessage.textContent = "Saving your details…";
  profileMessage.className = "auth-message";
  const updates = {
    full_name: data.get("fullName").trim(),
    phone: data.get("phone").trim()
  };
  const { error } = await db.from("profiles").update(updates).eq("id", currentUser.id);
  if (error) {
    profileMessage.textContent = error.message || "Your details could not be saved.";
    profileMessage.className = "auth-message error";
    return;
  }
  currentProfile = { ...currentProfile, ...updates };
  setAccountDetails();
  renderCustomer();
  profileMessage.textContent = "Your details have been saved.";
  profileMessage.className = "auth-message success";
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!db || currentProfile?.role !== "admin") return;
  const data = new FormData(form);
  const profile = customerProfiles.find(item => item.id === data.get("userId"));
  if (!profile) {
    setAuthMessage("Select a valid customer.", "error");
    return;
  }

  const { error } = await db.from("rent_records").insert({
    user_id: profile.id,
    tenant_name: profile.full_name || profile.email,
    property: data.get("property").trim(),
    amount: Number(data.get("amount")),
    due_date: data.get("dueDate"),
    paid_date: data.get("paidDate") || null
  });
  if (error) {
    window.alert(error.message);
    return;
  }
  form.reset();
  dialog.close();
  await loadSecureData();
});

async function initialize() {
  applyTheme(loadTheme());
  showAuth();
  const config = window.FUTURA_CONFIG || {};
  const configured = config.supabaseUrl?.startsWith("https://")
    && !config.supabaseUrl.includes("YOUR_")
    && config.supabasePublishableKey
    && !config.supabasePublishableKey.includes("YOUR_")
    && window.supabase?.createClient;

  if (!configured) {
    setupNotice.hidden = false;
    loginForm.querySelectorAll("input, button").forEach(element => element.disabled = true);
    signupForm.querySelectorAll("input, button").forEach(element => element.disabled = true);
    showLoginButton.disabled = true;
    showSignupButton.disabled = true;
    forgotPasswordButton.disabled = true;
    setAuthMessage("The secure database connection has not been configured yet.", "error");
    return;
  }

  db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  db.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryMode = true;
      showAuth();
      authTabs.hidden = true;
      loginForm.hidden = true;
      signupForm.hidden = true;
      recoveryForm.hidden = false;
      forgotPasswordButton.hidden = true;
      setAuthMessage("Choose a new password for your account.");
      return;
    }
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      window.setTimeout(() => handleSession(session), 0);
    }
  });

  const { data, error } = await db.auth.getSession();
  if (error) {
    setAuthMessage(error.message, "error");
    return;
  }
  await handleSession(data.session);
}

initialize();
