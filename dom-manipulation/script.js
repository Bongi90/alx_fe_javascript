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
    useServer: document.getElementById('useServer')
};

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

function loadFromLocalStorage() {
    const savedQuotes = localStorage.getItem('quotes');
    const savedCategories = localStorage.getItem('categories');
    const lastFilter = localStorage.getItem('lastFilter');

    quotes = savedQuotes ? JSON.parse(savedQuotes) : [
        { text: "The only limit is your imagination.", category: "Inspiration" },
        { text: "Learn from yesterday, live for today.", category: "Wisdom" },
        { text: "Do or do not. There is no try.", category: "Motivation" }
    ];

    categories = savedCategories ? JSON.parse(savedCategories) : 
        [...new Set(quotes.map(quote => quote.category))];

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

function populateCategories() {
    elements.categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

function showRandomQuote() {
    const filteredQuotes = getFilteredQuotes();

    if (filteredQuotes.length === 0) {
        elements.quoteDisplay.textContent = "No quotes available for the selected category.";
        return;
    }

    const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
    const quote = filteredQuotes[randomIndex];
    displayQuote(quote);
    sessionStorage.setItem('lastQuote', JSON.stringify(quote));
}

function getFilteredQuotes() {
    const selectedCategory = elements.categoryFilter.value;
    return selectedCategory === 'all'
        ? quotes
        : quotes.filter(quote => quote.category === selectedCategory);
}

function displayQuote(quote) {
    elements.quoteDisplay.innerHTML = `
        <blockquote>"${quote.text}"</blockquote>
        <cite>— ${quote.category}</cite>
    `;
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
    const dataStr = JSON.stringify(quotes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'quotes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus("Quotes exported successfully!", "success");
}

function importQuotes(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedQuotes = JSON.parse(e.target.result);
            if (!Array.isArray(importedQuotes)) throw new Error("Invalid format");

            quotes.push(...importedQuotes);
            categories = [...new Set([...categories, ...importedQuotes.map(q => q.category)])];
            saveToLocalStorage();
            populateCategories();
            showRandomQuote();
            showStatus("Quotes imported successfully!", "success");
        } catch (err) {
            showStatus("Failed to import quotes: " + err.message, "error");
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

function showStatus(message, type) {
    elements.syncStatus.textContent = message;
    elements.syncStatus.className = `sync-status ${type}`;
    elements.syncStatus.style.display = 'block';
    setTimeout(() => {
        elements.syncStatus.style.display = 'none';
    }, 4000);
}

async function fetchQuotesFromServer() {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    const data = await response.json();
    return {
        quotes: data.slice(0, 3).map(post => ({ text: post.title, category: "Server" })),
        lastModified: new Date().toISOString()
    };
}

async function syncWithServer() {
    showStatus("Syncing with server...", "success");
    const serverData = await fetchQuotesFromServer();

    if (!lastSyncTime || new Date(serverData.lastModified) > new Date(lastSyncTime)) {
        const localModified = localStorage.getItem('localModified');
        if (localModified && new Date(localModified) > new Date(lastSyncTime)) {
            showConflictResolution(serverData.quotes);
            return;
        }
        quotes.push(...serverData.quotes);
        categories = [...new Set([...categories, ...serverData.quotes.map(q => q.category)])];
        saveToLocalStorage();
    }

    lastSyncTime = new Date().toISOString();
    saveLastSyncTime();
    showStatus("Sync complete!", "success");
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
    const serverQuotes = JSON.parse(elements.conflictResolution.dataset.serverQuotes || '[]');

    if (choice === 'server') {
        quotes = serverQuotes;
        categories = [...new Set(serverQuotes.map(q => q.category))];
        populateCategories();
        saveToLocalStorage();
        showRandomQuote();
    }

    lastSyncTime = new Date().toISOString();
    saveLastSyncTime();
    hideConflictResolution();
    showStatus("Conflict resolved using " + choice + " data.", "success");
}

function setupEventListeners() {
    elements.newQuoteBtn.addEventListener('click', showRandomQuote);
    elements.addQuoteBtn.addEventListener('click', addQuote);
    elements.exportBtn.addEventListener('click', exportQuotes);
    elements.importFile.addEventListener('change', importQuotes);
    elements.clearStorageBtn.addEventListener('click', clearAllQuotes);
    elements.categoryFilter.addEventListener('change', filterQuotes);
    elements.syncNowBtn.addEventListener('click', syncWithServer);
    elements.useLocal.addEventListener('click', () => resolveConflict('local'));
    elements.useServer.addEventListener('click', () => resolveConflict('server'));
}

function startSyncInterval() {
    syncInterval = setInterval(syncWithServer, 30000);
}

const exportToJsonFile = exportQuotes;
const importFromJsonFile = importQuotes;

init();
