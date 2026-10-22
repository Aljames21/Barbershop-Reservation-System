
(() => {
    "use strict";

    if (document.body.dataset.page !== "archives") return;

    const API = "https://barbershop-reservation-system.onrender.com/api";
    const PAGE_SIZE = 10;

    const configs = {
        barbers: {
            endpoint: "/barbers",
            columns: 5,
            section: "archived-barbers-section",
            rows: "archived-barbers-rows",
            status: "barbers-archive-status",
            pagination: "barbers-archive-pagination",
            selectAll: "select-all-barbers",
            count: "barbers-selected-count",
            retrieve: "retrieve-selected-barbers",
            delete: "delete-selected-barbers"
        },
        services: {
            endpoint: "/services",
            columns: 7,
            section: "archived-services-section",
            rows: "archived-services-rows",
            status: "services-archive-status",
            pagination: "services-archive-pagination",
            selectAll: "select-all-services",
            count: "services-selected-count",
            retrieve: "retrieve-selected-services",
            delete: "delete-selected-services"
        }
    };

    const escapeHtml = value =>
        String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    const dateText = value => {
        if (!value) return "-";
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? "-"
            : date.toLocaleDateString("en-PH", {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
    };

    async function request(path, options = {}) {
        const response = await fetch(API + path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " +
                    sessionStorage.getItem("adminToken"),
                ...options.headers
            }
        });

        if (response.status === 401) {
            sessionStorage.clear();
            window.location.href = "login.html";
            throw new Error("Admin session expired.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || `Request failed (${response.status}).`
            );
        }

        return data;
    }

    Object.entries(configs).forEach(([type, config]) => {
        const section = document.getElementById(config.section);
        const rows = document.getElementById(config.rows);
        const status = document.getElementById(config.status);
        const pagination = document.getElementById(config.pagination);
        const selectAll = document.getElementById(config.selectAll);
        const count = document.getElementById(config.count);
        const retrieve = document.getElementById(config.retrieve);
        const remove = document.getElementById(config.delete);

        if (
            !section || !rows || !status || !pagination ||
            !selectAll || !count || !retrieve || !remove
        ) {
            console.error(`Missing ${type} archive HTML elements.`);
            return;
        }

        let records = [];
        let page = 1;
        let loading = false;
        let processing = false;

        function checkboxes() {
            return [...rows.querySelectorAll(
                'input[type="checkbox"][data-id]'
            )];
        }

        function selectedIds() {
            return checkboxes()
                .filter(input => input.checked)
                .map(input => input.dataset.id);
        }

        function updateSelection() {
            const inputs = checkboxes();
            const selected = selectedIds().length;

            count.textContent = `${selected} selected`;

            selectAll.checked =
                inputs.length > 0 && selected === inputs.length;

            selectAll.indeterminate =
                selected > 0 && selected < inputs.length;

            selectAll.disabled =
                loading || processing || inputs.length === 0;

            retrieve.disabled =
                loading || processing || selected === 0;

            remove.disabled =
                loading || processing || selected === 0;
        }

        function render() {
            const totalPages = Math.ceil(records.length / PAGE_SIZE);

            page = totalPages === 0
                ? 1
                : Math.min(page, totalPages);

            const visible = records.slice(
                (page - 1) * PAGE_SIZE,
                page * PAGE_SIZE
            );

            rows.innerHTML = visible.map(item => {
                const checkbox = `
                    <td>
                        <input type="checkbox"
                               data-id="${escapeHtml(item._id)}"
                               aria-label="Select ${type} record">
                    </td>
                `;

                if (type === "barbers") {
                    return `
                        <tr>
                            ${checkbox}
                            <td>${escapeHtml(item.name)}</td>
                            <td>${escapeHtml(item.specialization)}</td>
                            <td>${escapeHtml(item.status)}</td>
                            <td>${escapeHtml(dateText(item.archivedAt))}</td>
                        </tr>
                    `;
                }

                return `
                    <tr>
                        ${checkbox}
                        <td>${escapeHtml(item.name)}</td>
                        <td>${escapeHtml(item.description || "-")}</td>
                        <td>₱${escapeHtml(
                            Number(item.price || 0).toLocaleString("en-PH")
                        )}</td>
                        <td>${escapeHtml(item.duration)} min</td>
                        <td>${escapeHtml(item.status)}</td>
                        <td>${escapeHtml(dateText(item.archivedAt))}</td>
                    </tr>
                `;
            }).join("") || `
                <tr>
                    <td colspan="${config.columns}" class="empty">
                        No archived ${type} found.
                    </td>
                </tr>
            `;

            pagination.innerHTML = `
                <button type="button"
                        class="pagination-nav"
                        data-page="${page - 1}"
                        ${page <= 1 || totalPages === 0 ? "disabled" : ""}>
                    Previous
                </button>

                <span>Page ${totalPages === 0 ? 0 : page} of ${totalPages}</span>

                <button type="button"
                        class="pagination-nav"
                        data-page="${page + 1}"
                        ${page >= totalPages || totalPages === 0 ? "disabled" : ""}>
                    Next
                </button>
            `;

            updateSelection();
        }

        async function load() {
            if (loading) return;

            loading = true;
            status.textContent = "";
            rows.innerHTML = `
                <tr>
                    <td colspan="${config.columns}" class="empty">
                        Loading archived ${type}...
                    </td>
                </tr>
            `;
            updateSelection();

            try {
                const result = await request(
                    `${config.endpoint}/archive/list`
                );

                if (!Array.isArray(result)) {
                    throw new Error("Invalid archive response.");
                }

                records = result;
                render();
            } catch (error) {
                console.error(`${type} archive error:`, error);
                status.textContent = error.message;
                rows.innerHTML = `
                    <tr>
                        <td colspan="${config.columns}" class="empty">
                            Unable to load archived ${type}.
                        </td>
                    </tr>
                `;
            } finally {
                loading = false;
                updateSelection();
            }
        }

        selectAll.addEventListener("change", () => {
            checkboxes().forEach(input => {
                input.checked = selectAll.checked;
            });
            updateSelection();
        });

        rows.addEventListener("change", event => {
            if (event.target.matches('input[type="checkbox"][data-id]')) {
                updateSelection();
            }
        });

        pagination.addEventListener("click", event => {
            if (loading || processing) return;

            const button = event.target.closest("[data-page]");
            if (!button || button.disabled) return;

            page = Number(button.dataset.page);
            render();
        });

        async function bulkAction(action) {
            if (loading || processing) return;

            const ids = selectedIds();
            if (!ids.length) return;

            const deleting = action === "delete";

            const message = deleting
                ? `Permanently delete ${ids.length} selected ${type}? This cannot be undone.`
                : `Retrieve ${ids.length} selected ${type}?`;

            if (!confirm(message)) return;

            processing = true;
            status.textContent = "";
            updateSelection();

            checkboxes().forEach(input => {
                input.disabled = true;
            });

            let success = 0;
            const errors = [];

            try {
                for (const id of ids) {
                    try {
                        await request(
                            `${config.endpoint}/archive/${encodeURIComponent(id)}/${
                                deleting ? "permanent" : "restore"
                            }`,
                            { method: deleting ? "DELETE" : "PATCH" }
                        );
                        success++;
                    } catch (error) {
                        errors.push(`${id}: ${error.message}`);
                    }
                }

                await load();

                alert(
                    `${success} ${type} record(s) ${
                        deleting ? "permanently deleted" : "retrieved"
                    }.` +
                    (errors.length
                        ? `\n${errors.length} failed:\n${errors.join("\n")}`
                        : "")
                );
            } finally {
                processing = false;
                updateSelection();
            }
        }

        retrieve.addEventListener("click", () => bulkAction("restore"));
        remove.addEventListener("click", () => bulkAction("delete"));

        const tab = document.querySelector(
            `[data-archive-tab="${type}"]`
        );

        tab?.addEventListener("click", () => {
            if (tab.disabled) return;

            document.querySelectorAll("[data-archive-tab]").forEach(button => {
                button.classList.toggle("active", button === tab);
            });

            [
                "archived-appointments-section",
                "archived-feedback-section",
                "archived-barbers-section",
                "archived-services-section"
            ].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.hidden = element !== section;
            });

            load();
        });

        updateSelection();
    });
})();
