let TASKS = [];
let CATEGORIES = [];
let CURRENT_PAGE = 1;
let TOTAL_PAGES = 1;
let LIMIT = 7; // you can change (5 / 10)
let CURRENT_SORT = "created";
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
        // ✅ FIX: re-render table on search (all_tasks_table page)
        tableSearch.addEventListener("input", renderTable);
    }

    const managerSearch = document.getElementById("task-search");
    if (managerSearch) {
        managerSearch.addEventListener("input", renderManager);
    }

    // ✅ OLD category-filter (task_manager / my_tasks pages)
    const categoryFilter = document.getElementById("category-filter");
    if (categoryFilter) {
        categoryFilter.addEventListener("change", () => {
            renderTable();
            renderManager();
        });
    }

    // ✅ NEW: filter dropdowns on all_tasks_table page
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


// ================= FIXED LOAD TASKS =================
function loadTasks(page = 1) {

    CURRENT_PAGE = page;

    const isDashboard =
        document.getElementById("dashboard-cards");

    let url = "/api/tasks";

    // ✅ Apply pagination ONLY for non-dashboard pages
    if (!isDashboard) {

        url += `?page=${CURRENT_PAGE}&limit=${LIMIT}&sort=${CURRENT_SORT}`;
    }

    fetch(url, {
        credentials: "include"
    })

        .then(async res => {

            // 🔥 Redirect if not logged in
            if (res.redirected) {

                window.location.href = "/login";

                return;
            }

            // 🔥 Unauthorized
            if (res.status === 401) {

                window.location.href = "/login";

                return;
            }

            if (!res.ok) {

                throw new Error(
                    "Failed to fetch tasks"
                );
            }

            return res.json();
        })

        .then(data => {

            if (!data) return;

            console.log("API:", data);

            // ✅ Handle both formats
            if (Array.isArray(data)) {

                TASKS = data;

                TOTAL_PAGES = 1;

            } else {

                TASKS = data.tasks || [];

                TOTAL_PAGES = data.total_pages || 1;
            }

            // ✅ Render ONLY required page
            if (document.getElementById("dashboard-cards")) {

                renderDashboard();
            }

            if (document.getElementById("manager-list")) {

                renderManager();
            }

            if (document.getElementById("task-table-body")) {

                renderTable();
            }

            renderPagination();
        })

        .catch(err => {

            console.error(
                "LOAD ERROR:",
                err
            );
        });
}

// ================= FIXED LOAD CATEGORIES =================
function loadCategories() {

    fetch("/api/categories", {
        credentials: "include"
    })

        .then(async res => {

            if (res.redirected) {
                window.location.href = "/login";
                return;
            }

            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }

            if (!res.ok) {
                throw new Error("Server error");
            }

            return res.json();
        })

        .then(data => {

            if (!data) return;

            CATEGORIES = Array.isArray(data)
                ? data
                : data.categories || [];

            populateCategoryFilter();

            populateTaskCategorySelect();

            // ✅ Populate the new filter-category dropdown on all_tasks_table
            populateTableCategoryFilter();

            renderCategories();
        })

        .catch(err => {
            console.error("CATEGORY LOAD ERROR:", err);
        });
}


// ✅ NEW: Populate filter-category dropdown on all_tasks_table page
function populateTableCategoryFilter() {
    const sel = document.getElementById("filter-category");
    if (!sel) return;

    // Keep the "All Categories" option, remove old dynamic ones
    sel.querySelectorAll("option:not([value=''])").forEach(o => o.remove());

    CATEGORIES.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.name;          // export routes match by name
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

        if (selectedId && String(c.id) === String(selectedId)) {
            opt.selected = true;
        }

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    })
        .then(res => {
            if (!res.ok) throw new Error("Failed");
            return res.json();
        })
        .then(() => {
            showSuccess("Category added successfully");
            input.value = "";
            loadCategories();
        })
        .catch(err => showError(err.message || "Failed to add category"));
}


function renderCategories() {

    const container =
        document.getElementById("category-list");

    if (!container) return;

    container.innerHTML = "";

    if (CATEGORIES.length === 0) {

        container.innerHTML =
            `<p class="muted">No categories found.</p>`;

        return;
    }

    CATEGORIES.forEach(category => {

        // Count tasks for this category
        const taskCount = TASKS.filter(
            t => t.category_id === category.id
        ).length;

        container.innerHTML += `
            <div class="manager-row">
                <div>
                    <strong>${escapeHtml(category.name)}</strong>
                    ${taskCount === 0
                ? `<span class="zero-task-badge">0 tasks</span>`
                : `<span class="muted"> — ${taskCount} task${taskCount > 1 ? "s" : ""}</span>`
            }
                </div>
                <div>
                    <span class="icon-btn" onclick="editCategory(${category.id})">✏️</span>
                    <span class="icon-btn" onclick="deleteCategory(${category.id})">🗑️</span>
                </div>
            </div>
        `;
    });
}

