let TEMPLATES = [];
let CURRENT_ITEM_COUNT = 0;
let EDITING_TEMPLATE_ID = null;   // null = creating new
let USE_TEMPLATE_ID = null;

document.addEventListener("DOMContentLoaded", () => {
    loadTemplates();

    document.getElementById("new-template-btn")
        .addEventListener("click", () => openTemplateModal());

    document.getElementById("tpl-cancel-btn")
        .addEventListener("click", closeTemplateModal);

    document.getElementById("tpl-add-item-btn")
        .addEventListener("click", () => addItemRow(""));

    document.getElementById("tpl-save-btn")
        .addEventListener("click", saveTemplate);

    document.getElementById("use-cancel-btn")
        .addEventListener("click", closeUseModal);

    document.getElementById("use-confirm-btn")
        .addEventListener("click", confirmUseTemplate);
});

// ─────────────────────────────────────────────
// Load + render
// ─────────────────────────────────────────────
async function loadTemplates() {
    const list = document.getElementById("templates-list");
    try {
        const res = await fetch("/api/task-templates", { credentials: "include" });
        if (!res.ok) throw new Error();
        TEMPLATES = await res.json();
        renderTemplates();
    } catch (e) {
        list.innerHTML = `<p class="muted">Failed to load templates.</p>`;
    }
}

function renderTemplates() {
    const list = document.getElementById("templates-list");

    if (!TEMPLATES.length) {
        list.innerHTML = `
            <div class="no-templates">
                📋 No templates yet. Create one to reuse common checklists.
            </div>`;
        return;
    }

    list.innerHTML = TEMPLATES.map(t => `
        <div class="tpl-card">
            <div class="tpl-card-title">${escHtml(t.name)}</div>
            <div class="tpl-card-count">${t.item_count} item${t.item_count !== 1 ? "s" : ""}</div>
            <ul class="tpl-card-items">
                ${t.items.slice(0, 5).map(i => `<li>${escHtml(i.text)}</li>`).join("")}
                ${t.items.length > 5 ? `<li style="opacity:.6">+ ${t.items.length - 5} more…</li>` : ""}
            </ul>
            <div class="tpl-card-actions">
                <button class="btn-use" onclick="openUseModal(${t.id})">▶ Use</button>
                <button class="btn-edit-tpl" onclick="openTemplateModal(${t.id})">✏️ Edit</button>
                <button class="btn-delete-tpl" onclick="deleteTemplate(${t.id})">🗑️ Delete</button>
            </div>
        </div>
    `).join("");
}

// ─────────────────────────────────────────────
// Create / Edit modal
// ─────────────────────────────────────────────
function openTemplateModal(templateId = null) {
    EDITING_TEMPLATE_ID = templateId;
    document.getElementById("tpl-modal-msg").textContent = "";
    document.getElementById("tpl-items-wrap").innerHTML = "";
    CURRENT_ITEM_COUNT = 0;

    if (templateId) {
        const t = TEMPLATES.find(x => x.id === templateId);
        document.getElementById("tpl-modal-title").textContent = "Edit Template";
        document.getElementById("tpl-name-input").value = t.name;
        t.items.forEach(i => addItemRow(i.text));
    } else {
        document.getElementById("tpl-modal-title").textContent = "New Template";
        document.getElementById("tpl-name-input").value = "";
        addItemRow("");
        addItemRow("");
        addItemRow("");
    }

    document.getElementById("template-modal").style.display = "flex";
}

function closeTemplateModal() {
    document.getElementById("template-modal").style.display = "none";
    EDITING_TEMPLATE_ID = null;
}

function addItemRow(value) {
    const wrap = document.getElementById("tpl-items-wrap");
    const id = `tpl-item-${CURRENT_ITEM_COUNT++}`;
    const row = document.createElement("div");
    row.className = "tpl-item-row";
    row.innerHTML = `
        <input type="text" class="tpl-input tpl-item-input" id="${id}"
               placeholder="Checklist item…" value="${escHtml(value)}" />
        <button type="button" class="tpl-item-remove" onclick="this.parentElement.remove()">✕</button>
    `;
    wrap.appendChild(row);
}

