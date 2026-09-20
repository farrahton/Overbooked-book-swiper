import { apiGetUnswipedBooks, apiLogSwipe, apiAddBook, apiGetMatches } from './db.js';

let currentUser = localStorage.getItem('swiper_username') || '';
let bookQueue = [];

// Expose these lifecycle handlers explicitly to the inline HTML layer
window.saveUsername = saveUsername;
window.handleManualSwipe = handleManualSwipe;
window.toggleModal = toggleModal;
window.submitBook = submitBook;

if (currentUser) {
  document.getElementById('setup-screen').classList.add('hidden');
  initApp();
}

function saveUsername() {
  const name = document.getElementById('username-input').value.trim();
  if (!name) return alert("Please enter a name.");
  localStorage.setItem('swiper_username', name);
  currentUser = name;
  document.getElementById('setup-screen').classList.add('hidden');
  initApp();
}

function initApp() {
  document.getElementById('user-display').innerText = `Swiping as: ${currentUser}`;
  refreshDeck();
  
  // High-reliability sync: Check for new group additions every 10 seconds
  setInterval(() => {
    refreshDeck();
  }, 10000);
}

async function refreshDeck() {
  bookQueue = await apiGetUnswipedBooks(currentUser);
  renderDeck();
}

async function renderDeck() {
  const container = document.getElementById('card-container');
  const emptyState = document.getElementById('empty-state');
  container.innerHTML = '';

  if (bookQueue.length === 0) {
    emptyState.classList.remove('hidden');
    
    const matchesList = document.getElementById('end-matches-list');
    matchesList.innerHTML = `<p class="text-[11px] text-stone-400 text-center py-4 tracking-wider animate-pulse">Consulting records...</p>`;
    
    const winningBooks = await apiGetMatches();
    matchesList.innerHTML = '';

    if (winningBooks.length === 0) {
      matchesList.innerHTML = `<p class="text-[11px] text-stone-400 text-center py-4 font-light">No group consensus matches yet. Wait for friends to finish swiping!</p>`;
      return;
    }

    winningBooks.forEach(book => {
      const item = document.createElement('div');
      item.className = "bg-white border border-stone-200 p-3 rounded-lg shadow-2xs flex items-center justify-between gap-3";
      item.innerHTML = `
        <div class="text-left min-w-0 flex-1">
          <h4 class="font-serif font-medium text-stone-800 text-sm line-clamp-1">${book.title}</h4>
          <p class="text-[10px] text-stone-400 uppercase tracking-wider truncate mt-0.5">${book.author || 'Unknown Author'}</p>
        </div>
        <div class="border border-stone-200 text-stone-600 font-medium text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap tracking-wide bg-stone-50">
          ${book.voteCount} Votes
        </div>
      `;
      matchesList.appendChild(item);
    });
    return;
  }
  
  emptyState.classList.add('hidden');

  const topBook = bookQueue[bookQueue.length - 1];
  const card = document.createElement('div');
  card.className = "absolute inset-0 bg-white border border-stone-200 rounded-xl book-shadow p-8 flex flex-col justify-between transition-transform duration-300 transform cursor-grab active:cursor-grabbing";
  card.id = `card-${topBook.id}`;
  card.innerHTML = `
    <div class="mt-12 text-center">
      <div class="text-stone-300 font-serif text-3xl italic mb-6">“</div>
      <h3 class="font-serif text-2xl font-medium text-stone-800 leading-snug line-clamp-4">${topBook.title}</h3>
      <p class="text-xs uppercase tracking-wider font-medium text-stone-400 mt-4">${topBook.author || 'Unknown Author'}</p>
    </div>
    <div class="text-center text-[10px] uppercase tracking-wider text-stone-400 border-t border-stone-100 pt-4 font-light">
      Cataloged by: ${topBook.added_by}
    </div>
  `;

  setupSwipeGestures(card, topBook.id);
  container.appendChild(card);
});
    return;
  }
  
  // IF CARDS EXIST: Render the active swipe card normally
  emptyState.classList.add('hidden');

  const topBook = bookQueue[bookQueue.length - 1];
  const card = document.createElement('div');
  card.className = "absolute inset-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-6 flex flex-col justify-between transition-transform duration-300 transform cursor-grab active:cursor-grabbing";
  card.id = `card-${topBook.id}`;
  card.innerHTML = `
    <div class="mt-8 text-center">
      <div class="text-4xl mb-4">📖</div>
      <h3 class="text-2xl font-bold text-slate-800 line-clamp-3">${topBook.title}</h3>
      <p class="text-md text-slate-500 mt-2">${topBook.author || 'Unknown Author'}</p>
    </div>
    <div class="text-center text-xs text-slate-400 border-t pt-4">
      Suggested by: ${topBook.added_by}
    </div>
  `;

  setupSwipeGestures(card, topBook.id);
  container.appendChild(card);
}

function setupSwipeGestures(el, bookId) {
  let startX = 0;
  let currentX = 0;
  const swipeThreshold = 100;

  el.addEventListener('touchstart', e => { 
    startX = e.touches.clientX; 
    el.classList.add('card-drag-active');
  });

  el.addEventListener('touchmove', e => {
    currentX = e.touches.clientX;
    const diffX = currentX - startX;
    el.style.transform = `translateX(${diffX}px) rotate(${diffX / 15}deg)`;
  });

  el.addEventListener('touchend', () => {
    el.classList.remove('card-drag-active');
    const diffX = currentX - startX;
    if (Math.abs(diffX) > swipeThreshold) {
      executeSwipe(bookId, diffX > 0 ? 'right' : 'left', el);
    } else {
      el.style.transform = 'translateX(0px) rotate(0deg)';
    }
    startX = currentX = 0;
  });
}

function handleManualSwipe(direction) {
  if (bookQueue.length === 0) return;
  const topBook = bookQueue[bookQueue.length - 1];
  executeSwipe(topBook.id, direction, document.getElementById(`card-${topBook.id}`));
}

async function executeSwipe(bookId, direction, cardEl) {
  if (cardEl) {
    const flyX = direction === 'right' ? 500 : -500;
    cardEl.style.transform = `translateX(${flyX}px) rotate(${flyX / 10}deg)`;
    cardEl.style.opacity = '0';
  }

  await apiLogSwipe(currentUser, bookId, direction);
  bookQueue.pop();
  setTimeout(() => { renderDeck(); }, 200);
}

function toggleModal(show) {
  document.getElementById('add-modal').classList.toggle('hidden', !show);
}

async function submitBook() {
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();

  if (!title) return alert("Title is required!");

  const { error } = await apiAddBook(title, author, currentUser);
  if (error) return alert("Error adding book: " + error.message);

  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  toggleModal(false);
  refreshDeck();
}
