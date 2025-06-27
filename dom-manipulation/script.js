function createAddQuoteForm() {
  const formDiv = document.createElement('div');

  const inputQuote = document.createElement('input');
  inputQuote.id = 'newQuoteText';
  inputQuote.type = 'text';
  inputQuote.placeholder = 'Enter a new quote';

  const inputCategory = document.createElement('input');
  inputCategory.id = 'newQuoteCategory';
  inputCategory.type = 'text';
  inputCategory.placeholder = 'Enter quote category';

  const addButton = document.createElement('button');
  addButton.textContent = 'Add Quote';
  addButton.onclick = addQuote;

  formDiv.appendChild(inputQuote);
  formDiv.appendChild(inputCategory);
  formDiv.appendChild(addButton);

  document.body.insertBefore(formDiv, document.getElementById("quoteDisplay"));
}

// Call the form creation on page load
window.onload = () => {
  createAddQuoteForm();
  populateCategoryDropdown();
};

function populateCategoryDropdown() {
  const categoryFilter = document.getElementById("categoryFilter");
  const categories = [...new Set(quotes.map(q => q.category))];

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