async function saveTemplate() {
    const name = document.getElementById("tpl-name-input").value.trim();
    const msgEl = document.getElementById("tpl-modal-msg");
    const items = Array.from(document.querySelectorAll(".tpl-item-input"))
        .map(inp => inp.value.trim())
        .filter(Boolean);

    if (!name) {
        msgEl.className = "tpl-modal-msg err";
        msgEl.textContent = "Template name is required.";
        return;
    }
    if (!items.length) {
        msgEl.className = "tpl-modal-msg err";
        msgEl.textContent = "Add at least one checklist item.";
        return;
    }

    const url = EDITING_TEMPLATE_ID
        ? `/api/task-templates/${EDITING_TEMPLATE_ID}`
        : `/api/task-templates`;
    const method = EDITING_TEMPLATE_ID ? "PATCH" : "POST";

    try {
        const res = await fetch(url, {
            method, credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, items })
        });
        const data = await res.json();

        if (!res.ok) {
            msgEl.className = "tpl-modal-msg err";
            msgEl.textContent = data.error || "Failed to save template.";
            return;
        }

        closeTemplateModal();
        await loadTemplates();
        showSuccess(EDITING_TEMPLATE_ID ? "Template updated." : "Template created.");
    } catch (e) {
        msgEl.className = "tpl-modal-msg err";
        msgEl.textContent = "Network error.";
    }
}

async function deleteTemplate(id) {
    if (!confirm("Delete this template? This cannot be undone.")) return;

    const res = await fetch(`/api/task-templates/${id}`, {
        method: "DELETE", credentials: "include"
    });

    if (res.ok) {
        await loadTemplates();
        showSuccess("Template deleted.");
    } else {
        showError("Failed to delete template.");
    }
}

// ─────────────────────────────────────────────
// Use-template modal
// ─────────────────────────────────────────────
function openUseModal(templateId) {
    USE_TEMPLATE_ID = templateId;
    const t = TEMPLATES.find(x => x.id === templateId);

    document.getElementById("use-title-input").value = t.name;
    document.getElementById("use-deadline-input").value = "";
    document.getElementById("use-priority-input").value = "Medium";
    document.getElementById("use-modal-msg").textContent = "";

    document.getElementById("use-modal").style.display = "flex";
}

function closeUseModal() {
    document.getElementById("use-modal").style.display = "none";
    USE_TEMPLATE_ID = null;
}

async function confirmUseTemplate() {
    const title = document.getElementById("use-title-input").value.trim();
    const deadline = document.getElementById("use-deadline-input").value;
    const priority = document.getElementById("use-priority-input").value;
    const msgEl = document.getElementById("use-modal-msg");

    if (!title) {
        msgEl.className = "tpl-modal-msg err";
        msgEl.textContent = "Task title is required.";
        return;
    }

    try {
        const res = await fetch(`/api/task-templates/${USE_TEMPLATE_ID}/use`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, deadline: deadline || null, priority })
        });
        const data = await res.json();

        if (!res.ok) {
            msgEl.className = "tpl-modal-msg err";
            msgEl.textContent = data.error || "Failed to create task.";
            return;
        }

        window.location.href = `/tasks/${data.task.id}`;
    } catch (e) {
        msgEl.className = "tpl-modal-msg err";
        msgEl.textContent = "Network error.";
    }
}

// ─────────────────────────────────────────────
// Utility (mirrors script.js's helpers so this
// file works standalone even if script.js isn't loaded here)
// ─────────────────────────────────────────────
function showSuccess(msg) {
    const box = document.getElementById("message-box");
    if (box) box.innerHTML = `<div class="alert-success">${escHtml(msg)}</div>`;
}
function showError(msg) {
    const box = document.getElementById("message-box");
    if (box) box.innerHTML = `<div class="alert-error">${escHtml(msg)}</div>`;
}
function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}