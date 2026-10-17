/* ===== Settings ===== */
// Demo login. Change these. This is NOT real security: anyone can read this file.

// Services and their default prices
const SERVICES = { "Haircut": 250, "Haircut + beard": 400, "Shave": 200, "Hair color": 900 };
const STORAGE_KEY = "barber-data";

const page = document.body.dataset.page;


const API = "https://barbershop-reservation-system.onrender.com/api";






async function apiFetch(url, options = {}) {
    const token = sessionStorage.getItem("adminToken");

    const response = await fetch(API + url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        }
    });

    if (response.status === 401) {
        sessionStorage.clear();
        window.location.href = "login.html";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.message || result.error || `HTTP ${response.status}`
        );
    }

    return result;
}


let data = {
    staffs: [],
    clients: [],
    appointments: [],
    services: []
};


async function loadAppointments() {
    const appointments = await apiFetch("/appointments");

    if (appointments) {
        data.appointments = appointments;

        earnings(); // Update earnings cards
        render();
    }
}


async function loadStaffs() {
    try {
        const staffs = await apiFetch("/barbers/admin");

        if (Array.isArray(staffs)) {
            data.staffs = staffs;
            render();
        }
    } catch (error) {
        console.error("Failed to load staff:", error);
    }
}


async function loadServices() {
    try {
        const services = await apiFetch("/services?admin=true");

        if (Array.isArray(services)) {
            data.services = services;
            render();
        }
    } catch (error) {
        console.error("Failed to load services:", error);
        alert("Failed to load services: " + error.message);
    }
}


const nextId = list => Math.max(0, ...list.map(x => x.id)) + 1;
const staffOptions = () => ["No preference", ...data.staffs.map(s => s.name)];

/* ===== Small helpers ===== */
const money = n => "₱" + Number(n).toLocaleString("en-PH");
const when = s => new Date(s).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const byDate = (a, b) => a.date.localeCompare(b.date);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const btn = (act, id, label, cls = "") => `<button class="${cls}" data-action="${act}" data-id="${id}">${label}</button>`;
const emptyRow = (cols, msg) => `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`;

/* ===== Pop-up form used for add / edit ===== */
function openForm(title, fields, values, onSave, modalClass = "") {
 
  const dlg = document.createElement("div");
 
  dlg.className = `modal ${modalClass}`.trim();
  dlg.innerHTML = `<div class="card modal-box"><h3 style="margin-top:0">${title}</h3><form>` +
    fields.map(f => {
      const v = values[f.name] ?? "";
      const input = f.options
        ? `<select name="${f.name}">${f.options.map(o => `<option${o == v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
        : `<input name="${f.name}" type="${f.type || "text"}" value="${esc(v)}" required>`;
      return `<label>${f.label}${input}</label>`;
    }).join("") +
    `<div class="dialog-buttons"><button type="button" class="light">Cancel</button><button type="submit">Save</button></div></form></div>`;
  
  const close = () => { document.removeEventListener("keydown", onKey); dlg.remove(); };
  const onKey = e => { if (e.key === "Escape") close(); };
  const form = dlg.querySelector("form");
  dlg.querySelector("button.light").onclick = close;
  dlg.addEventListener("mousedown", e => { if (e.target === dlg) close(); });
 
 
form.onsubmit = async e => {
    e.preventDefault();

    const v = Object.fromEntries(
        [...new FormData(form)].map(([k, x]) => [
            k,
            String(x).trim()
        ])
    );

    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const saved = await onSave(v);

        if (saved === false) {
            saveButton.disabled = false;
            saveButton.textContent = "Save";
            return;
        }

        close();
    } catch (error) {
        console.error("Form save error:", error);
        alert("Unable to save. Please try again.");
        saveButton.disabled = false;
        saveButton.textContent = "Save";
    }
};


  document.addEventListener("keydown", onKey);
  document.body.append(dlg);
  const first = dlg.querySelector("input, select");
  if (first) first.focus();
  return dlg;
}


