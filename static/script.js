let TASKS = [];
let SHARED_TASKS = [];
let CATEGORIES = [];
let CURRENT_PAGE = 1;
let TOTAL_PAGES = 1;
let LIMIT = 7;
let CURRENT_SORT = "created";
let SELECTED_TASK_IDS = new Set();
const isAuthPage =
    window.location.pathname === "/login" ||
    window.location.pathname === "/register";

document.addEventListener("DOMContentLoaded", () => {
    if (!isAuthPage) {
        loadTasks();
        loadCategories();
    }

    const addBtn = document.getElementById("open-add");
    if (addBtn) {
        addBtn.addEventListener("click", () => window.location.href = "/add");
    }

    const viewFilter = document.getElementById("view-filter");
    if (viewFilter) {
        viewFilter.addEventListener("change", renderDashboard);
    }

    const tableSearch = document.getElementById("table-search");
    if (tableSearch) {
        tableSearch.addEventListener("input", renderTable);
    }

    const managerSearch = document.getElementById("task-search");
    if (managerSearch) {
        managerSearch.addEventListener("input", renderManager);
    }

    const categoryFilter = document.getElementById("category-filter");
    if (categoryFilter) {
        categoryFilter.addEventListener("change", () => {
            renderTable();
            renderManager();
        });
    }

    ["filter-status", "filter-priority", "filter-category"].forEach(id => {
        document.getElementById(id)?.addEventListener("change", () => renderTable());
    });

    const clearBtn = document.getElementById("clear-filters");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            const s = document.getElementById("filter-status");
            const p = document.getElementById("filter-priority");
            const c = document.getElementById("filter-category");
            const q = document.getElementById("table-search");
            if (s) s.value = "";
            if (p) p.value = "";
            if (c) c.value = "";
            if (q) q.value = "";
            renderTable();
        });
    }
});


// ================= LOAD TASKS =================
function loadTasks(page = 1) {

    CURRENT_PAGE = page;

    const isDashboard = document.getElementById("dashboard-cards");

    let url = "/api/tasks";
    if (!isDashboard) {
        url += `?page=${CURRENT_PAGE}&limit=${LIMIT}&sort=${CURRENT_SORT}`;
    }

    fetch(url, { credentials: "include" })
        .then(async res => {
            if (res.redirected || res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Failed to fetch tasks");
            return res.json();
        })
        .then(data => {
            if (!data) return;

            if (Array.isArray(data)) {
                TASKS = data;
                SHARED_TASKS = [];
                TOTAL_PAGES = 1;
            } else {
                TASKS = data.tasks || [];
                SHARED_TASKS = data.shared_tasks || [];
                TOTAL_PAGES = data.total_pages || 1;
            }

            // Remove deselected ids that no longer exist on this page
            const validIds = new Set(TASKS.map(t => t.id));
            SELECTED_TASK_IDS.forEach(id => {
                if (!validIds.has(id)) SELECTED_TASK_IDS.delete(id);
            });

            if (document.getElementById("dashboard-cards")) renderDashboard();
            if (document.getElementById("manager-list")) renderManager();
            if (document.getElementById("task-table-body")) renderTable();
            if (document.getElementById("shared-tasks-list")) renderSharedTasks();

            renderPagination();
            renderBulkToolbar();
        })
        .catch(err => console.error("LOAD ERROR:", err));
}


// ================= LOAD CATEGORIES =================
function loadCategories() {

    fetch("/api/categories", { credentials: "include" })
        .then(async res => {
            if (res.redirected || res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Server error");
            return res.json();
        })
        .then(data => {
            if (!data) return;
            CATEGORIES = Array.isArray(data) ? data : data.categories || [];
            populateCategoryFilter();
            populateTaskCategorySelect();
            populateTableCategoryFilter();
            renderCategories();
        })
        .catch(err => console.error("CATEGORY LOAD ERROR:", err));
}


function populateTableCategoryFilter() {
    const sel = document.getElementById("filter-category");
    if (!sel) return;
    sel.querySelectorAll("option:not([value=''])").forEach(o => o.remove());
    CATEGORIES.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name;
        sel.appendChild(opt);
    });
}

function populateCategoryFilter() {
    const filter = document.getElementById("category-filter");
    if (!filter) return;
    filter.innerHTML = `<option value="all">All Categories</option>`;
    CATEGORIES.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        filter.appendChild(opt);
    });
}

