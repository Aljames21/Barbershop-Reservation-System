
(() => {
  "use strict";

  if (document.body.dataset.page !== "archives") return;

  const feedbackSection = document.getElementById("archived-feedback-section");
  const feedbackRows = document.getElementById("feedback-rows");
  const feedbackStatus = document.getElementById("feedback-status");
  const pagination = document.getElementById("feedback-archive-pagination");

  const selectAll = document.getElementById("select-all-feedback");
  const selectedCount = document.getElementById("feedback-selected-count");
  const retrieveButton = document.getElementById("retrieve-selected-feedback");
  const deleteButton = document.getElementById("delete-selected-feedback");

  if (
    !feedbackSection || !feedbackRows || !pagination ||
    !selectAll || !selectedCount || !retrieveButton || !deleteButton
  ) return;

  const PAGE_SIZE = 10;
  let feedbackRecords = [];
  let currentPage = 1;
  let loading = false;
  let processing = false;

  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const initialsFor = name => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0] || "?").slice(0, 2).toUpperCase();
  };

  const submittedDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
  };

  async function feedbackFetch(path, options = {}) {
    const response = await fetch(
      "https://barbershop-reservation-system.onrender.com/api" + path,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionStorage.getItem("adminToken"),
          ...options.headers
        }
      }
    );

    if (response.status === 401) {
      sessionStorage.clear();
      window.location.href = "login.html";
      throw new Error("Admin session expired.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || result.error ||
        `Request failed (${response.status}).`
      );
    }

    return result;
  }

  function getCheckboxes() {
    return [...feedbackRows.querySelectorAll(
      ".archived-feedback-checkbox"
    )];
  }

  function getSelectedIds() {
    return getCheckboxes()
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.dataset.id);
  }

  function updateSelection() {
    const checkboxes = getCheckboxes();
    const selected = getSelectedIds().length;

    selectedCount.textContent = `${selected} selected`;

    retrieveButton.disabled = loading || processing || selected === 0;
    deleteButton.disabled = loading || processing || selected === 0;
    selectAll.disabled = loading || processing || checkboxes.length === 0;

    selectAll.checked =
      checkboxes.length > 0 &&
      selected === checkboxes.length;

    selectAll.indeterminate =
      selected > 0 && selected < checkboxes.length;
  }

  function renderFeedback() {
    const totalPages = Math.ceil(feedbackRecords.length / PAGE_SIZE);

    currentPage = totalPages === 0
      ? 1
      : Math.min(Math.max(currentPage, 1), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const visibleRecords = feedbackRecords.slice(start, start + PAGE_SIZE);

    feedbackRows.innerHTML = visibleRecords.map(item => {
      const appointment = item.appointment || {};
      const name = appointment.customerName || item.customerName || "Customer";
      const service = appointment.service || item.service || "-";
      const previousStatus = item.archivedFromStatus || "Flagged";
      const rating = Math.max(
        0,
        Math.min(5, Math.floor(Number(item.rating) || 0))
      );

      return `
        <tr>
          <td>
            <input
              type="checkbox"
              class="archived-feedback-checkbox"
              data-id="${escapeHtml(item._id)}"
              aria-label="Select archived feedback"
            >
          </td>

          <td>
            <div class="feedback-customer-cell">
              <span class="feedback-initials">${escapeHtml(initialsFor(name))}</span>
              <span>${escapeHtml(name)}</span>
            </div>
          </td>

          <td>
            <span class="feedback-admin-stars"
                  aria-label="${rating} out of 5 stars">
              ${"★".repeat(rating)}
            </span>
          </td>

          <td class="feedback-comment-cell">
            ${escapeHtml(item.comment)}
          </td>

          <td>${escapeHtml(service)}</td>

          <td>${escapeHtml(submittedDate(item.createdAt))}</td>

          <td>
            <span class="tag feedback-${escapeHtml(
              String(previousStatus).toLowerCase()
            )}">
              ${escapeHtml(previousStatus)}
            </span>
          </td>

        </tr>
      `;
    }).join("") ||
      '<tr><td colspan="7" class="empty">There is no archived feedback.</td></tr>';

    pagination.innerHTML = `
      <button type="button"
              class="pagination-nav"
              data-feedback-page="${currentPage - 1}"
              ${currentPage <= 1 || totalPages === 0 ? "disabled" : ""}>
        Previous
      </button>

      <span>Page ${totalPages === 0 ? 0 : currentPage} of ${totalPages}</span>

      <button type="button"
              class="pagination-nav"
              data-feedback-page="${currentPage + 1}"
              ${currentPage >= totalPages || totalPages === 0 ? "disabled" : ""}>
        Next
      </button>
    `;

    updateSelection();
  }

  async function loadFeedback() {
    if (loading) return;

    loading = true;
    feedbackStatus.textContent = "";

    feedbackRows.innerHTML =
      '<tr><td colspan="7" class="empty">Loading archived feedback...</td></tr>';

    updateSelection();

    try {
      const result = await feedbackFetch("/feedback/admin/archived");

      if (!Array.isArray(result)) {
        throw new Error("Invalid archived feedback response.");
      }

      feedbackRecords = result;
      renderFeedback();

    } catch (error) {
      console.error("Archived feedback error:", error);
      feedbackStatus.textContent = error.message;

      feedbackRows.innerHTML =
        '<tr><td colspan="7" class="empty">Unable to load archived feedback.</td></tr>';

    } finally {
      loading = false;
      updateSelection();
    }
  }

  async function processFeedback(ids, action) {
    if (processing || loading || ids.length === 0) return;

    const deleting = action === "delete";

    const message = deleting
      ? `Permanently delete ${ids.length} selected feedback record(s)? This cannot be undone.`
      : `Restore ${ids.length} selected feedback record(s) to the main Feedback page?`;

    if (!confirm(message)) return;

    processing = true;
    feedbackStatus.textContent = "";
    updateSelection();

    getCheckboxes().forEach(checkbox => {
      checkbox.disabled = true;
    });

    let successful = 0;
    const failures = [];

    try {
      for (const id of ids) {
        try {
          await feedbackFetch(
            `/feedback/${encodeURIComponent(id)}${deleting ? "" : "/restore"}`,
            { method: deleting ? "DELETE" : "PATCH" }
          );

          successful++;

        } catch (error) {
          failures.push(`${id}: ${error.message}`);
        }
      }

      await loadFeedback();

      alert(
        `${successful} feedback record(s) ${
          deleting ? "deleted" : "restored"
        } successfully.` +
        (failures.length
          ? `\n${failures.length} failed:\n${failures.join("\n")}`
          : "")
      );

    } catch (error) {
      feedbackStatus.textContent = error.message;

    } finally {
      processing = false;

      getCheckboxes().forEach(checkbox => {
        checkbox.disabled = false;
      });

      updateSelection();
    }
  }

  document.querySelectorAll("[data-archive-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;

      const selectedTab = tab.dataset.archiveTab;

      document.querySelectorAll("[data-archive-tab]").forEach(button => {
        button.classList.toggle("active", button === tab);
      });

     
        [
            "archived-appointments-section",
            "archived-feedback-section",
            "archived-barbers-section",
            "archived-services-section"
        ].forEach(id => {
            const section = document.getElementById(id);

            if (section) {
                section.hidden =
                    id !== `archived-${selectedTab}-section`;
            }
        });


      if (selectedTab === "feedback") {
        loadFeedback();
      }
    });
  });

  selectAll.addEventListener("change", () => {
    getCheckboxes().forEach(checkbox => {
      checkbox.checked = selectAll.checked;
    });

    updateSelection();
  });

  feedbackRows.addEventListener("change", event => {
    if (event.target.matches(".archived-feedback-checkbox")) {
      updateSelection();
    }
  });

  pagination.addEventListener("click", event => {
    if (processing || loading) return;

    const button = event.target.closest("[data-feedback-page]");
    if (!button || button.disabled) return;

    currentPage = Number(button.dataset.feedbackPage);
    renderFeedback();
  });

  retrieveButton.addEventListener("click", () => {
    processFeedback(getSelectedIds(), "restore");
  });

  deleteButton.addEventListener("click", () => {
    processFeedback(getSelectedIds(), "delete");
  });

  feedbackRows.addEventListener("click", async event => {
    if (processing || loading) return;

    const button = event.target.closest("[data-feedback-action]");
    if (!button || button.disabled) return;

    const { feedbackAction: action, id } = button.dataset;

    if (!["restore", "delete"].includes(action) || !id) return;

    const message = action === "delete"
      ? "Permanently delete this feedback? This cannot be undone."
      : "Restore this feedback to the main Feedback page?";

    if (!confirm(message)) return;

    processing = true;
    button.disabled = true;
    feedbackStatus.textContent = "";
    updateSelection();

    try {
      await feedbackFetch(
        `/feedback/${encodeURIComponent(id)}${action === "restore" ? "/restore" : ""}`,
        { method: action === "restore" ? "PATCH" : "DELETE" }
      );

      await loadFeedback();

    } catch (error) {
      feedbackStatus.textContent = error.message;

    } finally {
      processing = false;

      if (button.isConnected) {
        button.disabled = false;
      }

      updateSelection();
    }
  });

  updateSelection();
})();