function editCategory(id) {

    const category =
        CATEGORIES.find(c => c.id === id);

    if (!category) {
        return showError("Category not found");
    }

    const newName = prompt(
        "Enter new category name",
        category.name
    );

    if (!newName || !newName.trim()) {
        return;
    }

    fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName.trim() })
    })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(() => {
            showSuccess("Category updated successfully");
            loadCategories();
        })
        .catch(() => {
            showError("Failed to update category");
        });
}


function deleteCategory(id) {

    if (!confirm("Delete this category?")) {
        return;
    }

    fetch(`/api/categories/${id}`, {
        method: "DELETE",
        credentials: "include"
    })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(() => {
            showSuccess("Category deleted successfully");
            loadCategories();
            loadTasks();
        })
        .catch(() => {
            showError("Failed to delete category");
        });
}


function toggleStatus(id, checked) {
    const status = checked ? "completed" : "pending";
    const task = TASKS.find(t => t.id === id);
    if (!task) return;

    fetch(`/api/tasks/${id}`, {
        method: "PATCH",
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
        .then(res => {
            if (!res.ok) throw new Error();
            showSuccess(checked ? "Task completed" : "Task pending");
            loadTasks();
        })
        .catch(() => showError("Failed to update task status"));
}


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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(due);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate.getTime() === today.getTime()) return "today";

        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() + 7);

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
        const badge =
            t.priority === "High" ? "priority-high" :
                t.priority === "Low" ? "priority-low" :
                    "priority-medium";

        const type = getType(t);

        let statusLabel = "";
        if (type === "overdue") statusLabel = `<span class="status-badge red">Overdue</span>`;
        if (type === "today") statusLabel = `<span class="status-badge yellow">Today</span>`;
        if (type === "week") statusLabel = `<span class="status-badge green">This Week</span>`;

        container.innerHTML += `
            <div class="card task-${type}">
                <div class="card-head">
                    <span class="task-title">${escapeHtml(t.title)}</span>
                    <span class="priority-badge ${badge}">${t.priority}</span>
                </div>
                <div class="card-body">
                    <div>Due: ${t.deadline
                ? new Date(t.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : "-"}</div>
                    <div>Status: ${escapeHtml(t.status)}</div>
                    <div class="muted">Category: ${t.category || "Uncategorized"}</div>
                    ${statusLabel}
                </div>
                <div class="card-footer">
                    <span class="icon-btn" onclick="goEdit(${t.id})">✏️ Edit</span>
                    <span class="icon-btn" onclick="deleteTask(${t.id})">🗑️ Delete</span>
                </div>
            </div>
        `;
    });
}


