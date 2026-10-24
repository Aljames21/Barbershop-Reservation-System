const API_URL = "https://barbershop-reservation-system.onrender.com/api";
const rows = document.getElementById("activity-rows");
const message = document.getElementById("activity-message");
const pageLabel = document.getElementById("page-label");
const previousButton = document.getElementById("previous-page");
const nextButton = document.getElementById("next-page");
const resultFilter = document.getElementById("activity-result-filter");
const searchInput = document.getElementById("activity-search");
const dateFilter = document.getElementById("activity-date-filter");
const resetFiltersButton = document.getElementById("reset-activity-filters");

const limit = 10;
let currentPage = 1;
let totalPages = 1;
let searchTimer;

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
}

async function loadActivity() {
    const token = sessionStorage.getItem("adminToken");

    if (!token) {
        window.location.href = "index.html";
        return;
    }

    message.textContent = "Loading login activity...";
    rows.replaceChildren();

    const query = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit)
    });

    if (resultFilter.value) {
        query.set("result", resultFilter.value);
    }

    if (searchInput.value.trim()) {
        query.set("search", searchInput.value.trim());
    }

    if (dateFilter.value) {
        query.set("date", dateFilter.value);
    }

    try {
        const response = await fetch(
            `${API_URL}/admin/login-activity?${query.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            sessionStorage.removeItem("adminToken");
            sessionStorage.removeItem("admin");
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Unable to load login activity.");
        }

        for (const item of data.items) {
            const row = document.createElement("tr");

            addCell(row, item.accountName);
            const roleCell = document.createElement("td");
            roleCell.textContent = item.role;

        if (item.role === "Admin") {
            roleCell.classList.add("login-activity-admin");
}       else if 
            (item.role === "Unknown")

{
    roleCell.classList.add("login-activity-unknown");
}

row.appendChild(roleCell);
            addCell(
                row,
                new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila"
                }).format(new Date(item.createdAt))
            );
            const resultCell = document.createElement("td");
            resultCell.textContent = item.result;
            resultCell.classList.add(
            item.result === "Success"
        ? "login-activity-success"
        : "login-activity-failed"
);
row.appendChild(resultCell);
            rows.appendChild(row);
        }

        totalPages = Math.max(data.totalPages, 1);
        pageLabel.textContent = `Page ${data.page} of ${totalPages}`;
        previousButton.disabled = currentPage <= 1;
        nextButton.disabled = currentPage >= totalPages;
        message.textContent = data.total
            ? `${data.total} login attempt(s)`
            : "No login activity yet.";
    } catch (error) {
        message.textContent = error.message;
    }
}

previousButton.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage -= 1;
        loadActivity();
    }
});

nextButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
        currentPage += 1;
        loadActivity();
    }
});

resultFilter.addEventListener("change", () => {
    currentPage = 1;
    loadActivity();
});

searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
        currentPage = 1;
        loadActivity();
    }, 250);
});

dateFilter.addEventListener("change", () => {
    currentPage = 1;
    loadActivity();
});

resetFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    dateFilter.value = "";
    resultFilter.value = "";
    currentPage = 1;
    loadActivity();
});

loadActivity();