async function staffForm(s) {
    const fields = [
        { name: "name", label: "Barber name" },
        { name: "role", label: "Specialization" },
        {
            name: "status",
            label: "Status",
            options: ["Available", "Unavailable", "On Leave"]
        }
    ];

    openForm(
        s ? "Edit staff" : "Add staff",
        fields,
        {
            name: s?.name || "",
            role: s?.specialization || s?.role || "Barber",
            status: s?.status || "Available"
        },
        async (v) => {
            try {
                const result = await apiFetch(
                    s
                        ? `/barbers/${encodeURIComponent(s._id || s.id)}`
                        : "/barbers",
                    {
                        method: s ? "PUT" : "POST",
                        body: JSON.stringify({
                            name: v.name,
                            role: v.role,
                            specialization: v.role,
                            status: v.status
                        })
                    }
                );

                if (!result || result.error || result.message === "Staff not found.") {
                    alert(result?.message || result?.error || "Failed to save staff.");
                    return false;
                }

                await loadStaffs();
                return true;

            } catch (error) {
                console.error("SAVE STAFF ERROR:", error);
                alert("Save failed: " + error.message);
                return false;
            }
        },
        "accent-form-modal"
    );
}


async function serviceForm(service) {
    const fields = [
        { name: "name", label: "Service name" },
        { name: "description", label: "Description" },
        { name: "price", label: "Price (₱)", type: "number" },
        { name: "duration", label: "Duration (minutes)", type: "number" },
        {
            name: "status",
            label: "Status",
            options: ["Active", "Inactive"]
        }
    ];

    openForm(
        service ? "Edit service" : "Add service",
        fields,
        {
            name: service?.name || "",
            description: service?.description || "",
            price: service?.price ?? "",
            duration: service?.duration ?? "",
            status: service?.status || "Active"
        },
        async (v) => {
            try {
                const result = await apiFetch(
                    service
                        ? `/services/${encodeURIComponent(service._id)}`
                        : "/services",
                    {
                        method: service ? "PUT" : "POST",
                        body: JSON.stringify({
                            name: v.name,
                            description: v.description,
                            price: Number(v.price),
                            duration: Number(v.duration),
                            status: v.status
                        })
                    }
                );

                if (!result || !result._id) {
                    alert(result?.message || "Failed to save service.");
                    return false;
                }

                await loadServices();
                return true;
            } catch (error) {
                alert("Service save failed: " + error.message);
                return false;
            }
        },
        "accent-form-modal"
    );
}


function clientForm(c) {
  const fields = [
    { name: "name", label: "Name" }, { name: "phone", label: "Phone" },
    { name: "staff", label: "Preferred staff", options: staffOptions() }
  ];
  openForm(c ? "Edit client" : "Add client", fields, c || {}, v => {
    if (data.clients.some(x => x !== c && x.name.toLowerCase() === v.name.toLowerCase())) {
      alert("A client with that name already exists.");
      return false;
    }
    if (c) {
      if (c.name !== v.name) data.appointments.forEach(a => { if (a.client === c.name) a.client = v.name; });
      Object.assign(c, v);
    } else data.clients.push({ id: nextId(data.clients), ...v });
    commit();
  });
}

/* ===== Drawing the tables ===== */
function apptRow(a) {

  const actions = {
    Pending: [
      btn("accept", a._id || a.id, "Accept"),
      btn("decline", a._id || a.id, "Decline", "light")
    ],

    Confirmed: [
      btn("complete", a._id || a.id, "Mark done"),
      btn("cancel", a._id || a.id, "Cancel", "light")
    ]

  }[a.status] || [];


  return `
  <tr>

  <td>${when(a.date + "T" + a.time)}</td>

  <td>${esc(a.customerName || a.client)}</td>

  <td>${esc(a.service)}</td>

  <td>${esc(a.barber || "No preference")}</td>

  <td>${money(a.price || 0)}</td>

  <td>
    <span class="tag ${a.status.toLowerCase()}">
      ${a.status}
    </span>
  </td>

  <td>
    ${actions.join(" ")}
  </td>

  </tr>`;
}


