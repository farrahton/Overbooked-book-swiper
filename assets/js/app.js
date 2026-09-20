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
    matchesList.innerHTML = `<p style="font-size: 11px; color: #a8a29e; text-align: center; padding: 16px 0;">Consulting database logs...</p>`;
    const winningBooks = await apiGetMatches();
    matchesList.innerHTML = '';

    if (winningBooks.length === 0) {
      matchesList.innerHTML = `<p style="font-size: 11px; color: #a8a29e; text-align: center; padding: 16px 0; font-weight: 300;">No group matches yet. Wait for friends to finish swiping!</p>`;
      return;
    }

    winningBooks.forEach(book => {
      const item = document.createElement('div');
      item.className = "leaderboard-row";
      
      // FIXED: Completely clean template variables (No backslashes)
      item.innerHTML = `
        <div style="min-width: 0; flex: 1; padding-right: 12px; display: flex; gap: 8px; align-items: center;">
          ${book.cover_url ? `<img src="\${book.cover_url}" style="width: 24px; height: auto; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">` : ''}
          <div style="min-width: 0; flex: 1;">
            <h4 class="font-serif" style="font-size: 13px; font-weight: 500; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${book.title}</h4>
            <p style="font-size: 9px; text-transform: uppercase; color: #a8a29e; letter-spacing: 0.03em; margin-top: 1px;">${book.author || 'Unknown'}</p>
          </div>
        </div>
        <div class="badge-votes">${book.voteCount} Votes</div>
      `;
      matchesList.appendChild(item);
    });
    return;
  }
  
  emptyState.classList.add('hidden');

  const topBook = bookQueue[bookQueue.length - 1];
  const card = document.createElement('div');
  card.className = "book-card";
  card.style.height = "100%";
  card.id = `card-${topBook.id}`;
  
  const starRating = topBook.rating ? `⭐ ${Number(topBook.rating).toFixed(1)} / 5` : '';

  // FIXED: Completely clean template variables (No backslashes)
  card.innerHTML = `
    <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; overflow-y: auto; max-height: 100%; width: 100%;">
      ${topBook.cover_url ? `<img src="\${topBook.cover_url}" style="width: 90px; height: 135px; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 12px rgba(44,39,36,0.15); margin-bottom: 4px;">` : '<div class="card-quote-mark font-serif">“</div>'}
      
      <div style="padding: 0 4px; width: 100%;">
        <h3 class="font-serif card-title" style="font-size: 20px; margin-bottom: 4px; line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">${topBook.title}</h3>
        <p class="card-author" style="font-size: 11px; margin-bottom: 4px;">${topBook.author || 'Unknown Author'}</p>
        ${starRating ? `<p style="font-size: 10px; color: #ca8a04; font-weight: 600; letter-spacing: 0.02em; margin-bottom: 8px;">\${starRating}</p>` : ''}
        <p style="font-size: 11px; color: #57534e; text-align: justify; line-height: 1.5; font-weight: 300; display: -webkit-box; -webkit-box-orient: vertical; line-clamp: 5; overflow: hidden; margin-top: 4px;">${topBook.description || 'No summary available.'}</p>
      </div>
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
  
  const manualCover = document.getElementById('book-cover-manual').value.trim();
  const manualDesc = document.getElementById('book-description-manual').value.trim();

  if (!title) return alert("Title is required!");

  const { error } = await apiAddBook(title, author, manualCover, manualDesc, currentUser);
  if (error) return alert("Error adding book: " + error.message);

  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  document.getElementById('book-cover-manual').value = '';
  document.getElementById('book-description-manual').value = '';
  
  toggleModal(false);
  refreshDeck();
}