function populateTaskCategorySelect(selectedId = null) {
    const select = document.getElementById("category");
    if (!select) return;
    select.innerHTML = `<option value="">Uncategorized</option>`;
    CATEGORIES.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        if (selectedId && String(c.id) === String(selectedId)) opt.selected = true;
        select.appendChild(opt);
    });
}

function addCategory() {
    const input = document.getElementById("category-name");
    if (!input) return;
    const name = input.value.trim();
    if (!name) return showError("Category name cannot be empty");

    fetch("/api/categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    })
        .then(async res => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to add category");
            return data;
        })
        .then(() => { showSuccess("Category added successfully"); input.value = ""; loadCategories(); })
        .catch(err => showError(err.message || "Failed to add category"));
}

function renderCategories() {
    const container = document.getElementById("category-list");
    if (!container) return;
    container.innerHTML = "";

    if (CATEGORIES.length === 0) {
        container.innerHTML = `<p class="muted">No categories found.</p>`;
        return;
    }

    CATEGORIES.forEach(category => {
        const taskCount = TASKS.filter(t => t.category_id === category.id).length;
        container.innerHTML += `
            <div class="manager-row">
                <div>
                    <strong>${escapeHtml(category.name)}</strong>
                    ${taskCount === 0
                ? `<span class="zero-task-badge">0 tasks</span>`
                : `<span class="muted"> — ${taskCount} task${taskCount > 1 ? "s" : ""}</span>`}
                </div>
                <div>
                    <span class="icon-btn" onclick="editCategory(${category.id})">✏️</span>
                    <span class="icon-btn" onclick="deleteCategory(${category.id})">🗑️</span>
                </div>
            </div>`;
    });
}

function editCategory(id) {
    const category = CATEGORIES.find(c => c.id === id);
    if (!category) return showError("Category not found");

    const newName = prompt("Enter new category name", category.name);
    if (!newName || !newName.trim()) return;

    fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName.trim() })
    })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(() => { showSuccess("Category updated successfully"); loadCategories(); })
        .catch(() => showError("Failed to update category"));
}

function deleteCategory(id) {
    if (!confirm("Delete this category?")) return;

    fetch(`/api/categories/${id}`, { method: "DELETE", credentials: "include" })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(() => { showSuccess("Category deleted successfully"); loadCategories(); loadTasks(); })
        .catch(() => showError("Failed to delete category"));
}

function toggleStatus(id, checked) {
    const status = checked ? "completed" : "pending";
    const task = TASKS.find(t => t.id === id);
    if (!task) return;

    fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            status,
            category_id: task.category_id,
            title: task.title,
            description: task.description,
            deadline: task.deadline,
            priority: task.priority
        })
    })
        .then(res => { if (!res.ok) throw new Error(); showSuccess(checked ? "Task marked as completed" : "Task marked as pending"); loadTasks(CURRENT_PAGE); })
        .catch(() => showError("Failed to update task status"));
}


// ================= DASHBOARD =================
function renderDashboard() {
    const container = document.getElementById("dashboard-cards");
    if (!container) return;
    container.innerHTML = "";

    const mode = document.getElementById("view-filter")?.value || "all";
    let tasks = [...TASKS];

    function getType(t) {
        if (!t.deadline) return "normal";
        const now = new Date();
        const due = new Date(t.deadline);
        if (t.status !== "completed" && due < now) return "overdue";
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(due); dueDate.setHours(0, 0, 0, 0);
        if (dueDate.getTime() === today.getTime()) return "today";
        const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
        if (due > now && due <= weekEnd) return "week";
        return "normal";
    }

    if (mode === "today") tasks = tasks.filter(t => getType(t) === "today");
    if (mode === "week") tasks = tasks.filter(t => getType(t) === "week");
    if (mode === "overdue") tasks = tasks.filter(t => getType(t) === "overdue");
    if (mode === "pending") tasks = tasks.filter(t => t.status === "pending");
    if (mode === "completed") tasks = tasks.filter(t => t.status === "completed");

    if (tasks.length === 0) {
        container.innerHTML = `<p class="muted">No tasks found.</p>`;
        return;
    }

    tasks.forEach(t => {
        const isCompleted = t.status === "completed";
        const badge = t.priority === "High" ? "priority-high" : t.priority === "Low" ? "priority-low" : "priority-medium";
        const type = getType(t);
        let statusLabel = "";
        if (type === "overdue") statusLabel = `<span class="status-badge red">Overdue</span>`;
        if (type === "today") statusLabel = `<span class="status-badge yellow">Today</span>`;
        if (type === "week") statusLabel = `<span class="status-badge green">This Week</span>`;

        container.innerHTML += `
            <div class="card task-${type} ${isCompleted ? 'row-completed' : ''}">
                <div class="card-head">
                    <span class="task-title ${isCompleted ? 'task-title-completed' : ''}">${escapeHtml(t.title)}</span>
                    <span class="priority-badge ${badge}">${t.priority}</span>
                </div>
                <div class="card-body">
                    <div>Due: ${t.deadline ? new Date(t.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : "-"}</div>
                    <div>Status: ${escapeHtml(t.status)}</div>
                    <div class="muted">Category: ${t.category || "Uncategorized"}</div>
                    ${statusLabel}
                </div>
                <div class="card-footer">
                    <span class="icon-btn" onclick="goEdit(${t.id})">✏️ Edit</span>
                    <span class="icon-btn" onclick="deleteTask(${t.id})">🗑️ Delete</span>
                </div>
            </div>`;
    });
}


