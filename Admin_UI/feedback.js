const API_URL = "https://barbershop-reservation-system.onrender.com/api";
const feedbackRows = document.getElementById("feedback-rows");
const feedbackStatus = document.getElementById("feedback-status");
const selectedFeedbackIds = new Set();
let activeFeedback = [];

function updateFeedbackSelection() {
  const checkboxes = [...feedbackRows.querySelectorAll(".active-feedback-checkbox")];
  const selectedOnPage = checkboxes.filter((checkbox) => checkbox.checked).length;
  const selectAll = document.getElementById("select-all-active-feedback");
  const archiveButton = document.getElementById("archive-selected-feedback");

  document.getElementById("active-feedback-selected-count").textContent =
    `${selectedFeedbackIds.size} selected`;
  archiveButton.disabled = selectedFeedbackIds.size === 0;
  selectAll.checked = checkboxes.length > 0 && selectedOnPage === checkboxes.length;
  selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < checkboxes.length;
}

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
      Authorization: `Bearer ${token}`
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

const FEEDBACK_PAGE_SIZE = 10;
const feedbackPageController = (() => {
  const container = document.getElementById("feedback-pagination");

  if (!container) {
    return null;
  }

  const state = {
    currentPage: 1,
    totalPages: 1,
    editMode: false,
    onPageChange: null,
    refresh() {
      const hasRecords = state.totalPages > 0;
      prevButton.disabled = !hasRecords || state.currentPage <= 1;
      nextButton.disabled = !hasRecords || state.currentPage >= state.totalPages;
      indicator.textContent = state.totalPages === 0 ? "Page 0 of 0" : `Page ${state.currentPage} of ${state.totalPages}`;
      if (!state.editMode) {
        editor.hidden = true;
        indicator.hidden = false;
      }
      message.textContent = "";
    }
  };

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
    if (state.totalPages === 0) {
      return;
    }

    state.editMode = true;
    editor.hidden = false;
    indicator.hidden = true;
    input.value = String(state.currentPage);
    input.focus();
    input.select();
  });

  goButton.addEventListener("click", () => {
    const value = input.value.trim();

    if (!value || !/^\d+$/.test(value)) {
      message.textContent = "Please enter a valid page number.";
      input.focus();
      return;
    }

    const numericValue = Number.parseInt(value, 10);

    if (numericValue <= 0 || numericValue > state.totalPages) {
      message.textContent = `Enter a page between 1 and ${state.totalPages}.`;
      input.focus();
      return;
    }

    state.currentPage = numericValue;
    state.editMode = false;
    editor.hidden = true;
    indicator.hidden = false;
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
      state.editMode = false;
      editor.hidden = true;
      indicator.hidden = false;
      input.value = String(state.currentPage || 1);
      message.textContent = "";
    }
  });

  editor.append(input, goButton);
  container.append(prevButton, indicator, editor, nextButton, message);
  state.refresh();
  return state;
})();

function renderFeedback(feedback) {
  renderFeedbackRatingSummary(feedback);
  const controller = feedbackPageController;
  const startIndex = controller && controller.totalPages > 0 ? (controller.currentPage - 1) * FEEDBACK_PAGE_SIZE : 0;
  const pageStart = controller ? Math.max(0, startIndex) : 0;
  const pagedFeedback = controller
    ? feedback.slice(pageStart, pageStart + FEEDBACK_PAGE_SIZE)
    : feedback.slice(0, FEEDBACK_PAGE_SIZE);

  if (controller) {
    controller.totalPages = feedback.length > 0 ? Math.ceil(feedback.length / FEEDBACK_PAGE_SIZE) : 0;
    controller.currentPage = controller.totalPages === 0 ? 0 : Math.min(controller.currentPage || 1, controller.totalPages);
    controller.refresh();
  }

  const rows = pagedFeedback.map((item) => {
    const appointment = item.appointment || {};
    const name = appointment.customerName || item.customerName || "Customer";
    const statusClass = String(item.status || "Pending").toLowerCase();
    const approveAction = item.status === "Approved"
      ? ""
      : `<button data-action="approve" data-id="${escapeHtml(item._id)}">Approve</button>`;
    const archiveAction = `<button class="light" data-action="archive" data-id="${escapeHtml(item._id)}">Archive</button>`;

    return `
      <tr>
        <td>
          <input
            type="checkbox"
            class="active-feedback-checkbox"
            data-id="${escapeHtml(item._id)}"
            aria-label="Select feedback from ${escapeHtml(name)}"
            ${selectedFeedbackIds.has(String(item._id)) ? "checked" : ""}
          >
        </td>
        <td>
          <span class="feedback-initials">${escapeHtml(initialsFor(name))}</span>
          ${escapeHtml(name)}
        </td>
        <td><span class="feedback-admin-stars" aria-label="${escapeHtml(item.rating)} out of 5 stars">${"★".repeat(Math.max(0, Math.min(5, Number(item.rating) || 0)))}</span></td>
        <td class="feedback-comment-cell">${escapeHtml(item.comment)}</td>
        <td>${escapeHtml(appointment.service || "-")}</td>
        <td>${escapeHtml(submittedDate(item.createdAt))}</td>
        <td><span class="tag feedback-${escapeHtml(statusClass)}">${escapeHtml(item.status || "Pending")}</span></td>
        <td class="feedback-actions">
          ${approveAction}
          ${archiveAction}
        </td>
      </tr>
    `;
  });

  feedbackRows.innerHTML = rows.join("") ||
    '<tr><td colspan="8" class="empty">No feedback has been submitted yet.</td></tr>';
  updateFeedbackSelection();
}

