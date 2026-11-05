
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// -------------------- GLOBAL DATA --------------------

let currentUser = null;
let businessId = null;
let data = {
  inventory: [],
  hygiene: [],
  issues: [],
  waste: []
};

const $ = id => document.getElementById(id);

const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
};

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const formatDate = value => {
  if (!value) return "Not specified";
  return new Date(value + "T00:00:00").toLocaleDateString("en-IN");
};

const daysUntil = date => {
  if (!date) return Infinity;
  const start = new Date(today() + "T00:00:00");
  const end = new Date(date + "T00:00:00");
  return Math.round((end - start) / 86400000);
};

const expiryStatus = date => {
  const days = daysUntil(date);

  if (days < 0) return "Expired";
  if (days <= 3) return "Expiring soon";
  return "In date";
};

const businessCollection = name =>
  collection(db, "businesses", businessId, name);

const showToast = message => {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 2500);
};

// -------------------- AUTHENTICATION --------------------

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    currentUser = user;

    const profileSnap = await getDoc(doc(db, "users", user.uid));

    if (!profileSnap.exists()) {
      throw new Error("Your user profile could not be found.");
    }

    const profile = profileSnap.data();
    businessId = profile.businessId;

    if (!businessId) {
      throw new Error("Your business workspace is missing.");
    }

    const memberSnap = await getDoc(
      doc(db, "businesses", businessId, "members", user.uid)
    );

    if (!memberSnap.exists() || memberSnap.data().status !== "active") {
      throw new Error("Your business membership is inactive.");
    }

    const businessSnap = await getDoc(
      doc(db, "businesses", businessId)
    );

    if (!businessSnap.exists()) {
      throw new Error("Business workspace not found.");
    }

    const business = businessSnap.data();

    $("profileName").textContent =
      profile.name || user.displayName || "Owner";

    $("profileBusiness").textContent =
      business.businessName || "My Business";

    $("profileAvatar").textContent =
      (profile.name || user.displayName || "O").charAt(0).toUpperCase();

    $("todayLabel").textContent =
      new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short"
      });

    await loadAllData();

    renderAll();

  } catch (error) {
    console.error("Dashboard loading error:", error);
    showToast(error.message || "Unable to load dashboard.");
  }
});

// -------------------- FIRESTORE DATA --------------------

async function loadCollection(name) {
  const snapshot = await getDocs(businessCollection(name));

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadAllData() {
  data.inventory = await loadCollection("inventory");
  data.hygiene = await loadCollection("hygiene");
  data.issues = await loadCollection("issues");
  data.waste = await loadCollection("waste");

  // Create the default hygiene checklist only for a new workspace.
  if (data.hygiene.length === 0) {
    const defaultTasks = [
      "Clean food preparation surfaces",
      "Check refrigerator temperature",
      "Check food storage labels",
      "Clean utensils and equipment",
      "Check handwashing station",
      "Inspect waste disposal area"
    ];

    for (const title of defaultTasks) {
      await addDoc(businessCollection("hygiene"), {
        title,
        done: false,
        createdAt: serverTimestamp()
      });
    }

    data.hygiene = await loadCollection("hygiene");
  }
}

async function addRecord(name, record) {
  const result = await addDoc(businessCollection(name), {
    ...record,
    createdAt: serverTimestamp()
  });

  return result.id;
}

async function updateRecord(name, id, changes) {
  await updateDoc(doc(db, "businesses", businessId, name, id), {
    ...changes,
    updatedAt: serverTimestamp()
  });
}

async function removeRecord(name, id) {
  await deleteDoc(doc(db, "businesses", businessId, name, id));
}

// -------------------- NAVIGATION --------------------

function setView(view) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  const selectedPage = $(view + "View");

  if (selectedPage) {
    selectedPage.classList.remove("hidden");
  }

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === view
    );
  });

  $("breadcrumbCurrent").textContent =
    view.charAt(0).toUpperCase() + view.slice(1);

  $("sidebar").classList.remove("open");
}

function renderAll() {
  renderDashboard();
  renderInventory();
  renderHygiene();
  renderIssues();
  renderWaste();

  $("inventoryNavCount").textContent = data.inventory.length;

  $("issueNavCount").textContent =
    data.issues.filter(item => item.status !== "Resolved").length;
}