function earnings() {
  // Count Completed appointments only
  const done = data.appointments.filter(
    a => String(a.status).toLowerCase().trim() === "completed"
);
  // Use Philippine local date
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const parts = Object.fromEntries(
    dateParts.map(part => [part.type, part.value])
  );

  const todayString = `${parts.year}-${parts.month}-${parts.day}`;
  const [year, monthNumber, day] = todayString.split("-").map(Number);

  // Local date boundaries
  const today = new Date(year, monthNumber - 1, day);
  const tomorrow = new Date(year, monthNumber - 1, day + 1);

  // Week starts Monday
  const week = new Date(today);
  week.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  // Month starts on day 1
  const monthStart = new Date(year, monthNumber - 1, 1);

  // Parse YYYY-MM-DD as a local calendar date
  const appointmentDate = a => {
    return new Date(a.date);
};

  const sum = (from, until = null) =>
    done
      .filter(a => {
        const date = appointmentDate(a);
        return date >= from && (!until || date < until);
      })
      .reduce((total, a) => total + (Number(a.price) || 0), 0);


const earnToday = document.getElementById("earn-today");
const earnWeek = document.getElementById("earn-week");
const earnMonth = document.getElementById("earn-month");

if (earnToday) {
    earnToday.textContent = money(sum(today, tomorrow));
}

if (earnWeek) {
    earnWeek.textContent = money(sum(week, tomorrow));
}

if (earnMonth) {
    earnMonth.textContent = money(sum(monthStart, tomorrow));
}

}



const PAGE_SIZE = 10;
const paginationControllers = new Map();

function clampPageNumber(value, totalPages) {
    if (!Number.isFinite(value)) {
        return 1;
    }

    if (!totalPages || totalPages <= 0) {
        return 0;
    }

    return Math.min(Math.max(1, Math.floor(value)), totalPages);
}

