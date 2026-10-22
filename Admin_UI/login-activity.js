const API_URL = "https://barbershop-reservation-system.onrender.com/api";
const rows = document.getElementById("activity-rows");
const message = document.getElementById("activity-message");
const pageLabel = document.getElementById("page-label");
const previousButton = document.getElementById("previous-page");
const nextButton = document.getElementById("next-page");
const resultFilter = document.getElementById("activity-result-filter");

const limit = 25;
let currentPage = 1;
let totalPages = 1;

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
            addCell(row, item.role);
            addCell(
                row,
                new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila"
                }).format(new Date(item.createdAt))
            );
            addCell(row, item.result);
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

loadActivity();