// ✅ FIXED renderTable — reads all 4 filter dropdowns
function renderTable() {

    const tbody = document.getElementById("task-table-body");
    if (!tbody) return;

    // ── read filters ──────────────────────────────────────
    const search = document.getElementById("table-search")?.value.toLowerCase() || "";
    const status = document.getElementById("filter-status")?.value || "";
    const priority = document.getElementById("filter-priority")?.value || "";
    const catName = document.getElementById("filter-category")?.value || "";
    // old category-filter still used on task_manager / my_tasks pages
    const categoryId = document.getElementById("category-filter")?.value || "all";

    let tasks = [...TASKS];

    // search
    if (search) {
        tasks = tasks.filter(t => t.title.toLowerCase().includes(search));
    }

    // status dropdown (new)
    if (status) {
        tasks = tasks.filter(t => t.status === status);
    }

    // priority dropdown (new)
    if (priority) {
        tasks = tasks.filter(t => t.priority === priority);
    }

    // category name dropdown (new — matches by name)
    if (catName) {
        tasks = tasks.filter(t => t.category === catName);
    }

    // old category-filter by id (task_manager / my_tasks pages)
    if (categoryId !== "all" && !catName) {
        tasks = tasks.filter(t => String(t.category_id) === categoryId);
    }

    tbody.innerHTML = "";

    // ✅ Zero-task message
    if (tasks.length === 0) {
        const activeFilters = [search, status, priority, catName].filter(Boolean);
        const msg = activeFilters.length > 0
            ? "No tasks match the selected filters."
            : "No tasks found.";

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:28px 0;">
                    <span style="
                        display:inline-block;
                        background:#1e293b;
                        border:1px solid #334155;
                        border-radius:8px;
                        padding:14px 28px;
                        color:#94a3b8;
                        font-size:0.92rem;
                    ">📭 ${msg}</span>
                </td>
            </tr>`;
        return;
    }

    tasks.forEach(t => {

        tbody.innerHTML += `
            <tr>
                <td>
                    <input type="checkbox"
                        onclick="toggleStatus(${t.id}, this.checked)"
                        ${t.status === "completed" ? "checked" : ""}>
                    ${escapeHtml(t.title)}
                </td>
                <td>
                    ${t.deadline
                ? new Date(t.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : "-"}
                </td>
                <td>${escapeHtml(t.priority)}</td>
                <td>${escapeHtml(t.status)}</td>
                <td>${t.category || "Uncategorized"}</td>
                <td><span class="icon-btn" onclick="goEdit(${t.id})">✏️</span></td>
                <td><span class="icon-btn" onclick="deleteTask(${t.id})">🗑️</span></td>
            </tr>
        `;
    });
}


function renderManager() {
    const container = document.getElementById("manager-list");
    if (!container) return;

    const search = document.getElementById("task-search")?.value.toLowerCase() || "";
    const categoryId = document.getElementById("category-filter")?.value || "all";

    let tasks = TASKS.filter(t => t.title.toLowerCase().includes(search));

    if (categoryId !== "all") {
        tasks = tasks.filter(t => String(t.category_id) === categoryId);
    }

    container.innerHTML = "";

    if (tasks.length === 0) {
        container.innerHTML = `<p class="muted">No tasks found.</p>`;
        return;
    }

    tasks.forEach(t => {
        container.innerHTML += `
            <div class="manager-row">
                <div>
                    <input type="checkbox"
                        onclick="toggleStatus(${t.id}, this.checked)"
                        ${t.status === "completed" ? "checked" : ""}>
                    <strong>${escapeHtml(t.title)}</strong>
                    <span class="muted">
                        | Due: ${t.deadline ? new Date(t.deadline).toLocaleString('en-IN', {
            dateStyle: 'medium', timeStyle: 'short'
        }) : "-"}
                        | Priority: ${escapeHtml(t.priority)}
                        | Category: ${t.category || "Uncategorized"}
                    </span>
                </div>
                <div>
                    <span class="icon-btn" onclick="goEdit(${t.id})">✏️</span>
                    <span class="icon-btn" onclick="deleteTask(${t.id})">🗑️</span>
                </div>
            </div>
        `;
    });
}


function saveTask(e) {

    e.preventDefault();

    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const deadlineInput = document.getElementById("deadline").value;
    const priority = document.getElementById("priority").value;
    const category_id = document.getElementById("category")?.value || null;

    if (!title || !deadlineInput) {
        return showError("Title and Deadline are required.");
    }

    const selected = new Date(deadlineInput);
    const now = new Date();

    if (selected < now) {
        return showError("Deadline cannot be in the past.");
    }

    fetch("/api/tasks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deadline: deadlineInput, priority, category_id })
    })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(() => {
            localStorage.removeItem("editingTask");
            showSuccess("Task created successfully.");
            setTimeout(() => { window.location.href = "/"; }, 700);
        })
        .catch(() => { showError("Failed to create task."); });
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

    if (!title || !deadlineInput) {
        return showError("Title and Deadline are required.");
    }

    const selected = new Date(deadlineInput);
    const now = new Date();

    if (selected < now) {
        return showError("Deadline cannot be in the past.");
    }

    fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deadline: deadlineInput, priority, status, category_id })
    })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(() => {
            localStorage.removeItem("editingTask");
            showSuccess("Task updated successfully.");
            setTimeout(() => { window.location.href = "/"; }, 700);
        })
        .catch(() => { showError("Failed to update task."); });
}

function goEdit(id) {

    const task = TASKS.find(t => t.id === id);

    if (!task) {
        return showError("Task not found.");
    }

    localStorage.setItem("editingTask", JSON.stringify(task));
    window.location.href = "/add";
}

function deleteTask(id) {

    if (!confirm("Delete this task?")) {
        return;
    }

    fetch(`/api/tasks/${id}`, {
        method: "DELETE",
        credentials: "include"
    })
        .then(res => {
            if (!res.ok) throw new Error();
            showSuccess("Task deleted.");
            loadTasks();
        })
        .catch(() => { showError("Failed to delete task."); });
}


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
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderMyTasks() {
    const container = document.getElementById("my-tasks-container");
    if (!container) return;

    container.innerHTML = "";

    if (TASKS.length === 0) {
        container.innerHTML = `<p class="muted">No tasks found.</p>`;
        return;
    }

    TASKS.forEach(t => {
        container.innerHTML += `
            <div class="task-card">
                <h3>${escapeHtml(t.title)}</h3>
                <p>Due: ${t.deadline || "-"}</p>
                <p>Priority: ${t.priority}</p>
                <p>Status: ${t.status}</p>
            </div>
        `;
    });
}

window.changeSort = function (value) {
    console.log("Sorting by:", value);
    CURRENT_SORT = value;
    CURRENT_PAGE = 1;
    loadTasks(1);
};

function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;

    if (TOTAL_PAGES <= 1) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <button onclick="prevPage()" ${CURRENT_PAGE === 1 ? "disabled" : ""}>⬅ Prev</button>
        <span> Page ${CURRENT_PAGE} of ${TOTAL_PAGES} </span>
        <button onclick="nextPage()" ${CURRENT_PAGE === TOTAL_PAGES ? "disabled" : ""}>Next ➡</button>
    `;
}

function nextPage() {
    if (CURRENT_PAGE < TOTAL_PAGES) {
        loadTasks(CURRENT_PAGE + 1);
    }
}

function prevPage() {
    if (CURRENT_PAGE > 1) {
        loadTasks(CURRENT_PAGE - 1);
    }
}


function getTaskStatusType(task) {
    if (!task.deadline) return "none";

    const now = new Date();
    const due = new Date(task.deadline);

    if (task.status !== "completed" && due < now) return "overdue";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(due);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate.getTime() === today.getTime()) return "today";

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (due > now && due <= weekEnd) return "week";

    return "normal";
}


// ================= LOGIN =================
async function loginUser() {

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
        return showError("Email and password are required.");
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        return showError("Please enter a valid email address.");
    }

    if (password.length < 6) {
        return showError("Password must be at least 6 characters.");
    }

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            showSuccess("Login successful!");
            setTimeout(() => { window.location.href = data.redirect; }, 700);
        } else {
            showError(data.error || "Login failed.");
        }
    } catch {
        showError("Server error. Please try again.");
    }
}