// ================= RENDER TABLE =================
function renderTable() {
    const tbody = document.getElementById("task-table-body");
    if (!tbody) return;

    const search = document.getElementById("table-search")?.value.toLowerCase() || "";
    const status = document.getElementById("filter-status")?.value || "";
    const priority = document.getElementById("filter-priority")?.value || "";
    const catName = document.getElementById("filter-category")?.value || "";
    const categoryId = document.getElementById("category-filter")?.value || "all";

    let tasks = [...TASKS];
    if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search));
    if (status) tasks = tasks.filter(t => t.status === status);
    if (priority) tasks = tasks.filter(t => t.priority === priority);
    if (catName) tasks = tasks.filter(t => t.category === catName);
    if (categoryId !== "all" && !catName) tasks = tasks.filter(t => String(t.category_id) === categoryId);

    tbody.innerHTML = "";

    if (tasks.length === 0) {
        const activeFilters = [search, status, priority, catName].filter(Boolean);
        const msg = activeFilters.length > 0 ? "No tasks match the selected filters." : "No tasks found.";
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:28px 0;">
                    <span style="display:inline-block;background:#1e293b;border:1px solid #334155;
                        border-radius:8px;padding:14px 28px;color:#94a3b8;font-size:0.92rem;">
                        📭 ${msg}</span>
                </td>
            </tr>`;
        return;
    }

    tasks.forEach(t => {
        const isCompleted = t.status === "completed";
        tbody.innerHTML += `
            <tr class="${isCompleted ? 'row-completed' : ''}">
                <td>
                    <input type="checkbox"
                        class="bulk-select-checkbox"
                        title="Select for bulk action"
                        onclick="toggleBulkSelect(${t.id}, this.checked)"
                        ${SELECTED_TASK_IDS.has(t.id) ? "checked" : ""}
                        ${isCompleted ? 'data-completed="true"' : ''}>
                    <span class="${isCompleted ? 'task-title-completed' : ''}">${escapeHtml(t.title)}</span>
                </td>
                <td>${t.deadline ? new Date(t.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : "-"}</td>
                <td>${escapeHtml(t.priority)}</td>
                <td>
                    <span class="status-chip status-${t.status}">${escapeHtml(t.status).replace("_", " ")}</span>
                </td>
                <td>${t.category || "Uncategorized"}</td>
                <td><span class="icon-btn" onclick="goEdit(${t.id})">✏️</span></td>
                <td><span class="icon-btn" onclick="deleteTask(${t.id})">🗑️</span></td>
                <td><a class="icon-btn" href="/tasks/${t.id}" title="View Details">🔍</a></td>
            </tr>`;
    });
}


// ================= RENDER MANAGER =================
function renderManager() {
    const container = document.getElementById("manager-list");
    if (!container) return;

    const search = document.getElementById("task-search")?.value.toLowerCase() || "";
    const categoryId = document.getElementById("category-filter")?.value || "all";

    let tasks = TASKS.filter(t => t.title.toLowerCase().includes(search));
    if (categoryId !== "all") tasks = tasks.filter(t => String(t.category_id) === categoryId);

    container.innerHTML = "";

    if (tasks.length === 0) {
        container.innerHTML = `<p class="muted">No tasks found.</p>`;
        return;
    }

    tasks.forEach(t => {
        const isCompleted = t.status === "completed";
        container.innerHTML += `
            <div class="manager-row ${isCompleted ? 'row-completed' : ''}">
                <div>
                    <input type="checkbox"
                        class="bulk-select-checkbox"
                        title="Select for bulk action"
                        onclick="toggleBulkSelect(${t.id}, this.checked)"
                        ${SELECTED_TASK_IDS.has(t.id) ? "checked" : ""}
                        ${isCompleted ? 'data-completed="true"' : ''}>
                    <strong class="${isCompleted ? 'task-title-completed' : ''}">${escapeHtml(t.title)}</strong>
                    <span class="muted">
                        | Due: ${t.deadline ? new Date(t.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : "-"}
                        | Priority: ${escapeHtml(t.priority)}
                        | Category: ${t.category || "Uncategorized"}
                    </span>
                </div>
                <div>
                    <span class="status-chip status-${t.status}">${escapeHtml(t.status).replace("_", " ")}</span>
                    <span class="icon-btn" onclick="goEdit(${t.id})">✏️</span>
                    <span class="icon-btn" onclick="deleteTask(${t.id})">🗑️</span>
                    <a class="icon-btn" href="/tasks/${t.id}" title="View Details">🔍 Details</a>
                </div>
            </div>`;
    });
}


// ================= RENDER SHARED TASKS =================
function renderSharedTasks() {
    const section = document.getElementById("shared-section");
    const list = document.getElementById("shared-tasks-list");
    if (!list) return;

    if (!SHARED_TASKS || SHARED_TASKS.length === 0) {
        if (section) section.style.display = "none";
        else list.innerHTML = `<p class="muted">No tasks shared with you yet.</p>`;
        return;
    }

    if (section) section.style.display = "block";

    list.innerHTML = SHARED_TASKS.map(t => {
        const roleClass = t.shared_role === "Editor" ? "role-editor" : "role-viewer";
        const priClass = t.priority === "High" ? "pri-high" : t.priority === "Medium" ? "pri-medium" : "pri-low";
        const deadline = t.deadline
            ? new Date(t.deadline).toLocaleDateString("en-IN", { dateStyle: "medium" })
            : "No deadline";
        const editBtn = t.shared_role === "Editor"
            ? `<a class="btn-edit-shared" href="/tasks/${t.id}?tab=edit">✏️ Edit</a>`
            : "";

        return `
            <div class="shared-task-card">
                <div class="shared-task-info">
                    <div class="shared-task-title">${escapeHtml(t.title)}</div>
                    <div class="shared-task-meta">
                        <span>👤 Owner: <strong>${escapeHtml(t.owner_username)}</strong></span>
                        <span>📅 ${escapeHtml(deadline)}</span>
                        <span class="shared-priority ${priClass}">${escapeHtml(t.priority)}</span>
                        <span class="status-chip status-${t.status}">${escapeHtml(t.status).replace("_", " ")}</span>
                        <span class="role-badge ${roleClass}">${escapeHtml(t.shared_role)}</span>
                    </div>
                </div>
                <div class="shared-task-actions">
                    ${editBtn}
                    <a class="btn-open-task" href="/tasks/${t.id}">🔍 Open</a>
                </div>
            </div>`;
    }).join("");
}


// ================= BULK OPERATIONS =================
function toggleBulkSelect(id, checked) {
    if (checked) SELECTED_TASK_IDS.add(id);
    else SELECTED_TASK_IDS.delete(id);
    renderBulkToolbar();
}

function clearBulkSelection() {
    SELECTED_TASK_IDS.clear();
    document.querySelectorAll(".bulk-select-checkbox").forEach(cb => cb.checked = false);
    renderBulkToolbar();
}

function renderBulkToolbar() {
    let bar = document.getElementById("bulk-toolbar");

    if (SELECTED_TASK_IDS.size === 0) {
        if (bar) bar.remove();
        return;
    }

    if (!bar) {
        bar = document.createElement("div");
        bar.id = "bulk-toolbar";
        bar.className = "bulk-toolbar";
        document.body.appendChild(bar);
    }

    const categoryOptions = CATEGORIES.map(c =>
        `<option value="${c.id}">${escapeHtml(c.name)}</option>`
    ).join("");

    // If every selected task is already completed, the button offers to unmark them instead.
    const selectedTasks = TASKS.filter(t => SELECTED_TASK_IDS.has(t.id));
    const allCompleted = selectedTasks.length > 0 && selectedTasks.every(t => t.status === "completed");

    const completeBtnLabel = allCompleted ? "↩️ Unmark Completed" : "✓ Mark Completed";
    const completeBtnClass = allCompleted ? "bulk-btn-uncomplete" : "bulk-btn-complete";
    const completeBtnAction = allCompleted ? "bulkMarkPending()" : "bulkMarkCompleted()";

    bar.innerHTML = `
        <span class="bulk-count">${SELECTED_TASK_IDS.size} selected</span>
        <button class="bulk-btn ${completeBtnClass}" onclick="${completeBtnAction}">${completeBtnLabel}</button>
        <select id="bulk-category-select" class="bulk-select-input">
            <option value="">Uncategorized</option>
            ${categoryOptions}
        </select>
        <button class="bulk-btn bulk-btn-category" onclick="bulkChangeCategory()">🗂 Apply Category</button>
        <button class="bulk-btn bulk-btn-delete"   onclick="bulkDeleteSelected()">🗑️ Delete Selected</button>
        <button class="bulk-btn bulk-btn-clear"    onclick="clearBulkSelection()">✕ Clear</button>`;
}

async function bulkSetStatus(status) {
    if (SELECTED_TASK_IDS.size === 0) return;
    const verb = status === "completed" ? "Mark" : "Unmark";
    if (!confirm(`${verb} ${SELECTED_TASK_IDS.size} task(s) as ${status === "completed" ? "completed" : "pending"}?`)) return;
    try {
        const res = await fetch("/api/tasks/bulk-status", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(SELECTED_TASK_IDS), status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        showSuccess(data.message || "Tasks updated.");
        SELECTED_TASK_IDS.clear();
        loadTasks(CURRENT_PAGE);
    } catch (e) { showError(e.message || "Failed to update tasks."); }
}

async function bulkMarkCompleted() { return bulkSetStatus("completed"); }
async function bulkMarkPending() { return bulkSetStatus("pending"); }

async function bulkChangeCategory() {
    if (SELECTED_TASK_IDS.size === 0) return;
    const select = document.getElementById("bulk-category-select");
    const category_id = select && select.value ? parseInt(select.value, 10) : null;
    try {
        const res = await fetch("/api/tasks/bulk-category", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(SELECTED_TASK_IDS), category_id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        showSuccess(data.message || "Category updated.");
        SELECTED_TASK_IDS.clear();
        loadTasks(CURRENT_PAGE);
    } catch (e) { showError(e.message || "Failed to update category."); }
}

async function bulkDeleteSelected() {
    if (SELECTED_TASK_IDS.size === 0) return;
    if (!confirm(`Delete ${SELECTED_TASK_IDS.size} task(s)? This cannot be undone.`)) return;
    try {
        const res = await fetch("/api/tasks/bulk-delete", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(SELECTED_TASK_IDS) })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        showSuccess(data.message || "Tasks deleted.");
        SELECTED_TASK_IDS.clear();
        loadTasks(CURRENT_PAGE);
    } catch (e) { showError(e.message || "Failed to delete tasks."); }
}


// ================= TASK CRUD =================
function saveTask(e) {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const deadlineInput = document.getElementById("deadline").value;
    const priority = document.getElementById("priority").value;
    const category_id = document.getElementById("category")?.value || null;

    if (!title || !deadlineInput) return showError("Title and Deadline are required.");
    if (new Date(deadlineInput) < new Date()) return showError("Deadline cannot be in the past.");

    fetch("/api/tasks", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deadline: deadlineInput, priority, category_id })
    })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(() => { localStorage.removeItem("editingTask"); showSuccess("Task created successfully."); setTimeout(() => { window.location.href = "/"; }, 700); })
        .catch(() => showError("Failed to create task."));
}

function updateTask(e, id) {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const deadlineInput = document.getElementById("deadline").value;
    const priority = document.getElementById("priority").value;
    const statusField = document.getElementById("status");
    const status = statusField ? statusField.value : "pending";
    const category_id = document.getElementById("category")?.value || null;

    if (!title || !deadlineInput) return showError("Title and Deadline are required.");
    if (new Date(deadlineInput) < new Date()) return showError("Deadline cannot be in the past.");

    fetch(`/api/tasks/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deadline: deadlineInput, priority, status, category_id })
    })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(() => { localStorage.removeItem("editingTask"); showSuccess("Task updated successfully."); setTimeout(() => { window.location.href = "/"; }, 700); })
        .catch(() => showError("Failed to update task."));
}