function createPageController(containerId) {
    const container = document.getElementById(containerId);

    if (!container) {
        return null;
    }

    if (paginationControllers.has(containerId)) {
        return paginationControllers.get(containerId);
    }

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "pagination-nav";
    prevButton.textContent = "Previous";

    const indicator = document.createElement("button");
    indicator.type = "button";
    indicator.className = "pagination-indicator";
    indicator.textContent = "Page 1 of 1";

    const editor = document.createElement("div");
    editor.className = "pagination-editor";
    editor.hidden = true;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.placeholder = "Page";

    const goButton = document.createElement("button");
    goButton.type = "button";
    goButton.className = "pagination-go";
    goButton.textContent = "Go";

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "pagination-nav";
    nextButton.textContent = "Next";

    const message = document.createElement("div");
    message.className = "pagination-message";
    message.setAttribute("aria-live", "polite");

    const state = {
        currentPage: 1,
        totalPages: 1,
        editMode: false,
        onPageChange: null,
        setRecords(recordCount) {
            const totalPages = recordCount > 0 ? Math.ceil(recordCount / PAGE_SIZE) : 0;
            state.totalPages = totalPages;
            state.currentPage = totalPages === 0 ? 0 : clampPageNumber(state.currentPage, totalPages);
            state.refresh();
        },
        getPage() {
            return state.totalPages === 0 ? 0 : state.currentPage;
        },
        goTo(pageNumber) {
            if (state.totalPages === 0) {
                state.closeEditor();
                return;
            }

            const requestedPage = Number.parseInt(String(pageNumber), 10);
            const validPage = clampPageNumber(requestedPage, state.totalPages);
            state.currentPage = validPage;
            state.refresh();
            return validPage;
        },
        refresh() {
            const hasRecords = state.totalPages > 0;
            prevButton.disabled = !hasRecords || state.currentPage <= 1;
            nextButton.disabled = !hasRecords || state.currentPage >= state.totalPages;
            indicator.textContent = state.totalPages === 0 ? "Page 0 of 0" : `Page ${state.currentPage} of ${state.totalPages}`;
            indicator.disabled = !hasRecords;
            if (!state.editMode) {
                editor.hidden = true;
                indicator.hidden = false;
            }
            message.textContent = "";
        },
        openEditor() {
            if (state.totalPages === 0) {
                return;
            }

            state.editMode = true;
            indicator.hidden = true;
            editor.hidden = false;
            input.value = String(state.currentPage);
            input.focus();
            input.select();
        },
        closeEditor() {
            state.editMode = false;
            editor.hidden = true;
            indicator.hidden = false;
            message.textContent = "";
            input.value = String(state.currentPage || 1);
        }
    };

    prevButton.addEventListener("click", () => {
        if (state.totalPages > 0) {
            state.currentPage = Math.max(1, state.currentPage - 1);
            state.refresh();
            if (typeof state.onPageChange === "function") {
                state.onPageChange();
            }
        }
    });

    nextButton.addEventListener("click", () => {
        if (state.totalPages > 0) {
            state.currentPage = Math.min(state.totalPages, state.currentPage + 1);
            state.refresh();
            if (typeof state.onPageChange === "function") {
                state.onPageChange();
            }
        }
    });

    indicator.addEventListener("click", () => {
        if (state.totalPages > 0) {
            state.openEditor();
        }
    });

    goButton.addEventListener("click", () => {
        const value = input.value.trim();

        if (!value || !/^\d+$/.test(value)) {
            message.textContent = "Please enter a valid page number.";
            input.focus();
            return;
        }

        const numericValue = Number.parseInt(value, 10);

        if (numericValue <= 0 || !Number.isInteger(numericValue) || numericValue > state.totalPages) {
            message.textContent = `Enter a page between 1 and ${state.totalPages}.`;
            input.focus();
            return;
        }

        state.currentPage = numericValue;
        state.closeEditor();
        state.refresh();
        if (typeof state.onPageChange === "function") {
            state.onPageChange();
        }
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            goButton.click();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            state.closeEditor();
        }
    });

    editor.append(input, goButton);
    container.append(prevButton, indicator, editor, nextButton, message);
    paginationControllers.set(containerId, state);
    state.refresh();
    return state;
}