// -------------------- DASHBOARD --------------------

function renderDashboard() {
  const attentionItems = data.inventory.filter(item =>
    daysUntil(item.expiry) <= 3
  );

  const pendingTasks = data.hygiene.filter(item => !item.done);

  const openIssues = data.issues.filter(item =>
    item.status !== "Resolved"
  );

  $("statInventory").textContent = data.inventory.length;
  $("statExpiry").textContent = attentionItems.length;
  $("statHygiene").textContent = pendingTasks.length;
  $("statIssues").textContent = openIssues.length;

  $("expiryPreview").innerHTML = attentionItems.length
    ? attentionItems.slice(0, 5).map(item => `
        <div class="table-row">
          <div>
            <strong>${escapeHTML(item.name)}</strong>
            <small>${escapeHTML(item.expiry || "No expiry date")}</small>
          </div>
          <span class="status">${escapeHTML(expiryStatus(item.expiry))}</span>
        </div>
      `).join("")
    : `<p class="empty-state">No items need expiry attention.</p>`;

  $("hygienePreview").innerHTML = pendingTasks.length
    ? pendingTasks.slice(0, 5).map(item => `
        <div class="task-row">
          <span>${escapeHTML(item.title)}</span>
        </div>
      `).join("")
    : `<p class="empty-state">All hygiene tasks completed!</p>`;

  $("issuePreview").innerHTML = openIssues.length
    ? openIssues.slice(0, 4).map(item => `
        <div class="issue-row">
          <strong>${escapeHTML(item.title)}</strong>
          <small>${escapeHTML(item.status || "Reported")}</small>
        </div>
      `).join("")
    : `<p class="empty-state">No open concerns recorded.</p>`;

  const totalWaste = data.waste.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  $("wasteTotal").textContent = totalWaste.toFixed(2) + " kg";
}

// -------------------- INVENTORY --------------------

function renderInventory() {
  const search = ($("inventorySearch").value || "").toLowerCase();
  const filter = $("inventoryFilter").value;

  let items = data.inventory.filter(item =>
    (item.name || "").toLowerCase().includes(search)
  );

  if (filter === "attention") {
    items = items.filter(item => daysUntil(item.expiry) <= 3);
  }

  if (filter === "good") {
    items = items.filter(item => daysUntil(item.expiry) > 3);
  }

  $("inventoryTable").innerHTML = items.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Food item</th>
            <th>Category</th>
            <th>Quantity</th>
            <th>Expiry</th>
            <th>Location</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${escapeHTML(item.name)}</td>
              <td>${escapeHTML(item.category)}</td>
              <td>${escapeHTML(item.quantity)} ${escapeHTML(item.unit)}</td>
              <td>
                ${escapeHTML(formatDate(item.expiry))}
                <br>
                <small>${escapeHTML(expiryStatus(item.expiry))}</small>
              </td>
              <td>${escapeHTML(item.location)}</td>
              <td>
                <button class="delete-btn" data-delete="${escapeHTML(item.id)}">
                  Delete
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
    : `<p class="empty-state">No inventory records found. Add your first item!</p>`;
}

// -------------------- HYGIENE --------------------

function renderHygiene() {
  const completed = data.hygiene.filter(item => item.done).length;
  const total = data.hygiene.length;

  const percentage = total
    ? Math.round(completed / total * 100)
    : 0;

  $("hygieneProgressText").textContent = percentage + "% complete";
  $("hygieneProgressBar").style.width = percentage + "%";

  $("hygieneList").innerHTML = data.hygiene.length
    ? data.hygiene.map(item => `
        <div class="hygiene-card">
          <label>
            <input
              type="checkbox"
              data-hygiene="${escapeHTML(item.id)}"
              ${item.done ? "checked" : ""}
            >
            <span>${escapeHTML(item.title)}</span>
          </label>
          <small>${item.done ? "Completed" : "Pending"}</small>
        </div>
      `).join("")
    : `<p class="empty-state">No hygiene tasks available.</p>`;
}

// -------------------- ISSUE TRACKER --------------------

