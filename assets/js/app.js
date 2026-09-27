import {
  apiGetUnswipedBooks,
  apiLogSwipe,
  apiAddBook,
  apiGetMatches,
  apiResetSwipes
} from './db.js';


/* =========================================
   STATE
========================================= */

let currentUser =
  localStorage.getItem('swiper_username') || '';

let bookQueue = [];

let refreshTimer = null;


/* =========================================
   EXPOSE BUTTON FUNCTIONS
========================================= */

window.saveUsername = saveUsername;
window.handleManualSwipe = handleManualSwipe;
window.toggleModal = toggleModal;
window.submitBook = submitBook;
window.resetMySwipes = resetMySwipes;


/* =========================================
   INITIAL LOAD
========================================= */

if (currentUser) {

  document
    .getElementById('setup-screen')
    .classList
    .add('hidden');

  initApp();
}


/* =========================================
   SAVE USERNAME
========================================= */

function saveUsername() {

  const input =
    document.getElementById('username-input');

  const name =
    input.value.trim();

  if (!name) {
    alert('Please enter a name.');
    return;
  }

  localStorage.setItem(
    'swiper_username',
    name
  );

  currentUser = name;

  document
    .getElementById('setup-screen')
    .classList
    .add('hidden');

  initApp();
}


/* =========================================
   INITIALIZE APP
========================================= */

function initApp() {

  document
    .getElementById('user-display')
    .innerText =
      `Swiping as: ${currentUser}`;

  refreshDeck();

  /*
    Check for newly added books periodically.

    IMPORTANT:
    We only refresh when there is no active
    book card. This prevents the current card
    from disappearing every 10 seconds.
  */

  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(() => {

    const activeCard =
      document.querySelector('.book-card');

    if (!activeCard) {
      refreshDeck();
    }

  }, 10000);
}


/* =========================================
   REFRESH BOOK DECK
========================================= */

async function refreshDeck() {

  if (!currentUser) return;

  try {

    const books =
      await apiGetUnswipedBooks(currentUser);

    bookQueue = Array.isArray(books)
      ? books
      : [];

    renderDeck();

  } catch (error) {

    console.error(
      'Could not load books:',
      error
    );

  }
}


/* =========================================
   RENDER DECK
========================================= */

async function renderDeck() {

  const container =
    document.getElementById('card-container');

  const emptyState =
    document.getElementById('empty-state');

  const footer =
    document.querySelector('footer');

  /*
    Clear only the card container.
    The leaderboard remains untouched
    until we specifically need it.
  */

  container.innerHTML = '';


  /* =======================================
     NO BOOKS LEFT
  ======================================= */

  if (bookQueue.length === 0) {

    container.classList.add('hidden');

    emptyState.classList.remove('hidden');

    footer.style.display = 'none';

    await renderLeaderboard();

    return;
  }


  /* =======================================
     BOOKS AVAILABLE
  ======================================= */

  container.classList.remove('hidden');

  emptyState.classList.add('hidden');

  footer.style.display = '';


  /* =======================================
     GET NEXT BOOK
  ======================================= */

  const topBook =
    bookQueue[bookQueue.length - 1];


  /* =======================================
     CREATE CARD
  ======================================= */

  const card =
    document.createElement('div');

  card.className = 'book-card';

  card.id =
    `card-${topBook.id}`;


  /* =======================================
     CONTENT WRAPPER
  ======================================= */

  const content =
    document.createElement('div');

  content.className =
    'book-card-content';


  /* =======================================
     COVER
  ======================================= */

  if (
    topBook.cover_url &&
    topBook.cover_url.trim() !== ''
  ) {

    const cover =
      document.createElement('img');

    cover.src =
      topBook.cover_url;

    cover.alt =
      topBook.title || 'Book cover';

    cover.className =
      'book-cover';

    /*
      If an image fails, hide it instead of
      leaving a broken image icon.
    */

    cover.onerror = () => {
      cover.style.display = 'none';
    };

    content.appendChild(cover);

  } else {

    const quote =
      document.createElement('div');

    quote.className =
      'card-quote-mark';

    quote.innerText =
      '“';

    content.appendChild(quote);
  }


  /* =======================================
     BOOK INFORMATION
  ======================================= */

  const info =
    document.createElement('div');

  info.className =
    'book-info';


  /* TITLE */

  const title =
    document.createElement('h3');

  title.className =
    'card-title';

  title.innerText =
    topBook.title || 'Untitled';

  info.appendChild(title);


  /* AUTHOR */

  const author =
    document.createElement('p');

  author.className =
    'card-author';

  author.innerText =
    topBook.author || 'Unknown Author';

  info.appendChild(author);


  /* RATING */

  if (topBook.rating) {

    const rating =
      document.createElement('p');

    rating.className =
      'card-rating';

    rating.innerText =
      `⭐ ${Number(topBook.rating).toFixed(1)} / 5`;

    info.appendChild(rating);
  }


  /* DESCRIPTION */

  const description =
    document.createElement('p');

  description.className =
    'card-description';

  description.innerText =
    topBook.description ||
    'No summary available.';

  info.appendChild(description);


  /* ADD INFO */

  content.appendChild(info);

  card.appendChild(content);

  container.appendChild(card);
}


