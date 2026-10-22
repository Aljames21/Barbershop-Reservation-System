/* ===== Settings ===== */
// Demo login. Change these. This is NOT real security: anyone can read this file.

// Services and their default prices
console.log("DEBUG: script.js is executing");
window.addEventListener("error", function (event) {
    console.error("GLOBAL ERROR:", event.message);
    console.error("FILE:", event.filename);
    console.error("LINE:", event.lineno);
});
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

async function loadDashboardRatingSummary() {
    const errorElement = document.getElementById("dashboard-feedback-error");

    try {
        const feedback = await apiFetch("/feedback/admin");

        if (!Array.isArray(feedback)) {
            return;
        }

        const summary = summarizeFeedbackRatings(feedback);
        const averageElement = document.getElementById("dashboard-average-rating");
        const countElement = document.getElementById("dashboard-review-count");
        const fiveStarElement = document.getElementById("dashboard-five-star-count");

        averageElement.textContent = summary.average === null
            ? "—"
            : `${summary.average.toFixed(1)} / 5`;
        countElement.textContent = String(summary.count);
        fiveStarElement.textContent = String(summary.fiveStarCount);
    } catch (error) {
        console.error("Dashboard feedback rating load error:", error);
        errorElement.textContent = `Unable to load feedback ratings: ${error.message}`;
        errorElement.hidden = false;
    }
}


let data = {
    staffs: [],
    clients: [],
    appointments: [],
    services: []
};
const selectedStaffIds = new Set();
const selectedServiceIds = new Set();

function syncActiveArchiveSelection(type, selectedIds) {
    const checkboxes = [...document.querySelectorAll(
        `.admin-archive-checkbox[data-type="${type}"]`
    )];
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectedIds.has(String(checkbox.dataset.id));
    });
    const selectedOnPage = checkboxes.filter(checkbox => checkbox.checked).length;
    const selectAll = document.getElementById(`select-all-active-${type}`);
    const count = document.getElementById(`active-${type}-selected-count`);
    const archiveButton = document.getElementById(`archive-selected-${type}`);

    if (!selectAll || !count || !archiveButton) return;

    count.textContent = `${selectedIds.size} selected`;
    archiveButton.disabled = selectedIds.size === 0;
    selectAll.checked = checkboxes.length > 0 && selectedOnPage === checkboxes.length;
    selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < checkboxes.length;
}

async function loadAppointments() {
    console.log("DEBUG: loadAppointments called");

    try {
        console.log("Loading appointments...");

        const appointments = await apiFetch("/appointments");

        console.log(
            "Appointments API result:",
            Array.isArray(appointments)
                ? `${appointments.length} records`
                : appointments
        );

        if (!Array.isArray(appointments)) {
            console.error(
                "Invalid appointments response:",
                appointments
            );
            return;
        }

        data.appointments = appointments;

        if (page === "appointments") {
            const barberFilter = document.getElementById(
                "appointment-barber-filter"
            );

            if (barberFilter) {
                const barbers = [
                    ...new Set(
                        appointments
                            .map(a => String(a.barber || "").trim())
                            .filter(Boolean)
                    )
                ].sort((a, b) => a.localeCompare(b));

                barberFilter.replaceChildren(
                    new Option("All Barbers", "all"),
                    ...barbers.map(name => new Option(name, name))
                );

                barberFilter.value = barbers.includes(
                    appointmentFilters.barber
                )
                    ? appointmentFilters.barber
                    : "all";

                appointmentFilters.barber = barberFilter.value;
            }
        }

        earnings();
        render();

    } catch (error) {
        console.error(
            "LOAD APPOINTMENTS ERROR:",
            error
        );
    }
}