function render() {
    const rows = document.getElementById("rows");

    // ===== DASHBOARD =====
    if (page === "dashboard") {
            earnings();

            const totalAppointments = data.appointments.length;

            const pendingAppointments = data.appointments.filter(
                a => a.status === "Pending"
            ).length;

            const totalBarbers = data.staffs.length;
            const totalServices = data.services.length;

            const totalEl = document.getElementById("total-appointments");
            const pendingEl = document.getElementById("pending-appointments");
            const barbersEl = document.getElementById("active-barbers");
            const servicesEl = document.getElementById("total-services");

            if (totalEl) totalEl.textContent = totalAppointments;
            if (pendingEl) pendingEl.textContent = pendingAppointments;
            if (barbersEl) barbersEl.textContent = totalBarbers;
            if (servicesEl) servicesEl.textContent = totalServices;

            return;
    }

// ===== APPOINTMENTS PAGE =====
if (page === "appointments" && rows) {
    const list = [...data.appointments].sort(byDate).reverse();
    const controller = createPageController("appointments-pagination");

    if (controller) {
        controller.onPageChange = () => render();
        controller.setRecords(list.length);
        const pageNumber = controller.getPage();
        const startIndex = pageNumber > 0 ? (pageNumber - 1) * PAGE_SIZE : 0;
        const visibleRecords = list.slice(startIndex, startIndex + PAGE_SIZE);

        rows.innerHTML = visibleRecords.map(apptRow).join("") || emptyRow(
            7,
            "No appointments yet. Bookings from the client site will show up here."
        );
        return;
    }

    rows.innerHTML =
        list.map(apptRow).join("") ||
        emptyRow(
            7,
            "No appointments yet. Bookings from the client site will show up here."
        );
}

// ===== STAFFS PAGE =====
if (page === "staffs" && rows) {
    rows.innerHTML = data.staffs.map(s => {
        const status = s.status || "Available";

        return `
            <tr>
                <td>${esc(s.name)}</td>
                <td>${esc(s.specialization || s.role || "Barber")}</td>
                <td>
                    <span class="tag ${status.toLowerCase()}">
                        ${esc(status)}
                    </span>
                </td>
                <td>
                    ${btn("edit-staff", s.id || s._id, "Edit", "light")}
                    ${btn("remove-staff", s.id || s._id, "Remove", "light")}
                </td>
            </tr>
        `;
    }).join("") || emptyRow(4, "No staff found. Click Add staff.");
}

// ===== SERVICES PAGE =====
if (page === "services" && rows) {
    const list = [...data.services];
    const controller = createPageController("services-pagination");

    if (controller) {
        controller.onPageChange = () => render();
        controller.setRecords(list.length);
        const pageNumber = controller.getPage();
        const startIndex = pageNumber > 0 ? (pageNumber - 1) * PAGE_SIZE : 0;
        const visibleRecords = list.slice(startIndex, startIndex + PAGE_SIZE);

        rows.innerHTML = visibleRecords.map(s => `
            <tr>
                <td>${esc(s.name)}</td>
                <td>${esc(s.description || "-")}</td>
                <td>${money(s.price || 0)}</td>
                <td>${Number(s.duration) || 0}</td>
                <td>${esc(s.status || "Active")}</td>
                <td>
                    ${btn("edit-service", s._id, "Edit", "light")}
                    ${btn("delete-service", s._id, "Delete", "light")}
                </td>
            </tr>
        `).join("") || emptyRow(6, "No services found. Click Add service.");
        return;
    }

    rows.innerHTML = data.services.map(s => `
            <tr>
                <td>${esc(s.name)}</td>
                <td>${esc(s.description || "-")}</td>
                <td>${money(s.price || 0)}</td>
                <td>${Number(s.duration) || 0}</td>
                <td>${esc(s.status || "Active")}</td>
                <td>
                    ${btn("edit-service", s._id, "Edit", "light")}
                    ${btn("delete-service", s._id, "Delete", "light")}
                </td>
            </tr>
        `).join("") || emptyRow(6, "No services found. Click Add service.");
    }


    // ===== CLIENTS PAGE =====
    if (page === "clients" && rows) {
        rows.innerHTML = data.clients.map(c => {
            const visits = data.appointments
                .filter(a =>
                    (a.customerName || a.client) === c.name &&
                    a.status === "Completed"
                )
                .sort(byDate);

            const last = visits.length
                ? new Date(
                    visits[visits.length - 1].date
                ).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric"
                })
                : "-";

            return `<tr>
                <td>${esc(c.name)}</td>
                <td>${esc(c.phone || "-")}</td>
                <td>${esc(c.staff || "-")}</td>
                <td>${last}</td>
                <td>${visits.length}</td>
                <td>
                    ${btn("edit-client", c.id, "Edit", "light")}
                    ${btn("remove-client", c.id, "Remove", "light")}
                </td>
            </tr>`;
        }).join("") || emptyRow(6, "No clients yet. Click Add client.");
    }
}


function commit() { save(); render(); }

