let currentUser = localStorage.getItem('swiper_username') || '';
let bookQueue = [];

// App Startup Bootstrap Routing
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
  // Ensure the database client is generated safely
  initSupabaseClient(); 
  
  document.getElementById('user-display').innerText = `Swiping as: ${currentUser}`;
  refreshDeck();
  
  // Connect a websocket hook to capture third-party data entries in real-time
  supabase
    .channel('schema-db-changes')
// ... keep the rest of your initApp() function exactly the same ...
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'books' }, payload => {
      if (payload.new.added_by !== currentUser) {
        refreshDeck();
      }
    })
    .subscribe();
}

async function refreshDeck() {
  bookQueue = await apiGetUnswipedBooks(currentUser);
  renderDeck();
}

function renderDeck() {
  const container = document.getElementById('card-container');
  const emptyState = document.getElementById('empty-state');
  container.innerHTML = '';

  if (bookQueue.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
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
  if (error) return alert("Write operational error: " + error.message);

  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  toggleModal(false);
  refreshDeck();
}