/* =========================================
   LEADERBOARD
========================================= */

async function renderLeaderboard() {

  const matchesList =
    document.getElementById(
      'end-matches-list'
    );

  matchesList.innerHTML = `
    <p style="
      font-size: 11px;
      color: #a8a29e;
      text-align: center;
      padding: 16px 0;
      font-weight: 300;
    ">
      Consulting database logs...
    </p>
  `;


  const winningBooks =
    await apiGetMatches();


  matchesList.innerHTML = '';


  /* =======================================
     NO MATCHES
  ======================================= */

  if (
    !winningBooks ||
    winningBooks.length === 0
  ) {

    matchesList.innerHTML = `
      <p style="
        font-size: 11px;
        color: #a8a29e;
        text-align: center;
        padding: 16px 0;
        font-weight: 300;
      ">
        No group matches yet. Wait for friends
        to finish reading through the stack!
      </p>
    `;

    return;
  }


  /* =======================================
     BUILD ALL ROWS
  ======================================= */

  winningBooks.forEach(book => {

    const item =
      document.createElement('div');

    item.className =
      'leaderboard-row';


    /* BOOK INFO */

    const info =
      document.createElement('div');

    info.className =
      'leaderboard-book-info';


    /* COVER */

    if (
      book.cover_url &&
      book.cover_url.trim() !== ''
    ) {

      const image =
        document.createElement('img');

      image.src =
        book.cover_url;

      image.alt = '';

      image.className =
        'leaderboard-cover';

      image.onerror = () => {
        image.style.display = 'none';
      };

      info.appendChild(image);
    }


    /* META */

    const meta =
      document.createElement('div');

    meta.className =
      'leaderboard-meta';


    /* TITLE */

    const title =
      document.createElement('h4');

    title.className =
      'leaderboard-title';

    title.innerText =
      book.title || 'Untitled';


    /* AUTHOR */

    const author =
      document.createElement('p');

    author.className =
      'leaderboard-author';

    author.innerText =
      book.author || 'Unknown';


    meta.appendChild(title);

    meta.appendChild(author);

    info.appendChild(meta);


    /* VOTES */

    const votes =
      document.createElement('div');

    votes.className =
      'badge-votes';

    votes.innerText =
      `${book.voteCount} ${
        book.voteCount === 1
          ? 'Vote'
          : 'Votes'
      }`;


    /* ADD ROW */

    item.appendChild(info);

    item.appendChild(votes);

    matchesList.appendChild(item);

  });
}


/* =========================================
   PASS / KEEP
========================================= */

