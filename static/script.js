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

            // 🔥 Redirect if not logged in
            if (res.redirected) {
                window.location.href = "/login";
                return;
            }

            // 🔥 Handle unauthorized
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
        })

        .catch(err => {

            console.error(
                "CATEGORY LOAD ERROR:",
                err
            );
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

    let tasks = [...TASKS];

    // 🔥 HELPER FUNCTION
    function getType(t) {
        if (!t.deadline) return "normal";

        const now = new Date();
        const due = new Date(t.deadline);

        // Overdue
        if (t.status !== "completed" && due < now) return "overdue";

        // Today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(due);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate.getTime() === today.getTime()) return "today";

        // This week
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() + 7);

        if (due > now && due <= weekEnd) return "week";

        return "normal";
    }

    // 🔥 FILTERS
    if (mode === "today") {
        tasks = tasks.filter(t => getType(t) === "today");
    }

    if (mode === "week") {
        tasks = tasks.filter(t => getType(t) === "week");
    }

    if (mode === "overdue") {
        tasks = tasks.filter(t => getType(t) === "overdue");
    }

    if (mode === "pending") {
        tasks = tasks.filter(t => t.status === "pending");
    }

    if (mode === "completed") {
        tasks = tasks.filter(t => t.status === "completed");
    }

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

        // 🔥 STATUS LABEL
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
                    <div>
                        Due: ${t.deadline
                ? new Date(t.deadline).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                })
                : "-"}
                    </div>

                    <div>Status: ${escapeHtml(t.status)}</div>

                    <div class="muted">
                        Category: ${t.category || "Uncategorized"}
                    </div>

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





