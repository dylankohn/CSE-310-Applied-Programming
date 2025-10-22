// Initialize interface and variables
interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

type Filter = 'all' | 'active' | 'completed';

const LS_KEY = 'ts_todo_tasks_v1';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector(selector) as T | null;

// ---------- DOM Elements ----------
const form = $('#todo-form') as HTMLFormElement;
const input = $('#new-task') as HTMLInputElement;
const addBtn = $('#add-btn') as HTMLButtonElement;
const list = $('#task-list') as HTMLUListElement;
const remaining = $('#remaining') as HTMLSpanElement;
const filterButtons = Array.from(document.querySelectorAll('.filter')) as HTMLButtonElement[];
const clearCompletedBtn = $('#clear-completed') as HTMLButtonElement;

let tasks: Task[] = loadTasks();
let currentFilter: Filter = 'all';

// ---------- Persistence ----------
function saveTasks() {
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
}

// Load tasks from local storage
function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Task[];
    // Basic validation to ensure correct shape
    return parsed.map(t => ({
      id: String(t.id),
      title: String(t.title),
      completed: Boolean(t.completed),
      createdAt: Number(t.createdAt) || Date.now()
    }));
  } catch {
    return [];
  }
}

// ---------- Utilities ----------
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function countRemaining(): number {
  return tasks.filter(t => !t.completed).length;
}

function applyFilter(t: Task): boolean {
  if (currentFilter === 'all') return true;
  if (currentFilter === 'active') return !t.completed;
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

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = task.completed;
    cb.className = 'checkbox';
    cb.addEventListener('change', () => toggleComplete(task.id));

    // Title or edit input
    const titleSpan = document.createElement('div');
    titleSpan.className = 'title';
    titleSpan.textContent = task.title;
    if (task.completed) titleSpan.classList.add('completed');

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
function addTask(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const t: Task = { id: uid(), title: trimmed, completed: false, createdAt: Date.now() };
  tasks.unshift(t); // newest first
  render();
}

function removeTask(id: string) {
  tasks = tasks.filter(t => t.id !== id);
  render();
}

function toggleComplete(id: string) {
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  render();
}

function updateTaskTitle(id: string, newTitle: string) {
  const trimmed = newTitle.trim();
  if (!trimmed) return;
  tasks = tasks.map(t => t.id === id ? { ...t, title: trimmed } : t);
  render();
}

// ---------- Editing ----------
function beginEdit(listItem: HTMLLIElement, task: Task) {
  const titleEl = listItem.querySelector('.title') as HTMLDivElement;
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
    render(); // Revert to original
  };

  editInput.addEventListener('blur', finish, { once: true });
  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      finish();
    } else if (e.key === 'Escape') {
      cancel();
    }
  });
}

// ---------- Filters ----------
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter as Filter;
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
let dragSrcId: string | null = null;

function attachDragHandlers(li: HTMLLIElement) {
  li.addEventListener('dragstart', (e) => {
    const id = li.dataset.id;
    if (!id) return;
    dragSrcId = id;
    li.classList.add('dragging');
    e.dataTransfer?.setData('text/plain', id);
    e.dataTransfer!.effectAllowed = 'move';
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    dragSrcId = null;
  });

  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  });

  li.addEventListener('drop', (e) => {
    e.preventDefault();
    const targetId = li.dataset.id;
    const sourceId = e.dataTransfer?.getData('text/plain') || dragSrcId;
    if (!sourceId || !targetId || sourceId === targetId) return;
    reorderTasks(sourceId, targetId);
  });
}

function reorderTasks(sourceId: string, targetId: string) {
  const srcIndex = tasks.findIndex(t => t.id === sourceId);
  const tgtIndex = tasks.findIndex(t => t.id === targetId);
  if (srcIndex < 0 || tgtIndex < 0) return;
  const [moved] = tasks.splice(srcIndex, 1);
  tasks.splice(tgtIndex, 0, moved);
  render();
}

// ---------- Initialization ----------
render();

(window as any).tsTodo = {
  getTasks: () => tasks,
  setTasks: (t: Task[]) => { tasks = t; render(); }
};
