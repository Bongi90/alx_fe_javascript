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

// Initialize App
function init() {
  loadFromLocalStorage();
  populateCategories();
  setupEventListeners();
  showRandomQuote();
  startSyncInterval();
}

// Load from local storage
function loadFromLocalStorage() {
  const savedQuotes = localStorage.getItem('quotes');
  const savedCategories = localStorage.getItem('categories');
  const lastFilter = localStorage.getItem('lastFilter');

  quotes = savedQuotes ? JSON.parse(savedQuotes) : [
    { text: "The only limit is your imagination.", category: "Inspiration" },
    { text: "Learn from yesterday, live for today.", category: "Wisdom" },
    { text: "Do or do not. There is no try.", category: "Motivation" }
  ];

  categories = savedCategories ? JSON.parse(savedCategories) : [...new Set(quotes.map(q => q.category))];

  if (lastFilter) {
    elements.categoryFilter.value = lastFilter;
  }
}

function saveToLocalStorage() {
  localStorage.setItem('quotes', JSON.stringify(quotes));
  localStorage.setItem('categories', JSON.stringify(categories));
  localStorage.setItem('lastFilter', elements.categoryFilter.value);
  localStorage.setItem('localModified', new Date().toISOString());
}

// Populate categories in dropdown
function populateCategories() {
  elements.categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    elements.categoryFilter.appendChild(opt);
  });
}

// Show a random quote
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
  const category = elements.categoryFilter.value;
  return category === "all" ? quotes : quotes.filter(q => q.category === category);
}

function displayQuote(quote) {
  elements.quoteDisplay.innerHTML = `<blockquote>"${quote.text}"</blockquote><cite>— ${quote.category}</cite>`;
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
  showRandomQuote();
  elements.newQuoteText.value = "";
  elements.newQuoteCategory.value = "";
  showStatus("Quote added!", "success");
}

// Export to JSON
function exportQuotes() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  URL.revokeObjectURL(url);
  showStatus("Quotes exported!", "success");
}

// Import from JSON
function importQuotes(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      quotes.push(...importedQuotes);
      categories = [...new Set([...categories, ...importedQuotes.map(q => q.category)])];
      saveToLocalStorage();
      populateCategories();
      showStatus("Quotes imported!", "success");
    } catch (err) {
      showStatus("Import failed", "error");
    }
  };
  reader.readAsText(file);
}

// Clear all quotes
function clearAllQuotes() {
  if (confirm("Clear all quotes?")) {
    quotes = [];
    categories = [];
    saveToLocalStorage();
    populateCategories();
    elements.quoteDisplay.textContent = "All quotes cleared.";
    showStatus("All cleared", "success");
  }
}

// Show status messages
function showStatus(message, type) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.className = `sync-status ${type}`;
  elements.syncStatus.style.display = 'block';
  setTimeout(() => elements.syncStatus.style.display = 'none', 3000);
}

async function fetchQuotesFromServer() {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts");
  const data = await response.json();
  const quotesFromServer = data.slice(0, 5).map(post => ({
    text: post.title,
    category: "Server"
  }));
  return { quotes: quotesFromServer, lastModified: new Date().toISOString() };
}

async function syncQuotes() {
  try {
    showStatus("Syncing with server...", "success");
    const serverData = await fetchQuotesFromServer();
    const localModified = localStorage.getItem("localModified");
    const serverTime = new Date(serverData.lastModified);

    if (localModified && new Date(localModified) > serverTime) {
      showStatus("Local changes are newer. Skipping server merge.", "conflict");
    } else {
      quotes.push(...serverData.quotes);
      categories = [...new Set([...categories, ...serverData.quotes.map(q => q.category)])];
      saveToLocalStorage();
      populateCategories();
      showStatus("Quotes synced from server.", "success");
    }

    await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quotes)
    });

    showStatus("Local quotes sent to server.", "success");
  } catch (error) {
    console.error("Sync error:", error);
    showStatus("Error syncing with server", "error");
  }
}

function startSyncInterval() {
  syncInterval = setInterval(syncQuotes, 30000); // every 30 seconds
}

// Event listeners
function setupEventListeners() {
  elements.newQuoteBtn.addEventListener("click", showRandomQuote);
  elements.addQuoteBtn.addEventListener("click", addQuote);
  elements.exportBtn.addEventListener("click", exportQuotes);
  elements.importFile.addEventListener("change", importQuotes);
  elements.clearStorageBtn.addEventListener("click", clearAllQuotes);
  elements.categoryFilter.addEventListener("change", filterQuotes);
  elements.syncNowBtn.addEventListener("click", syncQuotes);
}

const exportToJsonFile = exportQuotes;
const importFromJsonFile = importQuotes;

// Init app
init();