function renderTable() {

    const tbody =
        document.getElementById("task-table-body");

    if (!tbody) return;

    const search =
        document.getElementById("table-search")
            ?.value.toLowerCase() || "";

    const categoryId =
        document.getElementById("category-filter")
            ?.value || "all";

    let tasks = TASKS.filter(t =>
        t.title.toLowerCase().includes(search)
    );

    // 🔥 CATEGORY FILTER
    if (categoryId !== "all") {

        tasks = tasks.filter(t =>
            String(t.category_id) === categoryId
        );
    }

    tbody.innerHTML = "";

    tasks.forEach(t => {

        tbody.innerHTML += `
            <tr>

                <td>
                    <input type="checkbox"

                        onclick="toggleStatus(${t.id}, this.checked)"

                        ${t.status === "completed"
                ? "checked"
                : ""}>

                    ${escapeHtml(t.title)}
                </td>

                <td>
                    ${t.deadline
                ? new Date(t.deadline)
                    .toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })
                : "-"}
                </td>

                <td>
                    ${escapeHtml(t.priority)}
                </td>

                <td>
                    ${escapeHtml(t.status)}
                </td>

                <td>
                    ${t.category || "Uncategorized"}
                </td>

                <td>
                    <span class="icon-btn"

                        onclick="goEdit(${t.id})">

                        ✏️
                    </span>
                </td>

                <td>
                    <span class="icon-btn"

                        onclick="deleteTask(${t.id})">

                        🗑️
                    </span>
                </td>

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

    const title =
        document.getElementById("title").value.trim();

    const description =
        document.getElementById("description").value.trim();

    const deadlineInput =
        document.getElementById("deadline").value;

    const priority =
        document.getElementById("priority").value;

    const category_id =
        document.getElementById("category")?.value || null;

    // ✅ REQUIRED VALIDATION
    if (!title || !deadlineInput) {

        return showError(
            "Title and Deadline are required."
        );
    }

    // ✅ PAST DATE VALIDATION
    const selected =
        new Date(deadlineInput);

    const now =
        new Date();

    if (selected < now) {

        return showError(
            "Deadline cannot be in the past."
        );
    }

    // ✅ CREATE TASK
    fetch("/api/tasks", {

        method: "POST",

        credentials: "include",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            title,

            description,

            deadline: deadlineInput,

            priority,

            category_id
        })
    })

        .then(res => {

            if (!res.ok) {

                throw new Error();
            }

            return res.json();
        })

        .then(() => {

            // 🔥 Clear edit mode
            localStorage.removeItem(
                "editingTask"
            );

            showSuccess(
                "Task created successfully."
            );

            setTimeout(() => {

                window.location.href = "/";

            }, 700);
        })

        .catch(() => {

            showError(
                "Failed to create task."
            );
        });
}





function updateTask(e, id) {

    e.preventDefault();

    const title =
        document.getElementById("title").value.trim();

    const description =
        document.getElementById("description").value.trim();

    const deadlineInput =
        document.getElementById("deadline").value;

    const priority =
        document.getElementById("priority").value;

    const statusField =
        document.getElementById("status");

    const status =
        statusField
            ? statusField.value
            : "pending";

    const category_id =
        document.getElementById("category")?.value || null;

    // ✅ REQUIRED VALIDATION
    if (!title || !deadlineInput) {

        return showError(
            "Title and Deadline are required."
        );
    }

    // ✅ PAST DATE VALIDATION
    const selected = new Date(deadlineInput);

    const now = new Date();

    if (selected < now) {

        return showError(
            "Deadline cannot be in the past."
        );
    }

    // ✅ UPDATE API
    fetch(`/api/tasks/${id}`, {

        method: "PATCH",

        credentials: "include",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            title,

            description,

            deadline: deadlineInput,

            priority,

            status,

            category_id
        })
    })

        .then(res => {

            if (!res.ok) {

                throw new Error();
            }

            return res.json();
        })

        .then(() => {

            // 🔥 CLEAR EDIT MODE
            localStorage.removeItem(
                "editingTask"
            );

            showSuccess(
                "Task updated successfully."
            );

            setTimeout(() => {

                window.location.href = "/";

            }, 700);
        })

        .catch(() => {

            showError(
                "Failed to update task."
            );
        });
}

function goEdit(id) {

    const task = TASKS.find(t => t.id === id);

    if (!task) {

        return showError("Task not found.");
    }

    // 🔥 Save task temporarily
    localStorage.setItem(
        "editingTask",
        JSON.stringify(task)
    );

    // 🔥 Open existing add page
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

            if (!res.ok) {
                throw new Error();
            }

            showSuccess("Task deleted.");

            loadTasks();
        })

        .catch(() => {

            showError("Failed to delete task.");
        });
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


function getTaskStatusType(task) {
    if (!task.deadline) return "none";

    const now = new Date();
    const due = new Date(task.deadline);

    if (task.status !== "completed" && due < now) {
        return "overdue";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(due);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate.getTime() === today.getTime()) {
        return "today";
    }

    // this week
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (due > now && due <= weekEnd) {
        return "week";
    }

    return "normal";
}


// ================= LOGIN =================
async function loginUser() {

    const email =
        document.getElementById("login-email")
            .value.trim();

    const password =
        document.getElementById("login-password")
            .value.trim();

    // ✅ EMPTY VALIDATION
    if (!email || !password) {

        return showError(
            "Email and password are required."
        );
    }

    // ✅ EMAIL VALIDATION
    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {

        return showError(
            "Please enter a valid email address."
        );
    }

    // ✅ PASSWORD LENGTH
    if (password.length < 6) {

        return showError(
            "Password must be at least 6 characters."
        );
    }

    try {

        const res = await fetch("/api/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            credentials: "include",

            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await res.json();

        if (res.ok) {

            showSuccess(
                "Login successful!"
            );

            setTimeout(() => {

                window.location.href =
                    data.redirect;

            }, 700);

        } else {

            showError(
                data.error || "Login failed."
            );
        }

    } catch {

        showError(
            "Server error. Please try again."
        );
    }
}

// ================= REGISTER =================
async function registerUser() {

    const username =
        document.getElementById("register-username")
            .value.trim();

    const email =
        document.getElementById("register-email")
            .value.trim();

    const password =
        document.getElementById("register-password")
            .value.trim();

    // ✅ EMPTY VALIDATION
    if (!username || !email || !password) {

        return showError(
            "All fields are required."
        );
    }

    // ✅ EMAIL VALIDATION
    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {

        return showError(
            "Please enter a valid email address."
        );
    }

    // ✅ PASSWORD LENGTH
    if (password.length < 6) {

        return showError(
            "Password must be at least 6 characters."
        );
    }

    // ✅ STRONG PASSWORD
    const strongPassword =
        /^(?=.*[A-Za-z])(?=.*\d).+$/;

    if (!strongPassword.test(password)) {

        return showError(
            "Password must contain letters and numbers."
        );
    }

    try {

        const res = await fetch("/api/register", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        const data = await res.json();

        if (res.ok) {

            showSuccess(
                "Registered successfully!"
            );

            setTimeout(() => {

                window.location.href = "/login";

            }, 700);

        } else {

            showError(
                data.error || "Registration failed."
            );
        }

    } catch {

        showError(
            "Server error. Please try again."
        );
    }
}


// ================= LOGOUT =================
async function logoutUser() {
    const res = await fetch("/api/logout", {
        credentials: "include"
    });

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

            // 🔥 Clear old edit task
            localStorage.removeItem(
                "editingTask"
            );

            // 🔥 Open add page
            window.location.href = "/add";
        });
    }

    const viewFilter =
        document.getElementById("view-filter");

    if (viewFilter) {

        viewFilter.addEventListener(
            "change",
            renderDashboard
        );
    }

    const tableSearch =
        document.getElementById("table-search");

    if (tableSearch) {

        tableSearch.addEventListener(
            "input",
            renderTable
        );
    }

    const managerSearch =
        document.getElementById("task-search");

    if (managerSearch) {

        managerSearch.addEventListener(
            "input",
            renderManager
        );
    }

    const categoryFilter =
        document.getElementById("category-filter");

    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            () => {

                renderTable();

                renderManager();
            }
        );
    }

    // ================= EDIT MODE =================

    const editingTask =
        localStorage.getItem("editingTask");

    const form =
        document.getElementById("task-form");

    // 🔥 EDIT TASK
    if (editingTask && form) {

        const task =
            JSON.parse(editingTask);

        const title =
            document.getElementById("title");

        if (title) {
            title.value =
                task.title || "";
        }

        const description =
            document.getElementById("description");

        if (description) {
            description.value =
                task.description || "";
        }

        const deadline =
            document.getElementById("deadline");

        if (deadline) {
            deadline.value =
                task.deadline || "";
        }

        const priority =
            document.getElementById("priority");

        if (priority) {
            priority.value =
                task.priority || "Medium";
        }

        const category =
            document.getElementById("category");

        if (category) {
            category.value =
                task.category_id || "";
        }

        form.onsubmit = function (e) {

            updateTask(e, task.id);
        };
    }

    // 🔥 CREATE TASK
    else if (form) {

        form.onsubmit = function (e) {

            saveTask(e);
        };
    }

});