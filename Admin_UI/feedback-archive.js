const API_URL = "https://barbershop-reservation-system.onrender.com/api";
const feedbackRows = document.getElementById("feedback-rows");
const feedbackStatus = document.getElementById("feedback-status");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function initialsFor(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

function submittedDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function adminFetch(path, options = {}) {
  const token = sessionStorage.getItem("adminToken");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  if (response.status === 401) {
    sessionStorage.clear();
    window.location.href = "index.html";
    throw new Error("Your admin session has expired. Please sign in again.");
  }

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || `Request failed (${response.status}).`);
  }

  return result;
}

function renderFeedback(feedback) {
  const rows = feedback.map((item) => {
    const appointment = item.appointment || {};
    const name = appointment.customerName || "Appointment unavailable";
    const previousStatus = item.archivedFromStatus || "Flagged";

    return `
      <tr>
        <td>
          <span class="feedback-initials">${escapeHtml(initialsFor(name))}</span>
          ${escapeHtml(name)}
        </td>
        <td><span class="feedback-admin-stars" aria-label="${escapeHtml(item.rating)} out of 5 stars">${"★".repeat(Math.max(0, Math.min(5, Number(item.rating) || 0)))}</span></td>
        <td class="feedback-comment-cell">${escapeHtml(item.comment)}</td>
        <td>${escapeHtml(appointment.service || "-")}</td>
        <td>${escapeHtml(submittedDate(item.createdAt))}</td>
        <td><span class="tag feedback-${escapeHtml(String(previousStatus).toLowerCase())}">${escapeHtml(previousStatus)}</span></td>
        <td class="feedback-actions">
          <button data-action="restore" data-id="${escapeHtml(item._id)}">Restore</button>
          <button class="light" data-action="delete" data-id="${escapeHtml(item._id)}">Delete</button>
        </td>
      </tr>
    `;
  });

  feedbackRows.innerHTML = rows.join("") ||
    '<tr><td colspan="7" class="empty">There is no archived feedback.</td></tr>';
}

async function loadArchivedFeedback() {
  feedbackStatus.textContent = "";

  try {
    const feedback = await adminFetch("/feedback/admin/archived");
    renderFeedback(feedback);
  } catch (error) {
    console.error("Archived feedback load error:", error);
    feedbackRows.innerHTML =
      '<tr><td colspan="7" class="empty">Unable to load archived feedback.</td></tr>';
    feedbackStatus.textContent = error.message;
  }
}

feedbackRows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const { action, id } = button.dataset;
  const confirmation = action === "delete"
    ? "Delete this feedback permanently?"
    : "Restore this feedback to the main feedback list?";

  if (!window.confirm(confirmation)) return;

  button.disabled = true;
  feedbackStatus.textContent = "";

  try {
    if (action === "delete") {
      await adminFetch(`/feedback/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
    } else {
      await adminFetch(`/feedback/${encodeURIComponent(id)}/restore`, {
        method: "PATCH"
      });
    }

    await loadArchivedFeedback();
  } catch (error) {
    console.error("Archived feedback moderation error:", error);
    feedbackStatus.textContent = error.message;
    button.disabled = false;
  }
});

loadArchivedFeedback();
