"use strict";
// src/index.ts
// A compact but fully-featured TypeScript to-do app
const LS_KEY = 'ts_todo_tasks_v1';
const $ = (selector) => document.querySelector(selector);
const form = $('#todo-form');
const input = $('#new-task');
const addBtn = $('#add-btn');
const list = $('#task-list');
const remaining = $('#remaining');
const filterButtons = Array.from(document.querySelectorAll('.filter'));
const clearCompletedBtn = $('#clear-completed');
let tasks = loadTasks();
let currentFilter = 'all';
// ---------- Persistence ----------
function saveTasks() {
    localStorage.setItem(LS_KEY, JSON.stringify(tasks));
}
function loadTasks() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        // Basic validation to ensure correct shape
        return parsed.map(t => ({
            id: String(t.id),
            title: String(t.title),
            completed: Boolean(t.completed),
            createdAt: Number(t.createdAt) || Date.now()
        }));
    }
    catch {
        return [];
    }
}
// ---------- Utilities ----------
function uid() {
    return Math.random().toString(36).slice(2, 9);
}
function countRemaining() {
    return tasks.filter(t => !t.completed).length;
}
function applyFilter(t) {
    if (currentFilter === 'all')
        return true;
    if (currentFilter === 'active')
        return !t.completed;
    return t.completed;
}
// ---------- Rendering ----------
function render() {
    list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    tasks.filter(applyFilter).forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.draggable = true;
        li.dataset.id = task.id;
        // checkbox
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = task.completed;
        cb.className = 'checkbox';
        cb.addEventListener('change', () => toggleComplete(task.id));
        // title or edit input
        const titleSpan = document.createElement('div');
        titleSpan.className = 'title';
        titleSpan.textContent = task.title;
        if (task.completed)
            titleSpan.classList.add('completed');
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'small-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => beginEdit(li, task));
        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'small-btn';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => removeTask(task.id));
        li.appendChild(cb);
        li.appendChild(titleSpan);
        li.appendChild(editBtn);
        li.appendChild(delBtn);
        attachDragHandlers(li);
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
    remaining.textContent = String(countRemaining());
    saveTasks();
}
// ---------- CRUD ----------
function addTask(title) {
    const trimmed = title.trim();
    if (!trimmed)
        return;
    const t = { id: uid(), title: trimmed, completed: false, createdAt: Date.now() };
    tasks.unshift(t); // newest first
    render();
}
function removeTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    render();
}
function toggleComplete(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    render();
}
function updateTaskTitle(id, newTitle) {
    const trimmed = newTitle.trim();
    if (!trimmed)
        return;
    tasks = tasks.map(t => t.id === id ? { ...t, title: trimmed } : t);
    render();
}
// ---------- Editing ----------
function beginEdit(listItem, task) {
    const titleEl = listItem.querySelector('.title');
    const editInput = document.createElement('input');
    editInput.className = 'edit-input';
    editInput.value = task.title;
    listItem.replaceChild(editInput, titleEl);
    editInput.focus();
    editInput.select();
    const finish = () => {
        updateTaskTitle(task.id, editInput.value);
    };
    const cancel = () => {
        render(); // revert
    };
    editInput.addEventListener('blur', finish, { once: true });
    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finish();
        }
        else if (e.key === 'Escape') {
            cancel();
        }
    });
}
// ---------- Filters ----------
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        render();
    });
});
// ---------- Clear completed ----------
clearCompletedBtn.addEventListener('click', () => {
    tasks = tasks.filter(t => !t.completed);
    render();
});
// ---------- Form handling ----------
form.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask(input.value);
    input.value = '';
});
// ---------- Drag & Drop reordering ----------
let dragSrcId = null;
function attachDragHandlers(li) {
    li.addEventListener('dragstart', (e) => {
        var _a;
        const id = li.dataset.id;
        if (!id)
            return;
        dragSrcId = id;
        li.classList.add('dragging');
        (_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        dragSrcId = null;
    });
    li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    li.addEventListener('drop', (e) => {
        var _a;
        e.preventDefault();
        const targetId = li.dataset.id;
        const sourceId = ((_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.getData('text/plain')) || dragSrcId;
        if (!sourceId || !targetId || sourceId === targetId)
            return;
        reorderTasks(sourceId, targetId);
    });
}
function reorderTasks(sourceId, targetId) {
    const srcIndex = tasks.findIndex(t => t.id === sourceId);
    const tgtIndex = tasks.findIndex(t => t.id === targetId);
    if (srcIndex < 0 || tgtIndex < 0)
        return;
    const [moved] = tasks.splice(srcIndex, 1);
    tasks.splice(tgtIndex, 0, moved);
    render();
}
// ---------- Initialization ----------
render();
// Expose tasks to the console for quick debugging (optional)
window.tsTodo = {
    getTasks: () => tasks,
    setTasks: (t) => { tasks = t; render(); }
};
