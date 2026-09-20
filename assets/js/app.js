import { apiGetUnswipedBooks, apiLogSwipe, apiAddBook, apiGetMatches } from './db.js';

let currentUser = localStorage.getItem('swiper_username') || '';
let bookQueue = [];

// Expose internal lifecycle methods to the HTML template layer explicitly
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
  
  // High-reliability background sync: Check for new group additions every 10 seconds
  setInterval(() => {
    refreshDeck();
  }, 10000);
}

async function refreshDeck() {
  bookQueue = await apiGetUnswipedBooks(currentUser);
  renderDeck();
}

// Don't forget to add apiGetMatches to your top import string statement:
import { apiGetUnswipedBooks, apiLogSwipe, apiAddBook, apiGetMatches } from './db.js';

async function renderDeck() {
  const container = document.getElementById('card-container');
  const emptyState = document.getElementById('empty-state');
  container.innerHTML = '';

  // IF THE USER RUNS OUT OF CARDS: Calculate and render mutual choices
  if (bookQueue.length === 0) {
    emptyState.classList.remove('hidden');
    
    const matchesList = document.getElementById('end-matches-list');
    matchesList.innerHTML = `<p class="text-xs text-slate-400 text-center py-4 animate-pulse">Calculating group choices...</p>`;
    
    const winningBooks = await apiGetMatches();
    matchesList.innerHTML = '';

    if (winningBooks.length === 0) {
      matchesList.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No group consensus matches yet. Wait for friends to finish swiping!</p>`;
      return;
    }

       winningBooks.forEach(book => {
      const item = document.createElement('div');
      item.className = "bg-slate-50 border border-indigo-100 p-2.5 rounded-lg border-l-4 border-l-indigo-500 shadow-sm flex items-center justify-between gap-2.5";
      item.innerHTML = `
        <div class="flex items-start gap-2 text-left">
          <div class="text-md mt-0.5">📖</div>
          <div>
            <h4 class="font-bold text-slate-800 text-xs line-clamp-2">${book.title}</h4>
            <p class="text-[10px] text-slate-400 truncate">${book.author || 'Unknown Author'}</p>
          </div>
        </div>
        <!-- Vote Badge Counter -->
        <div class="bg-indigo-100 text-indigo-700 font-bold text-xs px-2 py-1 rounded-full whitespace-nowrap">
          👍 ${book.voteCount} Votes
        </div>
      `;
      matchesList.appendChild(item);
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