async function loadStaffs() {
    try {
        const staffs = await apiFetch("/barbers/admin");

        if (Array.isArray(staffs)) {
            data.staffs = staffs;
            const activeIds = new Set(staffs.map(s => String(s._id || s.id)));
            selectedStaffIds.forEach(id => {
                if (!activeIds.has(id)) selectedStaffIds.delete(id);
            });
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
            const activeIds = new Set(services.map(s => String(s._id)));
            selectedServiceIds.forEach(id => {
                if (!activeIds.has(id)) selectedServiceIds.delete(id);
            });
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

    dlg.innerHTML =
        `<div class="card modal-box">
            <h3 style="margin-top:0">${esc(title)}</h3>
            <form>` +

        fields.map(f => {
            const v = values[f.name] ?? "";

            let input;

            if (f.type === "file") {
                input = `
                    <input
                        name="${f.name}"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                    >

                    <img
                        class="service-image-preview"
                        alt="Service image preview"
                        style="
                            display:none;
                            width:160px;
                            height:160px;
                            object-fit:cover;
                            margin-top:10px;
                            border-radius:8px;
                        "
                    >
                `;

            } else if (f.options) {
                input = `
                    <select name="${f.name}">
                        ${f.options.map(o =>
                            `<option${o == v ? " selected" : ""}>
                                ${esc(o)}
                            </option>`
                        ).join("")}
                    </select>
                `;

            } else {
                input = `
                    <input
                        name="${f.name}"
                        type="${f.type || "text"}"
                        value="${esc(v)}"
                        required
                    >
                `;
            }

            return `<label>${esc(f.label)}${input}</label>`;

        }).join("") +

        `<div class="dialog-buttons">
            <button type="button" class="light">Cancel</button>
            <button type="submit">Save</button>
        </div>
        </form>
        </div>`;

    const close = () => {
        document.removeEventListener("keydown", onKey);
        dlg.remove();
    };

    const onKey = e => {
        if (e.key === "Escape") close();
    };

    const form = dlg.querySelector("form");

    // IMAGE PREVIEW
    const imageInput = form.querySelector('input[type="file"]');
    const imagePreview = form.querySelector(".service-image-preview");

    if (imageInput && imagePreview) {
        let previewUrl = null;

        imageInput.addEventListener("change", () => {
            const file = imageInput.files[0];

            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                previewUrl = null;
            }

            imagePreview.style.display = "none";
            imagePreview.removeAttribute("src");

            if (!file) return;

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(file.type)) {
                alert("Only JPG, PNG, and WebP images are allowed.");
                imageInput.value = "";
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert("Image must be 5MB or smaller.");
                imageInput.value = "";
                return;
            }

            previewUrl = URL.createObjectURL(file);
            imagePreview.src = previewUrl;
            imagePreview.style.display = "block";
        });

        // Release the temporary preview URL when closing.
        const originalClose = close;

        dlg.addEventListener("modal-close-cleanup", () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                previewUrl = null;
            }
        });
    }

    dlg.querySelector("button.light").onclick = () => {
        dlg.dispatchEvent(new Event("modal-close-cleanup"));
        close();
    };

    dlg.addEventListener("mousedown", e => {
        if (e.target === dlg) {
            dlg.dispatchEvent(new Event("modal-close-cleanup"));
            close();
        }
    });

    form.onsubmit = async e => {
        e.preventDefault();

        const v = Object.fromEntries(
            [...new FormData(form)].map(([k, x]) => [
                k,
                x instanceof File ? x : String(x).trim()
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

            dlg.dispatchEvent(new Event("modal-close-cleanup"));
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
            name: "image",
            label: "Barber Picture",
            type: "file"
        },
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
                // Keep the existing picture when editing.
                let imageUrl = s?.imageUrl || "";

                // Upload only when a new picture is selected.
                if (v.image instanceof File && v.image.size > 0) {
                    const allowedTypes = [
                        "image/jpeg",
                        "image/png",
                        "image/webp"
                    ];

                    if (!allowedTypes.includes(v.image.type)) {
                        alert("Only JPG, PNG, and WebP images are allowed.");
                        return false;
                    }

                    if (v.image.size > 5 * 1024 * 1024) {
                        alert("Image must be 5MB or smaller.");
                        return false;
                    }

                    const formData = new FormData();
                    formData.append("image", v.image);

                    const uploadResponse = await fetch(
                        API + "/uploads/barber-image",
                        {
                            method: "POST",
                            headers: {
                                Authorization:
                                    "Bearer " +
                                    sessionStorage.getItem("adminToken")
                            },
                            body: formData
                        }
                    );

                    const uploadResult = await uploadResponse.json();

                    if (!uploadResponse.ok || !uploadResult.imageUrl) {
                        throw new Error(
                            uploadResult.message ||
                            "Barber image upload failed."
                        );
                    }

                    imageUrl = uploadResult.imageUrl;
                }

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
                            status: v.status,
                            imageUrl: imageUrl
                        })
                    }
                );

                if (!result || !result._id) {
                    alert(
                        result?.message ||
                        result?.error ||
                        "Failed to save staff."
                    );
                    return false;
                }

                await loadStaffs();
                return true;

            } catch (error) {
                console.error("SAVE STAFF ERROR:", error);
                alert("Staff save failed: " + error.message);
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
        {
            name: "image",
            label: "Service Image",
            type: "file"
        },
        { name: "price", label: "Price (₱)", type: "number" },
        { name: "duration", label: "Duration (minutes)", type: "number" },
        {
            name: "status",
            label: "Status",
            options: ["Active", "Inactive"]
        }
    ];

    const serviceDialog = openForm(
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
                let imageUrl = service?.imageUrl || "";

                // Upload a new image only when one is selected.
                if (v.image instanceof File && v.image.size > 0) {
                    const allowedTypes = [
                        "image/jpeg",
                        "image/png",
                        "image/webp"
                    ];

                    if (!allowedTypes.includes(v.image.type)) {
                        alert("Only JPG, PNG, and WebP images are allowed.");
                        return false;
                    }

                    if (v.image.size > 5 * 1024 * 1024) {
                        alert("Image must be 5MB or smaller.");
                        return false;
                    }

                    const formData = new FormData();
                    formData.append("image", v.image);

                    const uploadResponse = await fetch(
                        API + "/uploads/service-image",
                        {
                            method: "POST",
                            headers: {
                                Authorization:
                                    "Bearer " +
                                    sessionStorage.getItem("adminToken")
                            },
                            body: formData
                        }
                    );

                    const uploadResult = await uploadResponse.json();

                    if (!uploadResponse.ok || !uploadResult.imageUrl) {
                        throw new Error(
                            uploadResult.message ||
                            "Image upload failed."
                        );
                    }

                    imageUrl = uploadResult.imageUrl;
                }

                const result = await apiFetch(
                    service
                        ? `/services/${encodeURIComponent(service._id)}`
                        : "/services",
                    {
                        method: service ? "PUT" : "POST",
                        body: JSON.stringify({
                            name: v.name,
                            description: v.description,
                            imageUrl: imageUrl,
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

// ===== VIEW APPOINTMENT DETAILS =====
function viewAppointmentDetails(a) {
    const modal = document.createElement("div");
    modal.className = "modal";

    modal.innerHTML = `
        <div class="card modal-box">
            <h3>Appointment Details</h3>

            <p><strong>Customer:</strong> ${esc(a.customerName || a.client || "-")}</p>

            <p><strong>Service:</strong> ${esc(a.service || "-")}</p>

            <p><strong>Barber:</strong> ${esc(a.barber || "No preference")}</p>

            <p><strong>Date:</strong> ${esc(a.date || "-")}</p>

            <p><strong>Time:</strong> ${esc(a.time || "-")}</p>

            <p><strong>Price:</strong> ${money(a.price || 0)}</p>

            <p><strong>Status:</strong> ${esc(a.status || "-")}</p>

            <div class="dialog-buttons">
                <button type="button" class="light" id="close-appointment-details">
                    Close
                </button>
            </div>
        </div>
    `;

    const close = () => {
        document.removeEventListener("keydown", onKeyDown);
        modal.remove();
    };

    const onKeyDown = (event) => {
        if (event.key === "Escape") close();
    };

    modal.querySelector("#close-appointment-details")
        .addEventListener("click", close);

    modal.addEventListener("mousedown", (event) => {
        if (event.target === modal) close();
    });

    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(modal);
}

/* ===== Drawing the tables ===== */

function apptRow(a) {

  const id = a._id || a.id;

  const canArchive =
    a.status === "Completed" ||
    a.status === "Cancelled";

  const checkbox = canArchive
    ? `<input
         type="checkbox"
         class="appointment-row-checkbox"
         data-id="${esc(id)}"
         aria-label="Select appointment for ${esc(a.customerName || a.client || "customer")}"
       >`
    : "";

  const actions = {
    Pending: [
      btn("accept", id, "Accept"),
      btn("decline", id, "Decline", "light")
    ],

    Confirmed: [
      btn("complete", id, "Mark done"),
      btn("cancel", id, "Cancel", "light")
    ]

  }[a.status] || [];

  return `
    <tr>

      <td class="appointment-checkbox-cell">
        ${checkbox}
      </td>

      <td>${when(a.date + "T" + a.time)}</td>

      <td>${esc(a.customerName || a.client)}</td>

      <td>${esc(a.service)}</td>

      <td>${esc(a.barber || "No preference")}</td>

      <td>${money(a.price || 0)}</td>

      <td>
        <span class="tag ${esc(a.status.toLowerCase())}">
          ${esc(a.status)}
        </span>
      </td>

      <td class="appointment-actions-cell">
        <div class="appointment-actions">
          ${btn("view-appointment", id, "View", "light")}
          ${actions.join(" ")}
        </div>
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

// ===== APPOINTMENT SEARCH & FILTER STATE =====
const appointmentFilters = {
    search: "",
    status: "all",
    date: "",
    barber: "all",
    sort: "newest"
};

function getFilteredAppointments() {
    return data.appointments.filter(a => {
        const search = appointmentFilters.search.toLowerCase();

        const searchableText = [
            a.customerName || a.client || "",
            a.service || "",
            a.barber || ""
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(search);

        const matchesStatus =
            appointmentFilters.status === "all" ||
            a.status === appointmentFilters.status;

        const matchesDate =
            !appointmentFilters.date ||
            String(a.date).slice(0, 10) === appointmentFilters.date;

        const matchesBarber =
            appointmentFilters.barber === "all" ||
            a.barber === appointmentFilters.barber;

        return matchesSearch &&
               matchesStatus &&
               matchesDate &&
               matchesBarber;
    });
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

// ===== MONTHLY BOOKING TRENDS CHART =====
let bookingTrendsChart = null;

function renderBookingTrendsChart() {
    const canvas = document.getElementById("booking-trends-chart");

    if (!canvas || typeof Chart === "undefined") return;

    const monthlyCounts = {};

    // Count appointments by scheduled month
    data.appointments.forEach(appointment => {
        const date = String(appointment.date || "").slice(0, 10);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

        const month = date.slice(0, 7);

        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
    });

            // Display all 12 months of the current year
        const currentYear = new Date().getFullYear();

        const labels = [
            "Jan", "Feb", "Mar", "Apr",
            "May", "Jun", "Jul", "Aug",
            "Sep", "Oct", "Nov", "Dec"
        ];

        const counts = labels.map((_, index) => {
            const monthNumber = String(index + 1).padStart(2, "0");
            const monthKey = `${currentYear}-${monthNumber}`;

            return monthlyCounts[monthKey] || 0;
        });

    // Prevent duplicate charts when dashboard updates
    if (bookingTrendsChart) {
        bookingTrendsChart.destroy();
    }

    bookingTrendsChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Total Appointments",
                data: counts,
                backgroundColor: "#aa803c",
                borderRadius: 6,
                maxBarThickness: 65
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#ffffff"
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#cccccc"
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#cccccc",
                        precision: 0
                    },
                    grid: {
                        color: "rgba(255,255,255,0.1)"
                    }
                }
            }
        }
    });
}


/* ===== APPOINTMENT CHECKBOX SELECTION ===== */

        const selectedAppointmentIds = new Set();

        function getVisibleAppointmentCheckboxes() {
            return [
                ...document.querySelectorAll(
                    "#rows .appointment-row-checkbox"
                )
            ];
        }

        function updateAppointmentSelection() {
            const checkboxes = getVisibleAppointmentCheckboxes();

            const selectAll = document.getElementById(
                "select-all-appointments"
            );

            const selectedCount = document.getElementById(
                "selected-appointments-count"
            );

            const archiveButton = document.getElementById(
                "archive-selected-appointments"
            );

            // Count selected appointments on the current page
            const count = checkboxes.filter(
                checkbox => checkbox.checked
            ).length;

            if (selectedCount) {
                selectedCount.textContent = `${count} selected`;
            }

            if (archiveButton) {
                archiveButton.disabled = count === 0;
            }

            if (selectAll) {
                selectAll.checked =
                    checkboxes.length > 0 &&
                    checkboxes.every(checkbox => checkbox.checked);

                selectAll.indeterminate =
                    count > 0 && count < checkboxes.length;
            }
        }

        function syncAppointmentCheckboxes() {
            const checkboxes = getVisibleAppointmentCheckboxes();

            // Clear old selections when rendering a different page
            selectedAppointmentIds.clear();

            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });

            updateAppointmentSelection();
        }

        
// ===== ARCHIVED APPOINTMENTS =====

let archivedAppointments = [];

/* ===== ARCHIVES PAGINATION ===== */

let archiveCurrentPage = 1;

const ARCHIVE_PAGE_SIZE = 10;





/* ===== ARCHIVES SEARCH AND STATUS FILTER ===== */


function getFilteredArchivedAppointments() {
    const search = (
        document.getElementById("archive-search")?.value || ""
    ).trim().toLowerCase();

    const status = document.getElementById(
        "archive-status-filter"
    )?.value || "all";

    const selectedDate = document.getElementById(
        "archive-date-filter"
    )?.value || "";

    const sortBy = document.getElementById(
        "archive-sort"
    )?.value || "newest";

    // ===== FILTER ARCHIVED APPOINTMENTS =====

    const filtered = archivedAppointments.filter(appointment => {

        const searchableText = [
            appointment.customerName,
            appointment.client,
            appointment.service,
            appointment.barber
        ]
            .filter(Boolean)
            .map(value => String(value).toLowerCase())
            .join(" ");

        const matchesSearch =
            !search || searchableText.includes(search);

        const matchesStatus =
            status === "all" || appointment.status === status;

        const appointmentDate = appointment.date
            ? String(appointment.date).slice(0, 10)
            : "";

        const matchesDate =
            !selectedDate || appointmentDate === selectedDate;

        return matchesSearch && matchesStatus && matchesDate;
    });

    // ===== SORT ARCHIVED APPOINTMENTS =====

    filtered.sort((a, b) => {

        if (sortBy === "name-asc") {
            return String(a.customerName || a.client || "")
                .localeCompare(
                    String(b.customerName || b.client || "")
                );
        }

        if (sortBy === "name-desc") {
            return String(b.customerName || b.client || "")
                .localeCompare(
                    String(a.customerName || a.client || "")
                );
        }

        const dateA =
            new Date(a.archivedAt || 0).getTime() || 0;

        const dateB =
            new Date(b.archivedAt || 0).getTime() || 0;

        if (sortBy === "oldest") {
            return dateA - dateB;
        }

        return dateB - dateA;
    });

    return filtered;
}




/* ===== LOAD ARCHIVED APPOINTMENTS ===== */

async function loadArchivedAppointments() {
    if (page !== "archives") return;

    const rows = document.getElementById(
        "archived-appointments-rows"
    );

    const count = document.getElementById(
        "archived-appointments-count"
    );

    try {
        const appointments = await apiFetch(
            "/appointments/archive/list"
        );

        if (!Array.isArray(appointments)) {
            throw new Error("Invalid archived appointments response.");
        }

        archivedAppointments = appointments;

        renderArchivedAppointments();

    } catch (error) {
        console.error("Load archives error:", error);

        if (count) {
            count.textContent = "Unable to load archived appointments.";
        }

        if (rows) {
            rows.innerHTML = emptyRow(
                8,
                "Failed to load archived appointments."
            );
        }
    }
}


function formatArchiveDateTime(date, time) {
    if (!date) return "-";

    const datePart = String(date).slice(0, 10);
    const timePart = String(time || "00:00").trim();

    const formattedDate = new Date(
        `${datePart}T${timePart}`
    );

    if (isNaN(formattedDate.getTime())) {
        return `${datePart} ${timePart}`;
    }

    return formattedDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}



/* ===== RENDER ARCHIVED APPOINTMENTS ===== */

function renderArchivedAppointments() {
    const rows = document.getElementById(
        "archived-appointments-rows"
    );

    const count = document.getElementById(
        "archived-appointments-count"
    );

    if (!rows) return;

    const filtered = getFilteredArchivedAppointments();

    // ===== CALCULATE ARCHIVES PAGINATION =====

        const totalPages = Math.max(
            1,
            Math.ceil(filtered.length / ARCHIVE_PAGE_SIZE)
        );

        archiveCurrentPage = Math.min(
            Math.max(archiveCurrentPage, 1),
            totalPages
        );

        const startIndex =
            (archiveCurrentPage - 1) * ARCHIVE_PAGE_SIZE;

        const paginatedAppointments = filtered.slice(
            startIndex,
            startIndex + ARCHIVE_PAGE_SIZE
        );

    if (count) {
        count.textContent =
            `${filtered.length} of ${archivedAppointments.length} archived appointment(s)`;
    }

    rows.innerHTML = paginatedAppointments.map(a => {
        const id = a._id || a.id;

        
        const archivedDate = a.archivedAt
            ? new Date(a.archivedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            })
            : "-";

            return `
                <tr>
                    <td>
                        <input
                            type="checkbox"
                            class="archived-appointment-checkbox"
                            data-id="${esc(id)}"
                            aria-label="Select archived appointment"
                        >
                    </td>

                   <td>${formatArchiveDateTime(a.date, a.time)}</td>

                <td>${esc(a.customerName || a.client || "-")}</td>
                <td>${esc(a.service || "-")}</td>
                <td>${esc(a.barber || "No preference")}</td>
                <td>${money(a.price || 0)}</td>
                <td>
                    <span class="tag ${esc(
                        String(a.status || "").toLowerCase()
                    )}">
                        ${esc(a.status || "-")}
                    </span>
                </td>
                <td>${esc(archivedDate)}</td>
            </tr>
        `;
    }).join("") || emptyRow(
        8,
        "No archived appointments found."
    );
    
/* ===== RENDER ARCHIVES PAGINATION ===== */

const pagination = document.getElementById(
    "archives-pagination"
);

if (pagination) {
    pagination.innerHTML = `
        <button
            class="pagination-nav"
            type="button"
            data-archive-page="${archiveCurrentPage - 1}"
            ${archiveCurrentPage <= 1 ? "disabled" : ""}>
            Previous
        </button>

        <span>Page ${archiveCurrentPage} of ${totalPages}</span>

        <button
            class="pagination-nav"
            type="button"
            data-archive-page="${archiveCurrentPage + 1}"
            ${archiveCurrentPage >= totalPages ? "disabled" : ""}>
            Next
        </button>
    `;
}

}


function resetArchivePagination() {
    archiveCurrentPage = 1;
    renderArchivedAppointments();
}


if (page === "archives") {
    const archiveSearch = document.getElementById("archive-search");
    const archiveStatus = document.getElementById("archive-status-filter");
    const archiveDate = document.getElementById("archive-date-filter");
    const archiveSort = document.getElementById("archive-sort");
    const resetArchiveFilters = document.getElementById("reset-archive-filters");
    const archivePagination = document.getElementById("archives-pagination");

    if (archivePagination) {
        archivePagination.addEventListener("click", (event) => {
            const button = event.target.closest(
                "[data-archive-page]"
            );

            if (!button || button.disabled) return;

            const selectedPage = Number(
                button.dataset.archivePage
            );

            if (!Number.isInteger(selectedPage)) return;

            archiveCurrentPage = selectedPage;

            renderArchivedAppointments();
        });
    }


    if (resetArchiveFilters) {
        resetArchiveFilters.addEventListener("click", () => {

            document.getElementById("archive-search").value = "";

            document.getElementById("archive-status-filter").value = "all";

            document.getElementById("archive-date-filter").value = "";

            document.getElementById("archive-sort").value = "newest";

            resetArchivePagination();
        });
    }


   
/* ===== ARCHIVES FILTER EVENTS ===== */

    if (archiveSearch) {
        archiveSearch.addEventListener(
            "input",
            resetArchivePagination
        );
    }

    if (archiveStatus) {
        archiveStatus.addEventListener(
            "change",
            resetArchivePagination
        );
    }

    if (archiveDate) {
        archiveDate.addEventListener(
            "change",
            resetArchivePagination
        );
    }

    if (archiveSort) {
        archiveSort.addEventListener(
            "change",
            resetArchivePagination
        );
    }

}




/* ===== RESTORE ARCHIVED APPOINTMENT ===== */

async function restoreArchivedAppointment(id) {
    const confirmed = confirm(
        "Retrieve this appointment? It will return to the Appointments page."
    );

    if (!confirmed) return;

    try {
        await apiFetch(
            `/appointments/archive/${encodeURIComponent(id)}/restore`,
            {
                method: "PATCH"
            }
        );

        alert("Appointment retrieved successfully!");

        await loadArchivedAppointments();

    } catch (error) {
        console.error("Restore appointment error:", error);

        alert(
            error.message || "Unable to retrieve appointment."
        );
    }
}


/* ===== DELETE ARCHIVED APPOINTMENT PERMANENTLY ===== */

async function deleteArchivedAppointment(id) {
    const appointment = archivedAppointments.find(
        a => String(a._id || a.id) === String(id)
    );

    if (!appointment) {
        alert("Archived appointment not found.");
        return;
    }

    const confirmed = await showAppointmentConfirmation(
        `Permanently delete the ${appointment.status} appointment of ` +
        `${appointment.customerName || appointment.client || "this customer"}? ` +
        `This will remove the record from the database and cannot be undone.`
    );

    if (!confirmed) return;

    try {
        const result = await apiFetch(
            `/appointments/archive/${encodeURIComponent(id)}/permanent`,
            {
                method: "DELETE"
            }
        );

        if (!result) return;

        await loadArchivedAppointments();

        alert("Appointment permanently deleted!");

    } catch (error) {
        console.error("Permanent delete error:", error);

        alert(
            "Delete failed: " +
            (error.message || "Unable to delete appointment.")
        );
    }
}


/* ===== ARCHIVE BUTTON EVENTS ===== */


/* ===== ARCHIVE BUTTON EVENTS ===== */

document.addEventListener("click", async (event) => {
    if (page !== "archives") return;

    const button = event.target.closest(
        '[data-action="restore-appointment"], [data-action="delete-archived-appointment"]'
    );

    if (!button || button.disabled) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (!id) return;

    button.disabled = true;

    try {
        if (action === "restore-appointment") {
            await restoreArchivedAppointment(id);
        }

        if (action === "delete-archived-appointment") {
            await deleteArchivedAppointment(id);
        }
    } finally {
        if (button.isConnected) {
            button.disabled = false;
        }
    }
});


// ===== SERVICES SEARCH AND FILTERS =====

function getFilteredServices() {
    const search = (
        document.getElementById("services-search")?.value || ""
    ).trim().toLowerCase();

    const status = (
        document.getElementById("services-status-filter")?.value || "all"
    ).toLowerCase();

    const sort = document.getElementById("services-price-sort")?.value
        || "default";

    const list = data.services.filter(service => {
        const searchableText = [
            service.name || "",
            service.description || ""
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(search);

        const matchesStatus =
            status === "all" ||
            String(service.status || "Active").toLowerCase() === status;

        return matchesSearch && matchesStatus;
    });

    if (sort === "low-high") {
        list.sort((a, b) => Number(a.price) - Number(b.price));
    }

    if (sort === "high-low") {
        list.sort((a, b) => Number(b.price) - Number(a.price));
    }

    return list;
}

function render() {
    const rows = document.getElementById("rows");

    // ===== DASHBOARD =====
    if (page === "dashboard") {
            earnings();
            renderBookingTrendsChart();

            const totalAppointments = data.appointments.length;

            const pendingAppointments = data.appointments.filter(
                a => a.status === "Pending"
            ).length;

            // Count appointments by status
                const confirmedAppointments = data.appointments.filter(
                    a => a.status === "Confirmed"
                ).length;

                const completedAppointments = data.appointments.filter(
                    a => a.status === "Completed"
                ).length;

                const cancelledAppointments = data.appointments.filter(
                    a => a.status === "Cancelled"
                ).length;

            const totalBarbers = data.staffs.length;
            const totalServices = data.services.length;

            const totalEl = document.getElementById("total-appointments");
            const pendingEl = document.getElementById("pending-appointments");
            const confirmedEl = document.getElementById("confirmed-appointments");
            const completedEl = document.getElementById("completed-appointments");
            const cancelledEl = document.getElementById("cancelled-appointments");
            const barbersEl = document.getElementById("active-barbers");
            const servicesEl = document.getElementById("total-services");

            if (totalEl) totalEl.textContent = totalAppointments;
            if (pendingEl) pendingEl.textContent = pendingAppointments;
            if (confirmedEl) confirmedEl.textContent = confirmedAppointments;
            if (completedEl) completedEl.textContent = completedAppointments;
            if (cancelledEl) cancelledEl.textContent = cancelledAppointments;
            if (barbersEl) barbersEl.textContent = totalBarbers;
            if (servicesEl) servicesEl.textContent = totalServices;

            return;
    }

// ===== APPOINTMENTS PAGE =====
if (page === "appointments" && rows) {

    // Filter all appointments before pagination
   const list = getFilteredAppointments().filter(
    appointment => appointment.isArchived !== true
);

list.sort((a, b) => {
    const dateA = `${a.date || ""}T${a.time || "00:00"}`;
    const dateB = `${b.date || ""}T${b.time || "00:00"}`;

    const nameA = String(a.customerName || a.client || "");
    const nameB = String(b.customerName || b.client || "");

    switch (appointmentFilters.sort) {
        case "oldest":
            return dateA.localeCompare(dateB);

        case "name-asc":
            return nameA.localeCompare(nameB);

        case "name-desc":
            return nameB.localeCompare(nameA);

        case "newest":
        default:
            return dateB.localeCompare(dateA);
    }
});

    // Update results count
    const resultsCount = document.getElementById(
        "appointment-results-count"
    );

    if (resultsCount) {
        resultsCount.textContent =
            
    `Showing ${list.length} of ${data.appointments.filter
        (a => a.isArchived !== true).length} appointments`

    }

    // Existing pagination
    const controller = createPageController(
        "appointments-pagination"
    );

    if (controller) {
        controller.onPageChange = () => render();
        controller.setRecords(list.length);

        const pageNumber = controller.getPage();

        const startIndex = pageNumber > 0
            ? (pageNumber - 1) * PAGE_SIZE
            : 0;

        const visibleRecords = list.slice(
            startIndex,
            startIndex + PAGE_SIZE
        );

    rows.innerHTML = visibleRecords.map(apptRow).join("") ||
        emptyRow(8, "No matching appointments found.");

        syncAppointmentCheckboxes();

        return;
    }

    rows.innerHTML = list.map(apptRow).join("") ||
        emptyRow(8, "No matching appointments found.");

        syncAppointmentCheckboxes();

        return;
}

// ===== STAFFS PAGE =====
if (page === "staffs" && rows) {
    rows.innerHTML = data.staffs.map(s => {
        const status = s.status || "Available";
        const id = String(s.id || s._id);

        const barberImage = s.imageUrl
            ? `<img
                src="${esc(s.imageUrl)}"
                alt="${esc(s.name)}"
                class="staff-avatar"
                loading="lazy"
              >`
            : `<div class="staff-avatar staff-avatar-placeholder">
                <span>✂</span>
              </div>`;

        return `
            <tr>
                <td>
                    <input
                        type="checkbox"
                        class="admin-archive-checkbox"
                        data-type="staff"
                        data-id="${esc(id)}"
                        aria-label="Select ${esc(s.name)}"
                        ${selectedStaffIds.has(id) ? "checked" : ""}
                    >
                </td>
                <td>
                    <div class="staff-name-cell">
                        ${barberImage}
                        <span>${esc(s.name)}</span>
                    </div>
                </td>

                <td>${esc(s.specialization || s.role || "Barber")}</td>

                <td>
                    <span class="tag ${status.toLowerCase()}">
                        ${esc(status)}
                    </span>
                </td>

                <td>
                    ${btn("edit-staff", s.id || s._id, "Edit", "light")}
                    ${btn("archive-staff", s.id || s._id, "Archive", "archive-record-btn")}
                </td>
            </tr>
        `;
    }).join("") || emptyRow(5, "No staff found. Click Add staff.");
    syncActiveArchiveSelection(
        "staff",
        selectedStaffIds
    );
}

// ===== SERVICES PAGE =====
if (page === "services" && rows) {
    const list = getFilteredServices();
    const controller = createPageController("services-pagination");

    if (controller) {
        controller.onPageChange = () => render();
        controller.setRecords(list.length);
        const pageNumber = controller.getPage();
        const startIndex = pageNumber > 0 ? (pageNumber - 1) * PAGE_SIZE : 0;
        const visibleRecords = list.slice(startIndex, startIndex + PAGE_SIZE);

        rows.innerHTML = visibleRecords.map(s => `
            <tr>
                <td>
                    <input
                        type="checkbox"
                        class="admin-archive-checkbox"
                        data-type="services"
                        data-id="${esc(s._id)}"
                        aria-label="Select ${esc(s.name)}"
                        ${selectedServiceIds.has(String(s._id)) ? "checked" : ""}
                    >
                </td>
                <td>${esc(s.name)}</td>
                <td>${esc(s.description || "-")}</td>
                <td>${money(s.price || 0)}</td>
                <td>${Number(s.duration) || 0}</td>
                <td>${esc(s.status || "Active")}</td>
                <td>
                    ${btn("edit-service", s._id, "Edit", "light")}
                    ${btn("archive-service", s._id, "Archive", "archive-record-btn")}
                </td>
            </tr>
        `).join("") || emptyRow(7, "No services found. Click Add service.");
        syncActiveArchiveSelection(
            "services",
            selectedServiceIds
        );
        return;
    }

    rows.innerHTML = list.map(s => `
            <tr>
                <td>
                    <input
                        type="checkbox"
                        class="admin-archive-checkbox"
                        data-type="services"
                        data-id="${esc(s._id)}"
                        aria-label="Select ${esc(s.name)}"
                        ${selectedServiceIds.has(String(s._id)) ? "checked" : ""}
                    >
                </td>
                <td>${esc(s.name)}</td>
                <td>${esc(s.description || "-")}</td>
                <td>${money(s.price || 0)}</td>
                <td>${Number(s.duration) || 0}</td>
                <td>${esc(s.status || "Active")}</td>
                <td>
                    ${btn("edit-service", s._id, "Edit", "light")}
                    ${btn("archive-service", s._id, "Archive", "archive-record-btn")}
                </td>
            </tr>
        `).join("") || emptyRow(7, "No services found. Click Add service.");
    syncActiveArchiveSelection(
        "services",
        selectedServiceIds
    );
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
    console.log("DEBUG: start() called");

    // ===== SERVICES FILTER EVENTS =====

if (page === "services") {
    const searchInput = document.getElementById("services-search");
    const statusFilter = document.getElementById("services-status-filter");
    const priceSort = document.getElementById("services-price-sort");
    const clearButton = document.getElementById("services-clear-filters");

    function applyServiceFilters() {
        const controller = createPageController("services-pagination");

        if (controller) {
            controller.goTo(1);
        }

        render();
    }

    searchInput?.addEventListener("input", applyServiceFilters);
    statusFilter?.addEventListener("change", applyServiceFilters);
    priceSort?.addEventListener("change", applyServiceFilters);

    clearButton?.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (statusFilter) statusFilter.value = "all";
        if (priceSort) priceSort.value = "default";

        applyServiceFilters();
    });
}

if (page === "appointments") {

    const searchInput = document.getElementById("appointment-search");
    const statusFilter = document.getElementById("appointment-status-filter");
    const dateFilter = document.getElementById("appointment-date-filter");
    const barberFilter = document.getElementById("appointment-barber-filter");
    const sortFilter = document.getElementById("appointment-sort");
    const resetButton = document.getElementById("reset-appointment-filters");

   function applyFilters() {
    const hasActiveFilters =
        appointmentFilters.search !== "" ||
        appointmentFilters.status !== "all" ||
        appointmentFilters.date !== "" ||
        appointmentFilters.barber !== "all";

    // Show Reset button only when filters are active
    resetButton.hidden = !hasActiveFilters;

    // Return to page 1 whenever filters change
    const controller = createPageController("appointments-pagination");

    if (controller) {
        controller.goTo(1);
    }

    render();
}

resetButton.hidden = true;

    searchInput.addEventListener("input", () => {
        appointmentFilters.search = searchInput.value.trim();
        applyFilters();
    });

    statusFilter.addEventListener("change", () => {
        appointmentFilters.status = statusFilter.value;
        applyFilters();
    });

    dateFilter.addEventListener("change", () => {
        appointmentFilters.date = dateFilter.value;
        applyFilters();
    });

    barberFilter.addEventListener("change", () => {
        appointmentFilters.barber = barberFilter.value;
        applyFilters();
    });

            // ===== APPOINTMENT SORTING =====
    sortFilter.addEventListener("change", () => {
         appointmentFilters.sort = sortFilter.value;
         applyFilters();
    });

    resetButton.addEventListener("click", () => {
        appointmentFilters.search = "";
        appointmentFilters.status = "all";
        appointmentFilters.date = "";
        appointmentFilters.barber = "all";

        searchInput.value = "";
        statusFilter.value = "all";
        dateFilter.value = "";
        barberFilter.value = "all";

        applyFilters();
    });

    
/* ===== APPOINTMENT SELECT ALL ===== */

if (page === "appointments") {

    const selectAll = document.getElementById(
        "select-all-appointments"
    );

    if (selectAll) {
        selectAll.addEventListener("change", function () {

            const checkboxes = getVisibleAppointmentCheckboxes();

            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;

                if (this.checked) {
                    selectedAppointmentIds.add(checkbox.dataset.id);
                } else {
                    selectedAppointmentIds.delete(checkbox.dataset.id);
                }
            });

            updateAppointmentSelection();
        });
    }

    const rows = document.getElementById("rows");

    if (rows) {
        rows.addEventListener("change", function (event) {

            const checkbox = event.target.closest(
                ".appointment-row-checkbox"
            );

            if (!checkbox) return;

            if (checkbox.checked) {
                selectedAppointmentIds.add(checkbox.dataset.id);
            } else {
                selectedAppointmentIds.delete(checkbox.dataset.id);
            }

            updateAppointmentSelection();
        });
    }

    const archiveSelectedButton = document.getElementById(
        "archive-selected-appointments"
    );

    if (archiveSelectedButton) {
        archiveSelectedButton.addEventListener("click", async () => {
            const appointmentIds = [...selectedAppointmentIds];

            if (appointmentIds.length === 0) {
                return;
            }

            const confirmed = await showAppointmentConfirmation(
                `Archive ${appointmentIds.length} selected appointment${appointmentIds.length === 1 ? "" : "s"}?`
            );

            if (!confirmed) {
                return;
            }

            archiveSelectedButton.disabled = true;

            try {
                const result = await apiFetch("/appointments/archive/bulk", {
                    method: "PATCH",
                    body: JSON.stringify({ appointmentIds })
                });

                if (
                    !result ||
                    result.archivedCount !== appointmentIds.length
                ) {
                    throw new Error(
                        result?.message ||
                        "Unable to archive the selected appointments."
                    );
                }

                await loadAppointments();
                alert(
                    `${result.archivedCount} appointment${result.archivedCount === 1 ? "" : "s"} moved to Archives.`
                );
            } catch (error) {
                console.error("Bulk appointment archive error:", error);
                alert(
                    error.message ||
                    "Unable to archive the selected appointments."
                );
                updateAppointmentSelection();
            }
        });
    }

}

}
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

if (
    page === "archives" &&
    ["restore-appointment", "delete-archived-appointment"].includes(act)
) {
    return;
}   

const a = data.appointments.find(
    x => String(x._id || x.id) === String(id)
);

// Open appointment details
if (act === "view-appointment") {
    if (!a) {
        alert("Appointment not found.");
        return;
    }

    viewAppointmentDetails(a);
    return;
}

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

    // ===== APPOINTMENT ACTION CONFIRMATION =====
        const confirmationMessages = {
            accept: "Accept this appointment?",
            decline: "Decline this appointment?",
            cancel: "Cancel this appointment?",
            complete: "Mark this appointment as completed?"
        };

        const confirmed = await showAppointmentConfirmation(
            confirmationMessages[act]
        );

        if (!confirmed) {
            return;
        }

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

else if (act === "archive-service") {
    if (!confirm("Move this service to the Services archive?")) return;

    try {
        const result = await apiFetch(
            `/services/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        if (!result?.service) {
            throw new Error(result?.message || "Failed to archive service.");
        }

        selectedServiceIds.delete(String(id));
        await loadServices();
        alert("Service moved to the Services archive.");
    } catch (error) {
        console.error("Archive service error:", error);
        alert("Archive failed: " + error.message);
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
    

else if (act === "archive-staff") {
    if (!confirm("Move this barber to the Barbers archive?")) return;

    try {
        const result = await apiFetch(
            `/barbers/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        if (!result?.barber) {
            throw new Error(result?.message || "Failed to archive barber.");
        }

        selectedStaffIds.delete(String(id));
        await loadStaffs();
        alert("Barber moved to the Barbers archive.");
    } catch (error) {
        console.error("Archive barber error:", error);
        alert("Archive failed: " + error.message);
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

function setupActiveArchiveSelection(type, selectedIds) {
    const selectAll = document.getElementById(`select-all-active-${type}`);
    const archiveButton = document.getElementById(`archive-selected-${type}`);
    const rows = document.getElementById("rows");

    if (!selectAll || !archiveButton || !rows) return;

    selectAll.addEventListener("change", () => {
        rows.querySelectorAll(`.admin-archive-checkbox[data-type="${type}"]`)
            .forEach(checkbox => {
                checkbox.checked = selectAll.checked;
                if (checkbox.checked) {
                    selectedIds.add(String(checkbox.dataset.id));
                } else {
                    selectedIds.delete(String(checkbox.dataset.id));
                }
            });
        syncActiveArchiveSelection(type, selectedIds);
    });

    rows.addEventListener("change", event => {
        const checkbox = event.target.closest(
            `.admin-archive-checkbox[data-type="${type}"]`
        );
        if (!checkbox) return;

        if (checkbox.checked) {
            selectedIds.add(String(checkbox.dataset.id));
        } else {
            selectedIds.delete(String(checkbox.dataset.id));
        }
        syncActiveArchiveSelection(type, selectedIds);
    });

    archiveButton.addEventListener("click", async () => {
        const records = type === "staff"
            ? data.staffs.filter(record =>
                selectedIds.has(String(record._id || record.id))
            )
            : data.services.filter(record =>
                selectedIds.has(String(record._id))
            );
        if (!records.length) return;

        const noun = type === "staff" ? "barber" : "service";
        if (!confirm(`Move ${records.length} selected ${noun}(s) to the archive?`)) return;

        archiveButton.disabled = true;
        const failures = [];
        let archivedCount = 0;

        for (const record of records) {
            const id = String(record._id || record.id);
            try {
                const result = await apiFetch(
                    type === "staff"
                        ? `/barbers/${encodeURIComponent(id)}`
                        : `/services/${encodeURIComponent(id)}`,
                    { method: "DELETE" }
                );
                const archivedRecord = type === "staff"
                    ? result?.barber
                    : result?.service;
                if (!archivedRecord) {
                    throw new Error(result?.message || `Failed to archive ${noun}.`);
                }
                selectedIds.delete(id);
                archivedCount += 1;
            } catch (error) {
                failures.push(`${record.name || id}: ${error.message}`);
            }
        }

        if (type === "staff") {
            await loadStaffs();
        } else {
            await loadServices();
        }
        syncActiveArchiveSelection(type, selectedIds);

        if (failures.length) {
            console.error(`Some ${type} records could not be archived:`, failures);
            alert(
                `${archivedCount} archived; ${failures.length} failed.\n` +
                failures.join("\n")
            );
        } else {
            alert(`${archivedCount} ${noun}(s) moved to the archive.`);
        }
    });
}

setupActiveArchiveSelection("staff", selectedStaffIds);
setupActiveArchiveSelection("services", selectedServiceIds);

function showAppointmentConfirmation(message) {
    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.className = "modal appointment-confirm-modal";

        modal.innerHTML = `
            <div class="card modal-box">
                <h3>Confirm Action</h3>
                <p>${esc(message)}</p>

                <div class="dialog-buttons">
                    <button type="button" id="appointment-confirm-no">
                        Go Back
                    </button>

                    <button type="button" id="appointment-confirm-yes">
                        Confirm
                    </button>
                </div>
            </div>
        `;

        const finish = (result) => {
            document.removeEventListener("keydown", onKeyDown);
            modal.remove();
            resolve(result);
        };

        const onKeyDown = (event) => {
            if (event.key === "Escape") finish(false);
        };

        modal.querySelector("#appointment-confirm-no")
            .addEventListener("click", () => finish(false));

        modal.querySelector("#appointment-confirm-yes")
            .addEventListener("click", () => finish(true));

        modal.addEventListener("click", (event) => {
            if (event.target === modal) finish(false);
        });

        document.addEventListener("keydown", onKeyDown);
        document.body.appendChild(modal);
    });
}

/* ===== Login check (runs last) ===== */

console.log("DEBUG: reached login condition");
console.log("DEBUG: current page =", page);
console.log("DEBUG: admin session =", sessionStorage.getItem("admin"));


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
    console.log("DEBUG: admin initialization reached");
    start();
    if (page === "archives") {
    loadArchivedAppointments();
}

    if (page === "dashboard") {
        loadDashboardRatingSummary();
    }

    loadAppointments();

    
    if (page === "staffs" || page === "dashboard") {
        loadStaffs();
    }

    if (page === "services" || page === "dashboard") {
        loadServices();
    }



}

/* ===== ARCHIVED APPOINTMENTS BULK ACTIONS ===== */

if (page === "archives") {
    const archiveRows = document.getElementById(
        "archived-appointments-rows"
    );

    const selectAll = document.getElementById(
        "select-all-archives"
    );

    const selectedCount = document.getElementById(
        "archive-selected-count"
    );

    const retrieveButton = document.getElementById(
        "retrieve-selected-archives"
    );

    const deleteButton = document.getElementById(
        "delete-selected-archives"
    );

    let processing = false;

    function getArchiveCheckboxes() {
        return [...archiveRows.querySelectorAll(
            ".archived-appointment-checkbox"
        )];
    }

    function getSelectedArchiveIds() {
        return getArchiveCheckboxes()
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.dataset.id);
    }

    function updateArchiveSelection() {
        const checkboxes = getArchiveCheckboxes();
        const selected = getSelectedArchiveIds().length;

        selectedCount.textContent = `${selected} selected`;

        retrieveButton.disabled = processing || selected === 0;
        deleteButton.disabled = processing || selected === 0;
        selectAll.disabled = processing || checkboxes.length === 0;

        selectAll.checked =
            checkboxes.length > 0 &&
            selected === checkboxes.length;

        selectAll.indeterminate =
            selected > 0 && selected < checkboxes.length;
    }

    selectAll.addEventListener("change", () => {
        getArchiveCheckboxes().forEach(checkbox => {
            checkbox.checked = selectAll.checked;
        });

        updateArchiveSelection();
    });

    archiveRows.addEventListener("change", event => {
        if (event.target.matches(
            ".archived-appointment-checkbox"
        )) {
            updateArchiveSelection();
        }
    });

    new MutationObserver(updateArchiveSelection).observe(
        archiveRows,
        { childList: true }
    );

    async function processSelectedArchives(action) {
        if (processing) return;

        const ids = getSelectedArchiveIds();
        if (!ids.length) return;

        const deleting = action === "delete";

        const confirmed = await showAppointmentConfirmation(
            deleting
                ? `Permanently delete ${ids.length} selected appointment(s)? This cannot be undone.`
                : `Retrieve ${ids.length} selected appointment(s)?`
        );

        if (!confirmed || processing) return;

        processing = true;
        updateArchiveSelection();

        const checkboxes = getArchiveCheckboxes();
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
        });

        let successful = 0;
        const failures = [];

        try {
            for (const id of ids) {
                try {
                    const endpoint = deleting
                        ? `/appointments/archive/${encodeURIComponent(id)}/permanent`
                        : `/appointments/archive/${encodeURIComponent(id)}/restore`;

                    const result = await apiFetch(endpoint, {
                        method: deleting ? "DELETE" : "PATCH"
                    });

                    if (!result) {
                        throw new Error("Request did not complete.");
                    }

                    successful++;
                } catch (error) {
                    failures.push(`${id}: ${error.message}`);
                }
            }

            await loadArchivedAppointments();

            alert(
                `${successful} appointment(s) ${
                    deleting ? "deleted" : "retrieved"
                } successfully.` +
                (failures.length
                    ? `\n${failures.length} failed:\n${failures.join("\n")}`
                    : "")
            );

        } catch (error) {
            alert("Bulk action error: " + error.message);

        } finally {
            processing = false;

            getArchiveCheckboxes().forEach(checkbox => {
                checkbox.disabled = false;
            });

            updateArchiveSelection();
        }
    }

    retrieveButton.addEventListener("click", () => {
        processSelectedArchives("restore");
    });

    deleteButton.addEventListener("click", () => {
        processSelectedArchives("delete");
    });

    updateArchiveSelection();
}
