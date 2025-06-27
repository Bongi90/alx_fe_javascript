let quotes = [];
let categories = [];
let syncInterval;
let lastSyncTime = null;

const elements = {
  quoteDisplay: document.getElementById('quoteDisplay'),
  newQuoteBtn: document.getElementById('newQuote'),
  addQuoteBtn: document.getElementById('addQuoteBtn'),
  newQuoteText: document.getElementById('newQuoteText'),
  newQuoteCategory: document.getElementById('newQuoteCategory'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  clearStorageBtn: document.getElementById('clearStorage'),
  categoryFilter: document.getElementById('categoryFilter'),
  syncNowBtn: document.getElementById('syncNow'),
  syncStatus: document.getElementById('syncStatus'),
  conflictResolution: document.getElementById('conflictResolution'),
  conflictMessage: document.getElementById('conflictMessage'),
  useLocal: document.getElementById('useLocal'),
  useServer: document.getElementById('useServer'),
};

// -------- Initial Setup --------
function init() {
  loadLastSyncTime();
  loadFromLocalStorage();
  populateCategories();
  setupEventListeners();

  const lastQuote = sessionStorage.getItem('lastQuote');
  if (lastQuote) {
    displayQuote(JSON.parse(lastQuote));
  } else {
    showRandomQuote();
  }

  startSyncInterval();
}

// -------- Storage Helpers --------
function loadFromLocalStorage() {
  const savedQuotes = localStorage.getItem('quotes');
  const savedCategories = localStorage.getItem('categories');
  const lastFilter = localStorage.getItem('lastFilter');

  quotes = savedQuotes ? JSON.parse(savedQuotes) : [
    { text: "The only limit is your imagination.", category: "Inspiration" },
    { text: "Learn from yesterday, live for today.", category: "Wisdom" },
    { text: "Do or do not. There is no try.", category: "Motivation" }
  ];

  categories = savedCategories
    ? JSON.parse(savedCategories)
    : [...new Set(quotes.map(q => q.category))];

  if (lastFilter) {
    elements.categoryFilter.value = lastFilter;
    filterQuotes();
  }
}

function saveToLocalStorage() {
  localStorage.setItem('quotes', JSON.stringify(quotes));
  localStorage.setItem('categories', JSON.stringify(categories));
  localStorage.setItem('lastFilter', elements.categoryFilter.value);
  localStorage.setItem('localModified', new Date().toISOString());
}

function loadLastSyncTime() {
  lastSyncTime = localStorage.getItem('lastSyncTime') || null;
}

function saveLastSyncTime() {
  localStorage.setItem('lastSyncTime', lastSyncTime);
}

// -------- UI & DOM Helpers --------
function populateCategories() {
  elements.categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    elements.categoryFilter.appendChild(opt);
  });
}

function showRandomQuote() {
  const filtered = getFilteredQuotes();
  if (!filtered.length) {
    elements.quoteDisplay.textContent = "No quotes available for the selected category.";
    return;
  }
  const quote = filtered[Math.floor(Math.random() * filtered.length)];
  displayQuote(quote);
  sessionStorage.setItem('lastQuote', JSON.stringify(quote));
}

function getFilteredQuotes() {
  const sel = elements.categoryFilter.value;
  return sel === 'all' ? quotes : quotes.filter(q => q.category === sel);
}

function displayQuote(q) {
  elements.quoteDisplay.innerHTML = `<blockquote>"${q.text}"</blockquote><cite>— ${q.category}</cite>`;
}

function filterQuotes() {
  showRandomQuote();
  saveToLocalStorage();
}

function addQuote() {
  const text = elements.newQuoteText.value.trim();
  const category = elements.newQuoteCategory.value.trim();
  if (!text || !category) {
    showStatus("Please enter both quote and category!", "error");
    return;
  }
  const newQuote = { text, category };
  quotes.push(newQuote);
  if (!categories.includes(category)) {
    categories.push(category);
    populateCategories();
  }
  saveToLocalStorage();
  elements.newQuoteText.value = "";
  elements.newQuoteCategory.value = "";
  showRandomQuote();
  showStatus("Quote added successfully!", "success");
}

function exportQuotes() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quotes.json';
  a.click();
  URL.revokeObjectURL(url);
  showStatus("Quotes exported successfully!", "success");
}

