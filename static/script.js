let TASKS = [];

document.addEventListener("DOMContentLoaded", () => {
    loadTasks();

    const addBtn = document.getElementById("open-add");
    if (addBtn) addBtn.addEventListener("click", () => window.location.href = "/add");

    const viewFilter = document.getElementById("view-filter");
    if (viewFilter) viewFilter.addEventListener("change", renderDashboard);

    const tableSearch = document.getElementById("table-search");
    if (tableSearch) tableSearch.addEventListener("input", renderTable);

    const managerSearch = document.getElementById("task-search");
    if (managerSearch) managerSearch.addEventListener("input", renderManager);
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

function toggleStatus(id, checked) {
    const status = checked ? "completed" : "pending";

    fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok }) => {
            if (!ok) throw 0;
            showSuccess(checked ? "Task marked completed" : "Task marked pending");
            loadTasks();
        })
        .catch(() => showError("Failed to update status"));
}

function renderDashboard() {
    const container = document.getElementById("dashboard-cards");
    if (!container) return;

    container.innerHTML = "";
    const mode = document.getElementById("view-filter")?.value || "all";
    const todayStr = new Date().toISOString().slice(0, 10);

    let tasks = [...TASKS];

    if (mode === "today") tasks = tasks.filter(t => t.deadline === todayStr);
    if (mode === "pending") tasks = tasks.filter(t => t.status === "pending");
    if (mode === "completed") tasks = tasks.filter(t => t.status === "completed");

    if (tasks.length === 0) {
        container.innerHTML = `<p class="muted">No tasks found.</p>`;
        return;
    }

    tasks.forEach(t => {
        const badge =
            t.priority === "High" ? "priority-high" :
                t.priority === "Low" ? "priority-low" : "priority-medium";

        container.innerHTML += `
            <div class="card">
                <div class="card-head">
                    <span class="task-title">${escapeHtml(t.title)}</span>
                    <span class="priority-badge ${badge}">${t.priority}</span>
                </div>
                <div class="card-body">
                    <div>Due: ${escapeHtml(t.deadline || "-")}</div>
                    <div>Status: ${escapeHtml(t.status)}</div>
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

    let tasks = TASKS.filter(t => t.title.toLowerCase().includes(search));
    tbody.innerHTML = "";

    tasks.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td>
                    <input type="checkbox"
                        onclick="toggleStatus(${t.id}, this.checked)"
                        ${t.status === "completed" ? "checked" : ""}
                        style="transform:scale(1.2); margin-right:8px;">
                    ${escapeHtml(t.title)}
                </td>

                <td>${escapeHtml(t.deadline || "-")}</td>
                <td>${escapeHtml(t.priority)}</td>
                <td>${escapeHtml(t.status)}</td>

                <td class="col-small">
                    <span class="icon-btn" onclick="goEdit(${t.id})">✏️</span>
                </td>
                <td class="col-small">
                    <span class="icon-btn" onclick="deleteTask(${t.id})">🗑️</span>
                </td>
            </tr>
        `;
    });
}

function renderManager() {
    const container = document.getElementById("manager-list");
    if (!container) return;

    const text = document.getElementById("task-search")?.value.toLowerCase() || "";
    let tasks = TASKS.filter(t => t.title.toLowerCase().includes(text));

    container.innerHTML = "";

    if (tasks.length === 0) {
        container.innerHTML = `<p class="muted">No tasks found.</p>`;
        return;
    }

    tasks.forEach(t => {
        container.innerHTML += `
            <div class="manager-row">
                <div class="left-section">
                    <input type="checkbox"
                        class="task-checkbox"
                        onclick="toggleStatus(${t.id}, this.checked)"
                        ${t.status === "completed" ? "checked" : ""}>

                    <div class="task-info">
                        <strong>${escapeHtml(t.title)}</strong>
                        <span class="muted">Due: ${escapeHtml(t.deadline)} | Priority: ${escapeHtml(t.priority)}</span>
                    </div>
                </div>

                <div class="right-section">
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

    if (!title || !deadline) return showError("Title and Deadline are required.");

    fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deadline, priority })
    })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok }) => {
            if (!ok) throw 0;
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

    if (!title || !deadline) {
        showError("Title and Deadline are required.");
        return;
    }

    fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deadline, priority, status })
    })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok }) => {
            if (!ok) throw 0;

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