function goEdit(id) {
    const task = TASKS.find(t => t.id === id);
    if (!task) return showError("Task not found.");
    localStorage.setItem("editingTask", JSON.stringify(task));
    window.location.href = "/add";
}

function deleteTask(id) {
    if (!confirm("Delete this task?")) return;
    fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" })
        .then(res => { if (!res.ok) throw new Error(); showSuccess("Task deleted."); loadTasks(); })
        .catch(() => showError("Failed to delete task."));
}


// ================= UTILITIES =================
function showError(msg) {
    const box = document.getElementById("message-box");
    if (!box) return;
    box.innerHTML = `<div class="alert-error">${escapeHtml(msg)}</div>`;
}

function showSuccess(msg) {
    const box = document.getElementById("message-box");
    if (!box) return;
    box.innerHTML = `<div class="alert-success">${escapeHtml(msg)}</div>`;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderMyTasks() {
    const container = document.getElementById("my-tasks-container");
    if (!container) return;
    container.innerHTML = "";
    if (TASKS.length === 0) { container.innerHTML = `<p class="muted">No tasks found.</p>`; return; }
    TASKS.forEach(t => {
        container.innerHTML += `
            <div class="task-card">
                <h3>${escapeHtml(t.title)}</h3>
                <p>Due: ${t.deadline || "-"}</p>
                <p>Priority: ${t.priority}</p>
                <p>Status: ${t.status}</p>
            </div>`;
    });
}

window.changeSort = function (value) {
    CURRENT_SORT = value;
    CURRENT_PAGE = 1;
    loadTasks(1);
};

function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;
    if (TOTAL_PAGES <= 1) { container.innerHTML = ""; return; }
    container.innerHTML = `
        <button onclick="prevPage()" ${CURRENT_PAGE === 1 ? "disabled" : ""}>⬅ Prev</button>
        <span> Page ${CURRENT_PAGE} of ${TOTAL_PAGES} </span>
        <button onclick="nextPage()" ${CURRENT_PAGE === TOTAL_PAGES ? "disabled" : ""}>Next ➡</button>`;
}