function renderIssues() {
  const reported = data.issues.filter(item =>
    item.status === "Reported"
  ).length;

  const reviewing = data.issues.filter(item =>
    item.status === "Under Review"
  ).length;

  const resolved = data.issues.filter(item =>
    item.status === "Resolved"
  ).length;

  $("issueSummary").innerHTML = `
    <div class="stat-card"><strong>${reported}</strong><small>Reported</small></div>
    <div class="stat-card"><strong>${reviewing}</strong><small>Under review</small></div>
    <div class="stat-card"><strong>${resolved}</strong><small>Resolved</small></div>
  `;

  $("issuesList").innerHTML = data.issues.length
    ? data.issues.map(item => `
        <article class="issue-card">
          <div>
            <h3>${escapeHTML(item.title)}</h3>
            <p>${escapeHTML(item.description)}</p>
            <small>Corrective action: ${escapeHTML(item.action || "Not specified")}</small>
          </div>

          <label>
            Status
            <select data-issue="${escapeHTML(item.id)}">
              <option ${item.status === "Reported" ? "selected" : ""}>Reported</option>
              <option ${item.status === "Under Review" ? "selected" : ""}>Under Review</option>
              <option ${item.status === "Resolved" ? "selected" : ""}>Resolved</option>
            </select>
          </label>
        </article>
      `).join("")
    : `<p class="empty-state">No concerns reported yet.</p>`;
}

// -------------------- WASTE INSIGHTS --------------------

function renderWaste() {
  const total = data.waste.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const reasons = {};

  data.waste.forEach(item => {
    const reason = item.reason || "Other";
    reasons[reason] = (reasons[reason] || 0) + Number(item.quantity || 0);
  });

  $("wasteStats").innerHTML = `
    <div class="stat-card">
      <span>Total recorded waste</span>
      <strong>${total.toFixed(2)} kg</strong>
    </div>
    <div class="stat-card">
      <span>Total waste entries</span>
      <strong>${data.waste.length}</strong>
    </div>
  `;

  const reasonEntries = Object.entries(reasons);

  $("wasteReasons").innerHTML = reasonEntries.length
    ? reasonEntries.map(([reason, quantity]) => `
        <div class="reason-row">
          <span>${escapeHTML(reason)}</span>
          <strong>${quantity.toFixed(2)} kg</strong>
        </div>
      `).join("")
    : `<p class="empty-state">Waste reasons will appear here.</p>`;

  $("wasteLogs").innerHTML = data.waste.length
    ? [...data.waste].reverse().map(item => `
        <div class="waste-log">
          <strong>${escapeHTML(item.food)}</strong>
          <span>${escapeHTML(item.quantity)} ${escapeHTML(item.unit)}</span>
          <small>${escapeHTML(item.reason)} • ${escapeHTML(formatDate(item.date))}</small>
        </div>
      `).join("")
    : `<p class="empty-state">No waste records yet.</p>`;
}

// -------------------- MODAL FORMS --------------------

function showModal(type) {
  const fields = $("formFields");

  const forms = {
    stock: {
      title: "Add inventory",
      fields: `
        <label>Food item<input name="name" required></label>
        <label>Category
          <select name="category" required>
            <option value="">Select category</option>
            <option>Dairy</option>
            <option>Vegetables</option>
            <option>Fruits</option>
            <option>Grains</option>
            <option>Bakery</option>
            <option>Other</option>
          </select>
        </label>
        <label>Quantity<input name="quantity" type="number" min="0.01" step="any" required></label>
        <label>Unit
          <select name="unit">
            <option>kg</option>
            <option>litres</option>
            <option>packets</option>
            <option>pieces</option>
          </select>
        </label>
        <label>Expiry date<input name="expiry" type="date"></label>
        <label>Storage location<input name="location" placeholder="e.g. Refrigerator"></label>
      `
    },

    issue: {
      title: "Report a concern",
      fields: `
        <label>Concern title<input name="title" required></label>
        <label>Description<textarea name="description" required></textarea></label>
        <label>Corrective action<textarea name="action"></textarea></label>
      `
    },

    waste: {
      title: "Log food waste",
      fields: `
        <label>Food item<input name="food" required></label>
        <label>Quantity<input name="quantity" type="number" min="0.01" step="any" required></label>
        <label>Unit
          <select name="unit">
            <option>kg</option>
            <option>litres</option>
            <option>pieces</option>
          </select>
        </label>
        <label>Reason
          <select name="reason" required>
            <option value="">Select reason</option>
            <option>Expired</option>
            <option>Over-prepared</option>
            <option>Damaged</option>
            <option>Leftover</option>
            <option>Other</option>
          </select>
        </label>
        <label>Date<input name="date" type="date" value="${today()}" required></label>
      `
    }
  };

  const selected = forms[type];

  if (!selected) return;

  $("modalTitle").textContent = selected.title;
  fields.innerHTML = selected.fields;

  $("modalBackdrop").classList.remove("hidden");
  $("recordForm").dataset.type = type;
}

