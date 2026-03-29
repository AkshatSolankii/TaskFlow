let TASKS = [];
let CATEGORIES = [];
let CURRENT_PAGE = 1;
let TOTAL_PAGES = 1;
let LIMIT = 7; // you can change (5 / 10)
let CURRENT_SORT = "created";

document.addEventListener("DOMContentLoaded", () => {
    loadCategories();
    loadTasks();

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
});





// ================= FIXED LOAD TASKS =================
function loadTasks(page = 1) {
    CURRENT_PAGE = page;

    const isDashboard = document.getElementById("dashboard-cards");

    let url = "/api/tasks";

    // ✅ Apply pagination ONLY for non-dashboard pages
    if (!isDashboard) {
        url += `?page=${CURRENT_PAGE}&limit=${LIMIT}&sort=${CURRENT_SORT}`;
    }

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch tasks");
            return res.json();
        })
        .then(data => {
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
            console.error("LOAD ERROR:", err);
        });
}
// ================= FIXED LOAD CATEGORIES =================
function loadCategories() {
    fetch("/api/categories")
        .then(res => {
            if (!res.ok) throw new Error("Server error");
            return res.json();
        })
        .then(data => {
            CATEGORIES = Array.isArray(data) ? data : data.categories || [];

            populateCategoryFilter();
            populateTaskCategorySelect();
        })
        .catch(err => {
            console.error("CATEGORY LOAD ERROR:", err);
            showError("Failed to load categories");
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
    const today = new Date().toISOString().slice(0, 10);

    let tasks = [...TASKS];

    if (mode === "today") tasks = tasks.filter(t => t.deadline === today);
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

        container.innerHTML += `
            <div class="card">
                <div class="card-head">
                    <span class="task-title">${escapeHtml(t.title)}</span>
                    <span class="priority-badge ${badge}">${t.priority}</span>
                </div>
                <div class="card-body">
                    <div>Due: ${t.deadline ? new Date(t.deadline).toLocaleString() : "-"}</div>
                    <div>Status: ${escapeHtml(t.status)}</div>
                    <div class="muted">Category: ${t.category || "Uncategorized"}</div>
                </div>
                <div class="card-footer">
                    <span class="icon-btn" onclick="goEdit(${t.id})">✏️ Edit</span>
                    <span class="icon-btn" onclick="deleteTask(${t.id})">🗑️ Delete</span>
                </div>
            </div>
        `;
    });
}





function renderTable() {
    const tbody = document.getElementById("task-table-body");
    if (!tbody) return;

    const search = document.getElementById("table-search")?.value.toLowerCase() || "";
    const categoryId = document.getElementById("category-filter")?.value || "all";

    let tasks = TASKS.filter(t => t.title.toLowerCase().includes(search));

    if (categoryId !== "all") {
        tasks = tasks.filter(t => String(t.category_id) === categoryId);
    }

    tbody.innerHTML = "";

    tasks.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td>
                    <input type="checkbox"
                        onclick="toggleStatus(${t.id}, this.checked)"
                        ${t.status === "completed" ? "checked" : ""}>
                    ${escapeHtml(t.title)}
                </td>
                <td>${t.deadline ? new Date(t.deadline).toLocaleString() : "-"}</td>
                <td>${escapeHtml(t.priority)}</td>
                <td>${escapeHtml(t.status)}</td>
                <td>${t.category || "—"}</td>
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
            dateStyle: 'medium',
            timeStyle: 'short'
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

    // ✅ REQUIRED VALIDATION
    if (!title || !deadlineInput) {
        return showError("Title and Deadline are required.");
    }

    // ✅ PAST DATE VALIDATION
    const selected = new Date(deadlineInput);
    const now = new Date();

    if (selected < now) {
        return showError("Deadline cannot be in the past.");
    }

    // ✅ SEND TO BACKEND
    fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title,
            description,
            deadline: deadlineInput, // 🔥 FIXED KEY
            priority,
            category_id
        })
    })
        .then(res => {
            if (!res.ok) throw new Error();
            showSuccess("Task created successfully.");
            setTimeout(() => window.location.href = "/", 700);
        })
        .catch(() => showError("Failed to create task."));
}





function updateTask(e, id) {
    e.preventDefault();

    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const deadline = document.getElementById("deadline").value;
    const priority = document.getElementById("priority").value;
    const status = document.getElementById("status").value;
    const category_id = document.getElementById("category")?.value || null;

    if (!title || !deadline) {
        return showError("Title and Deadline are required.");
    }

    fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title, description, deadline, priority, status, category_id
        })
    })
        .then(res => {
            if (!res.ok) throw new Error();
            showSuccess("Task updated successfully.");
            setTimeout(() => window.location.href = "/", 700);
        })
        .catch(() => showError("Failed to update task."));
}





function goEdit(id) {
    window.location.href = "/edit/" + id;
}

function deleteTask(id) {
    if (!confirm("Delete this task?")) return;

    fetch(`/api/tasks/${id}`, { method: "DELETE" })
        .then(res => {
            if (!res.ok) throw new Error();
            showSuccess("Task deleted.");
            loadTasks();
        })
        .catch(() => showError("Failed to delete task."));
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

    // ✅ store selected sort
    CURRENT_SORT = value;

    // ✅ reset to first page
    CURRENT_PAGE = 1;

    // ✅ reload data from backend with sorting
    loadTasks(1);
};

function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;

    // 🔥 HIDE pagination if only 1 page
    if (TOTAL_PAGES <= 1) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <button onclick="prevPage()" ${CURRENT_PAGE === 1 ? "disabled" : ""}>
            ⬅ Prev
        </button>

        <span> Page ${CURRENT_PAGE} of ${TOTAL_PAGES} </span>

        <button onclick="nextPage()" ${CURRENT_PAGE === TOTAL_PAGES ? "disabled" : ""}>
            Next ➡
        </button>
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