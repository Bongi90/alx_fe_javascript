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
    loadFromLocalStorage();
    populateCategories();
    setupEventListeners();
    showRandomQuote();
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
    a.download = 'quotes-backup.json';
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
    reader.onload = function(e) {
        try {
            const importedQuotes = JSON.parse(e.target.result);
            if (!Array.isArray(importedQuotes)) {
                throw new Error("Invalid format: Expected an array of quotes");
            }
            
            quotes.push(...importedQuotes);
            const newCategories = importedQuotes.map(q => q.category);
            categories = [...new Set([...categories, ...newCategories])];
            
            saveToLocalStorage();
            populateCategories();
            showRandomQuote();
            showStatus(`Successfully imported ${importedQuotes.length} quotes!`, "success");
        } catch (error) {
            showStatus(`Error importing quotes: ${error.message}`, "error");
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function clearAllQuotes() {
    if (quotes.length === 0) {
        showStatus("No quotes to clear!", "error");
        return;
    }
    
    if (confirm("Are you sure you want to delete ALL quotes? This cannot be undone.")) {
        quotes = [];
        categories = [];
        saveToLocalStorage();
        populateCategories();
        elements.quoteDisplay.textContent = "All quotes have been cleared.";
        showStatus("All quotes cleared.", "success");
    }
}

async function fetchQuotesFromServer() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const serverQuotes = JSON.parse(localStorage.getItem('serverQuotes')) || [];
            const serverModified = localStorage.getItem('serverModified') || new Date().toISOString();
            
            if (Math.random() > 0.7) {
                const newServerQuote = {
                    text: ["The server says hello!", "From the cloud with love", "Synced wisdom"][Math.floor(Math.random() * 3)],
                    category: "Server"
                };
                serverQuotes.push(newServerQuote);
                localStorage.setItem('serverQuotes', JSON.stringify(serverQuotes));
                localStorage.setItem('serverModified', new Date().toISOString());
            }
            
            resolve({
                quotes: serverQuotes,
                lastModified: serverModified
            });
        }, 1000);
    });
}

async function syncWithServer() {
    showStatus("Syncing with server...", "success");
    
    try {
        const serverData = await fetchQuotesFromServer();
        
        if (!lastSyncTime || new Date(serverData.lastModified) > new Date(lastSyncTime)) {
            const localModified = localStorage.getItem('localModified');
            if (lastSyncTime && localModified && new Date(localModified) > new Date(lastSyncTime)) {
                showConflictResolution(serverData.quotes);
                return;
            }
            
            mergeQuotes(serverData.quotes);
        }
        
        lastSyncTime = new Date().toISOStri