function nextPage() { if (CURRENT_PAGE < TOTAL_PAGES) loadTasks(CURRENT_PAGE + 1); }
function prevPage() { if (CURRENT_PAGE > 1) loadTasks(CURRENT_PAGE - 1); }

function getTaskStatusType(task) {
    if (!task.deadline) return "none";
    const now = new Date(), due = new Date(task.deadline);
    if (task.status !== "completed" && due < now) return "overdue";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due); dueDate.setHours(0, 0, 0, 0);
    if (dueDate.getTime() === today.getTime()) return "today";
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    if (due > now && due <= weekEnd) return "week";
    return "normal";
}


// ================= LOGIN =================
async function loginUser() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) return showError("Email and password are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("Please enter a valid email address.");
    if (password.length < 6) return showError("Password must be at least 6 characters.");

    const nextPage = new URLSearchParams(window.location.search).get("next") || "/";

    try {
        const res = await fetch("/api/login", {
            method: "POST", headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password, next: nextPage })
        });
        const data = await res.json();
        if (res.ok) {
            showSuccess("Login successful!");
            setTimeout(() => { window.location.href = data.redirect || nextPage; }, 700);
        } else {
            showError(data.error || "Login failed.");
        }
    } catch { showError("Server error. Please try again."); }
}


// ================= REGISTER =================
async function registerUser() {
    const username = document.getElementById("register-username").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();

    if (!username || !email || !password) return showError("All fields are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("Please enter a valid email address.");
    if (password.length < 6) return showError("Password must be at least 6 characters.");
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password)) return showError("Password must contain letters and numbers.");

    try {
        const res = await fetch("/api/register", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (res.ok) { showSuccess("Registered successfully!"); setTimeout(() => { window.location.href = "/login"; }, 700); }
        else showError(data.error || "Registration failed.");
    } catch { showError("Server error. Please try again."); }
}


