import {
  apiGetUnswipedBooks,
  apiLogSwipe,
  apiAddBook,
  apiGetMatches,
  apiResetSwipes
} from './db.js';


let currentUser =
  localStorage.getItem('swiper_username') || '';

let bookQueue = [];


/* =========================================================
   EXPOSE HANDLERS TO INLINE HTML ONCLICK LISTENERS
   ========================================================= */

window.saveUsername = saveUsername;
window.handleManualSwipe = handleManualSwipe;
window.toggleModal = toggleModal;
window.submitBook = submitBook;
window.resetMySwipes = resetMySwipes;


/* =========================================================
   INITIAL APP LOAD
   ========================================================= */

if (currentUser) {

  document
    .getElementById('setup-screen')
    .classList
    .add('hidden');

  initApp();
}


/* =========================================================
   SAVE USERNAME
   ========================================================= */

function saveUsername() {

  const name =
    document
      .getElementById('username-input')
      .value
      .trim();

  if (!name) {
    return alert('Please enter a name.');
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


/* =========================================================
   INITIALIZE APP
   ========================================================= */

function initApp() {

  document
    .getElementById('user-display')
    .innerText =
      `Swiping as: ${currentUser}`;

  refreshDeck();


  /*
   * Check for new books every 10 seconds.
   */
  setInterval(() => {
    refreshDeck();
  }, 10000);
}


/* =========================================================
   REFRESH BOOK DECK
   ========================================================= */

async function refreshDeck() {

  bookQueue =
    await apiGetUnswipedBooks(currentUser);

  renderDeck();
}


/* =========================================================
   RENDER DECK
   ========================================================= */

async function renderDeck() {

  const container =
    document.getElementById(
      'card-container'
    );

  const emptyState =
    document.getElementById(
      'empty-state'
    );

  const footer =
    document.querySelector('footer');


  /*
   * Remove existing card.
   */
  container.innerHTML = '';


  /* =======================================================
     END OF CHAPTER
     ======================================================= */

  if (bookQueue.length === 0) {

    emptyState.classList.remove(
      'hidden'
    );

    footer.style.display = 'none';


    const matchesList =
      document.getElementById(
        'end-matches-list'
      );


    /*
     * Loading message.
     */
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


    /* =====================================================
       NO MATCHES
       ===================================================== */

    if (winningBooks.length === 0) {

      matchesList.innerHTML = `
        <p style="
          font-size: 11px;
          color: #a8a29e;
          text-align: center;
          padding: 16px 0;
          font-weight: 300;
        ">
          No group matches yet.
          Wait for friends to finish swiping!
        </p>
      `;

      return;
    }


    /* =====================================================
       BUILD LEADERBOARD
       ===================================================== */

    winningBooks.forEach(book => {

      const item =
        document.createElement('div');

      item.className =
        'leaderboard-row';


      /* ---------------------------------------------------
         LEFT SIDE
         --------------------------------------------------- */

      const textContainer =
        document.createElement('div');

      textContainer.style.cssText =
        `
        min-width: 0;
        flex: 1;
        padding-right: 12px;
        display: flex;
        gap: 8px;
        align-items: center;
        `;


      /* ---------------------------------------------------
         BOOK COVER
         --------------------------------------------------- */

      if (
        book.cover_url &&
        book.cover_url.trim() !== ''
      ) {

        const thumbImg =
          document.createElement('img');

        thumbImg.src =
          book.cover_url;

        thumbImg.alt = '';

        thumbImg.style.cssText =
          `
          width: 24px;
          height: 36px;
          object-fit: cover;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          flex-shrink: 0;
          `;

        textContainer.appendChild(
          thumbImg
        );
      }


      /* ---------------------------------------------------
         BOOK TITLE + AUTHOR
         --------------------------------------------------- */

      const metaBox =
        document.createElement('div');

      metaBox.style.cssText =
        `
        min-width: 0;
        flex: 1;
        `;


      const rowTitle =
        document.createElement('h4');

      rowTitle.className =
        'font-serif';

      rowTitle.style.cssText =
        `
        font-size: 13px;
        font-weight: 500;
        color: #1c1917;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        `;

      rowTitle.innerText =
        book.title;


      const rowAuthor =
        document.createElement('p');

      rowAuthor.style.cssText =
        `
        font-size: 9px;
        text-transform: uppercase;
        color: #a8a29e;
        letter-spacing: 0.03em;
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        `;

      rowAuthor.innerText =
        book.author || 'Unknown';


      metaBox.appendChild(
        rowTitle
      );

      metaBox.appendChild(
        rowAuthor
      );

      textContainer.appendChild(
        metaBox
      );


      /* ---------------------------------------------------
         VOTE BADGE
         --------------------------------------------------- */

      const voteBadge =
        document.createElement('div');

      voteBadge.className =
        'badge-votes';

      voteBadge.innerText =
        `${book.voteCount} Votes`;


      /* ---------------------------------------------------
         ADD EVERYTHING
         --------------------------------------------------- */

      item.appendChild(
        textContainer
      );

      item.appendChild(
        voteBadge
      );

      matchesList.appendChild(
        item
      );
    });


    return;
  }


  /* =======================================================
     ACTIVE BOOK CARDS
     ======================================================= */

  emptyState.classList.add(
    'hidden'
  );

  footer.style.display = '';


  /*
   * Get next book.
   */
  const topBook =
    bookQueue[
      bookQueue.length - 1
    ];


  /* =======================================================
     CREATE CARD
     ======================================================= */

  const card =
    document.createElement('div');

  card.className =
    'book-card';

  card.style.height =
    '100%';

  card.id =
    `card-${topBook.id}`;


  /* =======================================================
     CARD CONTENT WRAPPER
     ======================================================= */

  const scrollWrapper =
    document.createElement('div');

  scrollWrapper.style.cssText =
    `
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;

    /*
     * The description can scroll normally.
     */
    overflow-y: auto;

    max-height: 100%;
    width: 100%;

    /*
     * Makes scrolling feel better on iOS.
     */
    -webkit-overflow-scrolling: touch;
    `;


  /* =======================================================
     BOOK COVER
     ======================================================= */

  if (
    topBook.cover_url &&
    topBook.cover_url.trim() !== ''
  ) {

    const mainCoverImg =
      document.createElement('img');

    mainCoverImg.src =
      topBook.cover_url;

    mainCoverImg.alt =
      topBook.title || 'Book cover';

    mainCoverImg.style.cssText =
      `
      width: 90px;
      height: 135px;
      object-fit: cover;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(44,39,36,0.15);
      margin-bottom: 4px;
      flex-shrink: 0;
      `;

    scrollWrapper.appendChild(
      mainCoverImg
    );

  } else {

    const defaultQuote =
      document.createElement('div');

    defaultQuote.className =
      'card-quote-mark font-serif';

    defaultQuote.innerText =
      '“';

    scrollWrapper.appendChild(
      defaultQuote
    );
  }


  /* =======================================================
     BOOK INFORMATION
     ======================================================= */

  const infoDetailsBox =
    document.createElement('div');

  infoDetailsBox.style.cssText =
    `
    padding: 0 4px;
    width: 100%;
    `;


  /* -------------------------------------------------------
     TITLE
     ------------------------------------------------------- */

  const mainTitleElement =
    document.createElement('h3');

  mainTitleElement.className =
    'font-serif card-title';

  mainTitleElement.style.cssText =
    `
    font-size: 20px;
    margin-bottom: 4px;

    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;

    overflow: hidden;
    `;

  mainTitleElement.innerText =
    topBook.title;

  infoDetailsBox.appendChild(
    mainTitleElement
  );


  /* -------------------------------------------------------
     AUTHOR
     ------------------------------------------------------- */

  const mainAuthorElement =
    document.createElement('p');

  mainAuthorElement.className =
    'card-author';

  mainAuthorElement.style.cssText =
    `
    font-size: 11px;
    margin-bottom: 4px;
    `;

  mainAuthorElement.innerText =
    topBook.author ||
    'Unknown Author';

  infoDetailsBox.appendChild(
    mainAuthorElement
  );


  /* -------------------------------------------------------
     RATING
     ------------------------------------------------------- */

  if (topBook.rating) {

    const ratingElement =
      document.createElement('p');

    ratingElement.style.cssText =
      `
      font-size: 10px;
      color: #ca8a04;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin-bottom: 8px;
      `;

    ratingElement.innerText =
      `⭐ ${Number(topBook.rating).toFixed(1)} / 5`;

    infoDetailsBox.appendChild(
      ratingElement
    );
  }


  /* -------------------------------------------------------
     DESCRIPTION
     ------------------------------------------------------- */

  const descriptionElement =
    document.createElement('p');

  descriptionElement.style.cssText =
    `
    font-size: 11px;
    color: #57534e;
    text-align: justify;
    line-height: 1.5;
    font-weight: 300;

    margin-top: 4px;
    `;

  descriptionElement.innerText =
    topBook.description ||
    'No summary available.';

  infoDetailsBox.appendChild(
    descriptionElement
  );


  /* -------------------------------------------------------
     ADD INFORMATION TO CARD
     ------------------------------------------------------- */

  scrollWrapper.appendChild(
    infoDetailsBox
  );

  card.appendChild(
    scrollWrapper
  );


  /*
   * IMPORTANT:
   *
   * There is deliberately NO:
   *
   * setupSwipeGestures(...)
   *
   * The card is completely non-swipeable.
   */


  container.appendChild(
    card
  );
}


/* =========================================================
   MANUAL PASS / KEEP BUTTONS
   ========================================================= */

function handleManualSwipe(direction) {

  if (bookQueue.length === 0) {
    return;
  }


  const topBook =
    bookQueue[
      bookQueue.length - 1
    ];


  const cardEl =
    document.getElementById(
      `card-${topBook.id}`
    );


  executeSwipe(
    topBook.id,
    direction,
    cardEl
  );
}


/* =========================================================
   EXECUTE PASS / KEEP
   ========================================================= */

async function executeSwipe(
  bookId,
  direction,
  cardEl
) {

  /*
   * Simple visual feedback.
   * No dragging or swiping.
   */

  if (cardEl) {

    cardEl.style.transition =
      'opacity 0.2s ease, transform 0.2s ease';

    cardEl.style.opacity =
      '0';

    cardEl.style.transform =
      direction === 'right'
        ? 'translateX(40px)'
        : 'translateX(-40px)';
  }


  /*
   * Save decision.
   */
  await apiLogSwipe(
    currentUser,
    bookId,
    direction
  );


  /*
   * Remove current book.
   */
  bookQueue.pop();


  /*
   * Render next card.
   */
  setTimeout(() => {

    renderDeck();

  }, 200);
}


/* =========================================================
   RESET ALL MY SWIPES
   ========================================================= */

async function resetMySwipes() {

  if (!currentUser) {
    return;
  }


  const confirmed =
    confirm(
      'Reset your reading decisions?\n\n' +
      'This will delete all your Pass and Keep choices ' +
      'so you can go through the entire book pool again.'
    );


  if (!confirmed) {
    return;
  }


  const result =
    await apiResetSwipes(
      currentUser
    );


  if (result.error) {

    alert(
      'Could not reset your swipes: ' +
      result.error.message
    );

    return;
  }


  /*
   * Reload the entire book pool.
   */
  await refreshDeck();
}


/* =========================================================
   MODAL
   ========================================================= */

function toggleModal(show) {

  document
    .getElementById('add-modal')
    .classList
    .toggle(
      'hidden',
      !show
    );
}


/* =========================================================
   SUBMIT NEW BOOK
   ========================================================= */

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

    return alert(
      'Title is required!'
    );
  }


  const { error } =
    await apiAddBook(
      title,
      author,
      manualCover,
      manualDesc,
      currentUser
    );


  if (error) {

    return alert(
      'Error adding book: ' +
      error.message
    );
  }


  /* -------------------------------------------------------
     CLEAR FORM
     ------------------------------------------------------- */

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


  /* -------------------------------------------------------
     CLOSE MODAL
     ------------------------------------------------------- */

  toggleModal(false);


  /* -------------------------------------------------------
     RELOAD BOOKS
     ------------------------------------------------------- */

  refreshDeck();
}