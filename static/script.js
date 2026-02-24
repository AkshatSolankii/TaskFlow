let TASKS = [];
let CATEGORIES = [];

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




function loadTasks() {
    fetch("/api/tasks")
        .then(res => res.json())
        .then(data => {
            TASKS = data;
            renderDashboard();
            renderTable();
            renderManager();
        })
        .catch(() => showError("Could not load tasks."));
}

function loadCategories() {
    fetch("/api/categories")
        .then(res => res.json())
        .then(data => {
            CATEGORIES = data;
            populateCategoryFilter();
            populateTaskCategorySelect();
        })
        .catch(() => showError("Failed to load categories"));
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
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
            if (!ok) throw data;

            showSuccess("Category added successfully");
            input.value = "";
            loadCategories();
        })
        .catch(err => showError(err.error || "Failed to add category"));
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
        .then(() => {
            showSuccess(
                checked ? "Task marked as completed" : "Task marked as pending"
            );
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
                    <div>Due: ${escapeHtml(t.deadline || "-")}</div>
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
                <td>${escapeHtml(t.deadline || "-")}</td>
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
                        | Due: ${escapeHtml(t.deadline)} 
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
    const deadline = document.getElementById("deadline").value;
    const priority = document.getElementById("priority").value;
    const category_id = document.getElementById("category")?.value || null;

    if (!title || !deadline) {
        return showError("Title and Deadline are required.");
    }

    fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deadline, priority, category_id })
    })
        .then(() => {
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
        .then(() => {
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
        .then(() => {
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