// ================= LOGOUT =================
async function logoutUser() {
    const res = await fetch("/api/logout", { credentials: "include" });
    const data = await res.json();
    window.location.href = data.redirect;
}


// ================= DOMContentLoaded (second block) =================
document.addEventListener("DOMContentLoaded", () => {
    if (!isAuthPage) { loadTasks(); loadCategories(); }

    const addBtn = document.getElementById("open-add");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            localStorage.removeItem("editingTask");
            window.location.href = "/add";
        });
    }

    const viewFilter = document.getElementById("view-filter");
    if (viewFilter) viewFilter.addEventListener("change", renderDashboard);

    const tableSearch = document.getElementById("table-search");
    if (tableSearch) tableSearch.addEventListener("input", renderTable);

    const managerSearch = document.getElementById("task-search");
    if (managerSearch) managerSearch.addEventListener("input", renderManager);

    const categoryFilter = document.getElementById("category-filter");
    if (categoryFilter) categoryFilter.addEventListener("change", () => { renderTable(); renderManager(); });

    // ── Edit mode ──
    const editingTask = localStorage.getItem("editingTask");
    const form = document.getElementById("task-form");

    if (editingTask && form) {
        const task = JSON.parse(editingTask);
        const f = id => document.getElementById(id);
        if (f("title")) f("title").value = task.title || "";
        if (f("description")) f("description").value = task.description || "";
        if (f("deadline")) f("deadline").value = task.deadline || "";
        if (f("priority")) f("priority").value = task.priority || "Medium";
        if (f("category")) f("category").value = task.category_id || "";
        form.onsubmit = e => updateTask(e, task.id);
    } else if (form) {
        form.onsubmit = e => saveTask(e);
    }
});