function closeModal() {
  $("modalBackdrop").classList.add("hidden");
  $("recordForm").reset();
}

// -------------------- EVENT LISTENERS --------------------

document.addEventListener("click", async event => {
  const viewButton = event.target.closest("[data-view]");

  if (viewButton) {
    setView(viewButton.dataset.view);
  }

  const actionButton = event.target.closest("[data-action]");

  if (actionButton) {
    const action = actionButton.dataset.action;

    if (action === "add-stock") showModal("stock");
    if (action === "add-issue") showModal("issue");
    if (action === "add-waste") showModal("waste");
  }

  const deleteButton = event.target.closest("[data-delete]");

  if (deleteButton) {
    if (!confirm("Delete this inventory record?")) return;

    try {
      await removeRecord("inventory", deleteButton.dataset.delete);

      data.inventory = data.inventory.filter(
        item => item.id !== deleteButton.dataset.delete
      );

      renderAll();
      showToast("Inventory record deleted.");
    } catch (error) {
      console.error(error);
      showToast("Could not delete record.");
    }
  }
});

$("recordForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const type = form.dataset.type;
  const formData = Object.fromEntries(new FormData(form).entries());

  if (
    formData.quantity !== undefined &&
    (!Number.isFinite(Number(formData.quantity)) ||
      Number(formData.quantity) <= 0)
  ) {
    showToast("Enter a valid quantity.");
    return;
  }

  try {
    if (type === "stock") {
      await addRecord("inventory", {
        ...formData,
        quantity: Number(formData.quantity)
      });

      data.inventory = await loadCollection("inventory");
    }

    if (type === "issue") {
      await addRecord("issues", {
        ...formData,
        status: "Reported"
      });

      data.issues = await loadCollection("issues");
    }

    if (type === "waste") {
      await addRecord("waste", {
        ...formData,
        quantity: Number(formData.quantity)
      });

      data.waste = await loadCollection("waste");
    }

    closeModal();
    renderAll();
    showToast("Record saved successfully!");

  } catch (error) {
    console.error("Save error:", error);
    showToast("Could not save record. Please try again.");
  }
});

document.addEventListener("change", async event => {
  const hygieneId = event.target.dataset.hygiene;

  if (hygieneId) {
    try {
      await updateRecord("hygiene", hygieneId, {
        done: event.target.checked
      });

      const task = data.hygiene.find(item => item.id === hygieneId);

      if (task) task.done = event.target.checked;

      renderAll();
    } catch (error) {
      console.error(error);
      showToast("Could not update hygiene task.");
    }
  }

  const issueId = event.target.dataset.issue;

  if (issueId) {
    try {
      await updateRecord("issues", issueId, {
        status: event.target.value
      });

      const issue = data.issues.find(item => item.id === issueId);

      if (issue) issue.status = event.target.value;

      renderAll();
      showToast("Issue status updated.");
    } catch (error) {
      console.error(error);
      showToast("Could not update issue status.");
    }
  }
});

$("inventorySearch").addEventListener("input", renderInventory);
$("inventoryFilter").addEventListener("change", renderInventory);

$("resetTasks").addEventListener("click", async () => {
  if (!confirm("Reset all hygiene tasks to pending?")) return;

  try {
    for (const task of data.hygiene) {
      await updateRecord("hygiene", task.id, {
        done: false
      });

      task.done = false;
    }

    renderAll();
    showToast("Hygiene checklist reset.");
  } catch (error) {
    console.error(error);
    showToast("Could not reset checklist.");
  }
});

$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

$("modalBackdrop").addEventListener("click", event => {
  if (event.target === $("modalBackdrop")) closeModal();
});

$("mobileMenu").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

$("logoutButton").addEventListener("click", async () => {
  try {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "login.html";
  } catch (error) {
    console.error(error);
    showToast("Could not log out. Try again.");
  }
});