function importQuotes(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const arr = JSON.parse(e.target.result);
      if (!Array.isArray(arr)) throw new Error("Invalid format");
      quotes.push(...arr);
      categories = [...new Set([...categories, ...arr.map(q => q.category)])];
      saveToLocalStorage();
      populateCategories();
      showRandomQuote();
      showStatus("Quotes imported successfully!", "success");
    } catch (err) {
      showStatus("Import failed: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}

function clearAllQuotes() {
  if (confirm("Delete all quotes?")) {
    quotes = [];
    categories = [];
    saveToLocalStorage();
    populateCategories();
    elements.quoteDisplay.textContent = "All quotes have been cleared.";
    showStatus("All quotes cleared.", "success");
  }
}

function showStatus(msg, type) {
  elements.syncStatus.textContent = msg;
  elements.syncStatus.className = `sync-status ${type}`;
  elements.syncStatus.style.display = 'block';
  setTimeout(() => { elements.syncStatus.style.display = 'none'; }, 4000);
}

// -------- Sync & Server --------

function fetchQuotesFromServer() {
  return fetch("https://jsonplaceholder.typicode.com/posts")
    .then(res => res.json())
    .then(data => ({
      quotes: data.slice(0, 3).map(post => ({
        text: post.title,
        category: "Server",
      })),
      lastModified: new Date().toISOString(),
    }));
}

function syncQuotes() {
  showStatus("Syncing with server...", "success");

  fetchQuotesFromServer()
    .then(serverData => {
      const serverQs = serverData.quotes;
      const localModified = localStorage.getItem('localModified');
      const serverTime = serverData.lastModified;

      if (lastSyncTime && localModified && new Date(localModified) > new Date(lastSyncTime)) {
        showConflictResolution(serverQs);
      } else {
        quotes.push(...serverQs);
        categories = [...new Set([...categories, ...serverQs.map(q => q.category)])];
        saveToLocalStorage();
        populateCategories();
        showRandomQuote();
        showStatus("Synced and merged with server!", "success");
      }

      lastSyncTime = serverTime;
      saveLastSyncTime();

      return fetch("https://jsonplaceholder.typicode.com/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotes),
      });
    })
    .then(res => {
      if (!res.ok) throw new Error("POST failed");
      showStatus("Posted local quotes to server", "success");
    })
    .catch(err => {
      console.error(err);
      showStatus("Error syncing with server", "error");
    });
}

function showConflictResolution(serverQuotes) {
  elements.conflictResolution.style.display = 'block';
  elements.conflictMessage.textContent = "Conflict detected. Choose which data to keep.";
  elements.conflictResolution.dataset.serverQuotes = JSON.stringify(serverQuotes);
}

function hideConflictResolution() {
  elements.conflictResolution.style.display = 'none';
  elements.conflictMessage.textContent = '';
}

function resolveConflict(choice) {
  const serverQs = JSON.parse(elements.conflictResolution.dataset.serverQuotes);

  if (choice === 'server') {
    quotes = serverQs;
    categories = [...new Set(serverQs.map(q => q.category))];
    populateCategories();
    saveToLocalStorage();
    showRandomQuote();
  }

  lastSyncTime = new Date().toISOString();
  saveLastSyncTime();
  hideConflictResolution();
  showStatus(`Conflict resolved using ${choice} data.`, "success");
}

function setupEventListeners() {
  elements.newQuoteBtn.addEventListener('click', showRandomQuote);
  elements.addQuoteBtn.addEventListener('click', addQuote);
  elements.exportBtn.addEventListener('click', exportQuotes);
  elements.importFile.addEventListener('change', importQuotes);
  elements.clearStorageBtn.addEventListener('click', clearAllQuotes);
  elements.categoryFilter.addEventListener('change', filterQuotes);
  elements.syncNowBtn.addEventListener('click', syncQuotes);
  elements.useLocal.addEventListener('click', () => resolveConflict('local'));
  elements.useServer.addEventListener('click', () => resolveConflict('server'));
}

function startSyncInterval() {
  syncInterval = setInterval(syncQuotes, 30000);
}

const exportToJsonFile = exportQuotes;
const importFromJsonFile = importQuotes;

init();


const exportToJsonFile = exportQuotes;
const importFromJsonFile = importQuotes;

init();

