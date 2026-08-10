let db = loadDB();

function addCategory(name) {
  name = name.trim();
  if (!name) return;
  db.categories.push({ id: uid(), name, entries: [] });
  saveDBState(db);
  render();
}

function deleteCategory(categoryId) {
  db.categories = db.categories.filter((c) => c.id !== categoryId);
  saveDBState(db);
  render();
}

function render() {
  const container = document.getElementById('categoriesContainer');
  container.innerHTML = '';

  if (db.categories.length === 0) {
    container.className = '';
    container.innerHTML = '<div class="empty-state">No categories yet. Add one above to get started.</div>';
    return;
  }

  container.className = 'category-grid';

  db.categories.forEach((cat) => {
    const count = cat.entries.length;
    const tile = document.createElement('a');
    tile.className = 'category-tile';
    tile.href = `category.html?id=${cat.id}`;
    tile.innerHTML = `
      <button class="icon-btn tile-delete" data-action="delete-category" data-category="${cat.id}" title="Delete category">&times;</button>
      <div class="tile-icon">${pickCategoryEmoji(cat.name)}</div>
      <div class="tile-name">${escapeHtml(cat.name)}</div>
      <div class="tile-count">${count} birthday${count === 1 ? '' : 's'}</div>
    `;
    container.appendChild(tile);
  });
}

// Database is fully paid (locked gating spec: zero free entries) - the
// whole New Category form swaps for the lock tease when not entitled.
if (!c13Entitled()) {
  const box = document.querySelector('.add-category-box');
  if (box) {
    box.innerHTML = c13LockHtml(
      'The Database',
      'Your mom, your boss, the name that just texted you. Everyone runs on a number they have never seen.',
      'You have read yourself. Now read the room.'
    );
  }
}

// Null-guarded: the lock swap above removes both elements for free users.
const addCategoryBtnEl = document.getElementById('addCategoryBtn');
if (addCategoryBtnEl) {
  addCategoryBtnEl.addEventListener('click', () => {
    const input = document.getElementById('newCategoryName');
    addCategory(input.value);
    input.value = '';
    input.focus();
  });
}

const newCategoryNameEl = document.getElementById('newCategoryName');
if (newCategoryNameEl) {
  newCategoryNameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCategoryBtnEl.click();
  });
}

document.getElementById('categoriesContainer').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="delete-category"]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const categoryId = btn.dataset.category;
  const cat = db.categories.find((c) => c.id === categoryId);
  const label = cat ? cat.name : 'this category';
  if (confirm(`Delete "${label}" and all its birthdays?`)) deleteCategory(categoryId);
});

render();
