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
    appointments: []
};

async function loadAppointments(){

    const appointments = await apiFetch("/appointments");

    if(appointments){

        data.appointments = appointments;

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
function openForm(title, fields, values, onSave) {
 
  const dlg = document.createElement("div");
 
  dlg.className = "modal";
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
        { name: "name", label: "Name", required: true },
        { name: "role", label: "Role", required: true },
        { name: "date", label: "Date", type: "date" },
        { name: "time", label: "Time", type: "time" }
    ];

    openForm(
        s ? "Edit staff" : "Add staff",
        fields,
        {
            name: s?.name || "",
            role: s?.role || s?.specialization || "Barber",
            date: s?.date || "",
            time: s?.time || ""
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
                            date: v.date,
                            time: v.time
                        })
                    }
                );

                if (!result || result.error) {
                    alert(result?.error || "Failed to save staff.");
                    return false;
                }

                await loadStaffs();
                return true;
            } catch (error) {
            console.error("SAVE STAFF ERROR:", error);
            alert("Save failed: " + error.message);
            return false;
          }
        }
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
  const done = data.appointments.filter(a => a.status === "Completed");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(today); week.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // week starts Monday
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const sum = from => done.filter(a => new Date(a.date) >= from).reduce((t, a) => t + Number(a.price), 0);
  document.getElementById("earn-today").textContent = money(sum(today));
  document.getElementById("earn-week").textContent = money(sum(week));
  document.getElementById("earn-month").textContent = money(sum(month));
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

        // Count unique customers from appointment records
        const uniqueClients = new Set(
            data.appointments
                .map(a => (a.email || a.customerEmail || a.customerName || a.client || "").trim().toLowerCase())
                .filter(Boolean)
        ).size;

        const totalEl = document.getElementById("total-appointments");
        const pendingEl = document.getElementById("pending-appointments");
        const barbersEl = document.getElementById("active-barbers");
        const clientsEl = document.getElementById("total-clients");

        if (totalEl) totalEl.textContent = totalAppointments;
        if (pendingEl) pendingEl.textContent = pendingAppointments;
        if (barbersEl) barbersEl.textContent = totalBarbers;
        if (clientsEl) clientsEl.textContent = uniqueClients;

        return;
    }

    // ===== APPOINTMENTS PAGE =====
    if (page === "appointments" && rows) {
        const list = [...data.appointments].sort(byDate).reverse();

        rows.innerHTML =
            list.map(apptRow).join("") ||
            emptyRow(
                7,
                "No appointments yet. Bookings from the client site will show up here."
            );
    }

    // ===== STAFFS PAGE =====
    if (page === "staffs" && rows) {
        rows.innerHTML = data.staffs.map(s =>
            `<tr>
                <td>${esc(s.name)}</td>
                <td>${esc(s.role || s.specialization || "Barber")}</td>
                <td>${esc(s.date || "-")}</td>
                <td>${esc(s.time || "-")}</td>
                <td>
                    ${btn("edit-staff", s.id || s._id, "Edit", "light")}
                    ${btn("remove-staff", s.id || s._id, "Remove", "light")}
                </td>
            </tr>`
        ).join("") || emptyRow(5, "No staff yet. Click Add staff.");
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
  if (add) add.onclick = () => ({ staffs: staffForm, clients: clientForm })[page]?.();

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

        render();

    } catch (error) {
        console.error("Appointment status update error:", error);
        alert(error.message || "Unable to update appointment.");
        b.disabled = false;
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
                "http://localhost:5000/api/admin/login",
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


}