function handleManualSwipe(direction) {

  if (bookQueue.length === 0) {
    return;
  }

  const topBook =
    bookQueue[bookQueue.length - 1];

  const card =
    document.getElementById(
      `card-${topBook.id}`
    );

  executeSwipe(
    topBook.id,
    direction,
    card
  );
}


/* =========================================
   EXECUTE PASS / KEEP
========================================= */

async function executeSwipe(
  bookId,
  direction,
  cardEl
) {

  /*
    Disable the buttons while the request
    is being processed.
  */

  const footerButtons =
    document.querySelectorAll(
      '.footer-btn'
    );

  footerButtons.forEach(button => {
    button.disabled = true;
    button.style.opacity = '0.5';
  });


  /* Simple fade animation */

  if (cardEl) {

    cardEl.style.transition =
      'opacity 0.2s ease';

    cardEl.style.opacity =
      '0';
  }


  try {

    await apiLogSwipe(
      currentUser,
      bookId,
      direction
    );

    /*
      Remove the current book from the
      local queue.
    */

    bookQueue.pop();

  } catch (error) {

    console.error(
      'Could not save swipe:',
      error
    );

    alert(
      'Something went wrong saving your choice.'
    );

  }


  /* Re-enable buttons */

  footerButtons.forEach(button => {
    button.disabled = false;
    button.style.opacity = '';
  });


  /*
    Render immediately after the choice.
  */

  await renderDeck();
}


/* =========================================
   ADD BOOK MODAL
========================================= */

function toggleModal(show) {

  const modal =
    document.getElementById('add-modal');

  if (!modal) return;

  if (show) {

    modal.classList.remove('hidden');

    setTimeout(() => {

      document
        .getElementById('book-title')
        .focus();

    }, 50);

  } else {

    modal.classList.add('hidden');
  }
}


/* =========================================
   SUBMIT NEW BOOK
========================================= */

async function submitBook() {

  const title =
    document
      .getElementById('book-title')
      .value
      .trim();

  const author =
    document
      .getElementById('book-author')
      .value
      .trim();

  const manualCover =
    document
      .getElementById('book-cover-manual')
      .value
      .trim();

  const manualDesc =
    document
      .getElementById('book-description-manual')
      .value
      .trim();


  if (!title) {

    alert(
      'Title is required!'
    );

    return;
  }


  try {

    const result =
      await apiAddBook(
        title,
        author,
        manualCover,
        manualDesc,
        currentUser
      );


    if (result.error) {

      alert(
        'Error adding book: ' +
        result.error.message
      );

      return;
    }


    /* Clear form */

    document
      .getElementById('book-title')
      .value = '';

    document
      .getElementById('book-author')
      .value = '';

    document
      .getElementById('book-cover-manual')
      .value = '';

    document
      .getElementById('book-description-manual')
      .value = '';


    /* Close modal */

    toggleModal(false);


    /*
      Reload the book list.
    */

    await refreshDeck();

  } catch (error) {

    console.error(
      'Error submitting book:',
      error
    );

    alert(
      'Something went wrong adding the book.'
    );
  }
}


/* =========================================
   RESET ALL MY SWIPES
========================================= */

async function resetMySwipes() {

  if (!currentUser) {
    return;
  }


  const confirmed =
    confirm(
      `Reset all your Pass/Keep choices for "${currentUser}"?\n\nYou will see all the books again.`
    );


  if (!confirmed) {
    return;
  }


  try {

    const result =
      await apiResetSwipes(currentUser);


    if (result.error) {

      alert(
        'Could not reset your swipes:\n\n' +
        result.error.message
      );

      return;
    }


    /*
      Reload the entire book queue.
    */

    await refreshDeck();


    alert(
      'Your swipes have been reset.'
    );

  } catch (error) {

    console.error(
      'Reset error:',
      error
    );

    alert(
      'Something went wrong while resetting your swipes.'
    );
  }
}