function renderFeedbackRatingSummary(feedback) {
  const summary = summarizeFeedbackRatings(feedback);
  const average = document.getElementById("feedback-average-rating");
  const reviewCount = document.getElementById("feedback-approved-count");
  const distribution = document.getElementById("feedback-rating-distribution");

  average.textContent = summary.average === null
    ? "—"
    : `${summary.average.toFixed(1)} / 5`;
  reviewCount.textContent = String(summary.count);
  distribution.innerHTML = summary.distribution.map(({ stars, count }) => {
    const percentage = summary.count
      ? (count / summary.count) * 100
      : 0;

    return `
      <div class="feedback-rating-row">
        <span>${stars} ${stars === 1 ? "star" : "stars"}</span>
        <div class="feedback-rating-track" aria-hidden="true">
          <span style="width: ${percentage}%"></span>
        </div>
        <span>${count}</span>
      </div>
    `;
  }).join("");
}

async function loadFeedback() {
  feedbackStatus.textContent = "";

  if (feedbackPageController) {
    feedbackPageController.onPageChange = loadFeedback;
  }

  try {
    const feedback = await adminFetch("/feedback/admin");
    activeFeedback = feedback;
    const activeIds = new Set(feedback.map((item) => String(item._id)));
    selectedFeedbackIds.forEach((id) => {
      if (!activeIds.has(id)) selectedFeedbackIds.delete(id);
    });
    renderFeedback(feedback);
  } catch (error) {
    console.error("Admin feedback load error:", error);
    feedbackRows.innerHTML =
      '<tr><td colspan="8" class="empty">Unable to load feedback.</td></tr>';
    updateFeedbackSelection();
    feedbackStatus.textContent = error.message;
  }
}

document.getElementById("select-all-active-feedback").addEventListener("change", (event) => {
  feedbackRows.querySelectorAll(".active-feedback-checkbox").forEach((checkbox) => {
    checkbox.checked = event.target.checked;
    if (checkbox.checked) {
      selectedFeedbackIds.add(String(checkbox.dataset.id));
    } else {
      selectedFeedbackIds.delete(String(checkbox.dataset.id));
    }
  });
  updateFeedbackSelection();
});

feedbackRows.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".active-feedback-checkbox");
  if (!checkbox) return;

  if (checkbox.checked) {
    selectedFeedbackIds.add(String(checkbox.dataset.id));
  } else {
    selectedFeedbackIds.delete(String(checkbox.dataset.id));
  }
  updateFeedbackSelection();
});

document.getElementById("archive-selected-feedback").addEventListener("click", async (event) => {
  const selected = activeFeedback.filter((item) =>
    selectedFeedbackIds.has(String(item._id))
  );
  if (!selected.length) return;
  if (!window.confirm(`Move ${selected.length} selected feedback item(s) to the archive?`)) return;

  const button = event.currentTarget;
  button.disabled = true;
  feedbackStatus.textContent = "";
  const failures = [];

  for (const item of selected) {
    try {
      await adminFetch(`/feedback/${encodeURIComponent(item._id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Archived" })
      });
      selectedFeedbackIds.delete(String(item._id));
    } catch (error) {
      failures.push(`${item._id}: ${error.message}`);
    }
  }

  await loadFeedback();
  if (failures.length) {
    console.error("Some feedback items could not be archived:", failures);
    feedbackStatus.textContent =
      `${selected.length - failures.length} archived; ${failures.length} failed. ${failures.join(" ")}`;
  } else {
    feedbackStatus.textContent = `${selected.length} feedback item(s) moved to the archive.`;
  }
  updateFeedbackSelection();
});

feedbackRows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const { action, id } = button.dataset;

  button.disabled = true;
  feedbackStatus.textContent = "";

  try {
    const status = action === "approve" ? "Approved" : "Archived";
    await adminFetch(`/feedback/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    await loadFeedback();
  } catch (error) {
    console.error("Feedback moderation error:", error);
    feedbackStatus.textContent = error.message;
    button.disabled = false;
  }
});

loadFeedback();