/* ===== Button clicks ===== */
function start() {
  document.querySelector(".logout").onclick = () => {

    sessionStorage.removeItem("admin");
    sessionStorage.removeItem("adminToken");

    window.location.href = "index.html";

};

  const add = document.getElementById("add-btn");
  
    if (add) {
        add.onclick = () => ({
            staffs: () => staffForm(),
            clients: () => clientForm(),
            services: () => serviceForm()
        })[page]?.();
    }


  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;

const id = b.dataset.id;
const act = b.dataset.action;

const a = data.appointments.find(
    x => String(x._id || x.id) === String(id)
);

if (["accept", "decline", "cancel", "complete"].includes(act)) {
    if (!a) {
        alert("Appointment not found.");
        return;
    }

    const newStatus = {
        accept: "Confirmed",
        decline: "Cancelled",
        cancel: "Cancelled",
        complete: "Completed"
    }[act];

    b.disabled = true;

    try {
        const updated = await apiFetch(
            `/appointments/${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    status: newStatus
                })
            }
        );

        if (!updated || !updated._id) {
            throw new Error(
                updated?.message || "Failed to update appointment."
            );
        }

        const index = data.appointments.findIndex(
            x => String(x._id || x.id) === String(id)
        );

        if (index !== -1) {
            data.appointments[index] = updated;
        }

        if (
            act === "complete" &&
            updated.feedbackInvitation?.sent === false
        ) {
            alert(updated.feedbackInvitation.message);
        }

        render();

    } catch (error) {
        console.error("Appointment status update error:", error);
        alert(error.message || "Unable to update appointment.");
        b.disabled = false;
    }

    return;
}


else if (act === "edit-service") {
    const service = data.services.find(s => String(s._id) === String(id));

    if (!service) {
        alert("Service not found.");
        return;
    }

    serviceForm(service);
}

else if (act === "delete-service") {
    if (!confirm("Delete this service?")) return;

    try {
        const result = await apiFetch(
            `/services/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        if (!result || result.message === "Service not found.") {
            alert(result?.message || "Failed to delete service.");
            return;
        }

        await loadServices();
        alert("Service deleted successfully!");
    } catch (error) {
        alert("Delete failed: " + error.message);
    }

    return;
}


else if (act === "edit-staff") {
    const staff = data.staffs.find(
        s => String(s._id || s.id) === String(id)
    );

    if (!staff) {
        alert("Staff not found.");
        return;
    }

    return staffForm(staff);
}


    else if (act === "edit-client") return clientForm(data.clients.find(c => c.id === id));
    

else if (act === "remove-staff") {
    if (!confirm("Remove this staff member?")) return;

    try {
        const result = await apiFetch(
            `/barbers/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        if (!result || result.message === "Staff not found.") {
            alert(result?.message || "Failed to remove staff.");
            return;
        }

        await loadStaffs();
        alert("Staff removed successfully!");
    } catch (error) {
        console.error("Remove staff error:", error);
        alert("Remove failed: " + error.message);
    }

    return;
}

 else if (act === "remove-client") {
      if (!confirm("Remove this client?")) return;
      data.clients = data.clients.filter(c => c.id !== id);
    }
    commit();
  });

  render();
}

/* ===== Login check (runs last) ===== */

if (page === "login") {
    document.getElementById("login-form").onsubmit = async (e) => {
        e.preventDefault();

        const username = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("login-error");

        errorMessage.textContent = "";

        try {
            const response = await fetch(
                `${API}/admin/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ username, password })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                errorMessage.textContent = result.message;
                return;
            }

            sessionStorage.setItem("adminToken", result.token);
            sessionStorage.setItem("admin", "yes");

            window.location.href = "dashboard.html";

        } catch (error) {
            errorMessage.textContent =
                "Cannot connect to server. Please try again.";
        }
    };
} else if (sessionStorage.getItem("admin") !== "yes") {
    window.location.href = "index.html";
} else {
    

    start();

    loadAppointments();

    
    if (page === "staffs" || page === "dashboard") {
        loadStaffs();
    }

    if (page === "services" || page === "dashboard") {
        loadServices();
    }



}