// ================= REGISTER =================
async function registerUser() {

    const username = document.getElementById("register-username").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();

    if (!username || !email || !password) {
        return showError("All fields are required.");
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        return showError("Please enter a valid email address.");
    }

    if (password.length < 6) {
        return showError("Password must be at least 6 characters.");
    }

    const strongPassword = /^(?=.*[A-Za-z])(?=.*\d).+$/;
    if (!strongPassword.test(password)) {
        return showError("Password must contain letters and numbers.");
    }

    try {
        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (res.ok) {
            showSuccess("Registered successfully!");
            setTimeout(() => { window.location.href = "/login"; }, 700);
        } else {
            showError(data.error || "Registration failed.");
        }
    } catch {
        showError("Server error. Please try again.");
    }
}

// ================= LOGOUT =================
async function logoutUser() {
    const res = await fetch("/api/logout", { credentials: "include" });
    const data = await res.json();
    window.location.href = data.redirect;
}

document.addEventListener("DOMContentLoaded", () => {

    if (!isAuthPage) {
        loadTasks();
        loadCategories();
    }

    // ================= ADD BUTTON =================
    const addBtn = document.getElementById("open-add");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            localStorage.removeItem("editingTask");
            window.location.href = "/add";
        });
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

    // ================= EDIT MODE =================
    const editingTask = localStorage.getItem("editingTask");
    const form = document.getElementById("task-form");

    if (editingTask && form) {

        const task = JSON.parse(editingTask);

        const title = document.getElementById("title");
        if (title) title.value = task.title || "";

        const description = document.getElementById("description");
        if (description) description.value = task.description || "";

        const deadline = document.getElementById("deadline");
        if (deadline) deadline.value = task.deadline || "";

        const priority = document.getElementById("priority");
        if (priority) priority.value = task.priority || "Medium";

        const category = document.getElementById("category");
        if (category) category.value = task.category_id || "";

        form.onsubmit = function (e) { updateTask(e, task.id); };

    } else if (form) {

        form.onsubmit = function (e) { saveTask(e); };
    }
});

// ================= ZERO-TASK BADGE STYLE =================
(function injectZeroTaskStyle() {
    const style = document.createElement("style");
    style.textContent = `
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
    `;
    document.head.appendChild(style);
})();