// ================= INJECTED STYLES =================
(function injectExtraStyles() {
    const style = document.createElement("style");
    style.textContent = `
        /* zero task badge */
        .zero-task-badge {
            display: inline-block;
            margin-left: 8px;
            padding: 2px 9px;
            background: #7f1d1d22;
            border: 1px solid #dc262655;
            color: #f87171;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
        }

        /* completed task row */
        .row-completed { opacity: 0.72; }

        /* completed task title — strikethrough */
        .task-title-completed {
            text-decoration: line-through;
            color: #64748b;
        }

        /* bulk checkbox styling */
        .bulk-select-checkbox {
            width: 15px;
            height: 15px;
            cursor: pointer;
            margin-right: 6px;
            accent-color: #2563eb;
        }

        /* completed task checkbox gets green accent */
        .bulk-select-checkbox[data-completed="true"] {
            accent-color: #16a34a;
        }

        /* status chip */
        .status-chip {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 0.73rem;
            font-weight: 700;
            text-transform: capitalize;
        }
        .status-pending     { background:#1e3a5f22; color:#60a5fa; border:1px solid #2563eb44; }
        .status-in_progress { background:#3b2a0522; color:#fbbf24; border:1px solid #d9770644; }
        .status-completed   { background:#14532d22; color:#4ade80; border:1px solid #16a34a44; }

        /* bulk toolbar */
        .bulk-toolbar {
            position: fixed;
            left: 50%;
            bottom: 24px;
            transform: translateX(-50%);
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 12px 18px;
            box-shadow: 0 8px 24px rgba(0,0,0,.35);
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            z-index: 1000;
            max-width: calc(100vw - 40px);
        }
        .bulk-count { font-size: 0.85rem; font-weight: 700; color: #e2e8f0; white-space: nowrap; }
        .bulk-btn { border: none; border-radius: 7px; padding: 7px 14px; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .bulk-btn-complete { background: #16a34a; color: #fff; }
        .bulk-btn-complete:hover { background: #15803d; }
        .bulk-btn-uncomplete { background: transparent; color: #4ade80; border: 1px solid #16a34a55; }
        .bulk-btn-uncomplete:hover { background: #16a34a22; }
        .bulk-btn-category { background: #1d4ed8; color: #fff; }
        .bulk-btn-category:hover { background: #1e40af; }
        .bulk-btn-delete { background: transparent; color: #f87171; border: 1px solid #f8717155; }
        .bulk-btn-delete:hover { background: #7f1d1d33; }
        .bulk-btn-clear { background: transparent; color: #94a3b8; border: 1px solid #33415555; }
        .bulk-btn-clear:hover { background: #33415533; }
        .bulk-select-input { background: #0f172a; border: 1px solid #334155; border-radius: 7px; color: #e2e8f0; padding: 7px 10px; font-size: 0.82rem; outline: none; }
    `;
    document.head.appendChild(style);
})();

