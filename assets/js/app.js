import {
  apiGetUnswipedBooks,
  apiLogSwipe,
  apiAddBook,
  apiGetMatches
} from './db.js';


let currentUser = localStorage.getItem('swiper_username') || '';
let bookQueue = [];


// =========================================================
// EXPOSE INLINE HTML HANDLERS
// =========================================================

window.saveUsername = saveUsername;
window.handleManualSwipe = handleManualSwipe;
window.toggleModal = toggleModal;
window.submitBook = submitBook;


// =========================================================
// INITIALIZATION
// =========================================================

if (currentUser) {
  document.getElementById('setup-screen').classList.add('hidden');
  initApp();
}


function saveUsername() {
  const name = document
    .getElementById('username-input')
    .value
    .trim();

  if (!name) {
    alert('Please enter a name.');
    return;
  }

  localStorage.setItem('swiper_username', name);

  currentUser = name;

  document
    .getElementById('setup-screen')
    .classList
    .add('hidden');

  initApp();
}


function initApp() {
  document.getElementById('user-display').innerText =
    `Swiping as: ${currentUser}`;

  refreshDeck();

  /*
   * High-reliability sync:
   * Check for new group additions every 10 seconds.
   */
  setInterval(() => {
    refreshDeck();
  }, 10000);
}


// =========================================================
// LOAD BOOKS
// =========================================================

async function refreshDeck() {
  bookQueue = await apiGetUnswipedBooks(currentUser);

  renderDeck();
}


// =========================================================
// RENDER DECK
// =========================================================

async function renderDeck() {
  const container = document.getElementById('card-container');
  const emptyState = document.getElementById('empty-state');

  container.innerHTML = '';


  // =======================================================
  // END OF CHAPTER
  // =======================================================

  if (bookQueue.length === 0) {

    /*
     * Show End of Chapter screen.
     */
    emptyState.classList.remove('hidden');


    const matchesList =
      document.getElementById('end-matches-list');


    /*
     * Clear old results first.
     */
    matchesList.innerHTML = `
      <p style="
        font-size: 11px;
        color: #a8a29e;
        text-align: center;
        padding: 16px 0;
      ">
        Consulting database logs...
      </p>
    `;


    const winningBooks = await apiGetMatches();


    /*
     * Clear loading state.
     */
    matchesList.innerHTML = '';


    // =====================================================
    // NO MATCHES
    // =====================================================

    if (winningBooks.length === 0) {

      matchesList.innerHTML = `
        <p style="
          font-size: 11px;
          color: #a8a29e;
          text-align: center;
          padding: 16px 0;
          font-weight: 300;
        ">
          No group matches yet. Wait for friends to finish swiping!
        </p>
      `;

      return;
    }


    // =====================================================
    // BUILD MATCH LIST
    // =====================================================

    winningBooks.forEach(book => {

      const item = document.createElement('div');

      item.className = 'leaderboard-row';


      // ---------------------------------------------------
      // Text / cover container
      // ---------------------------------------------------

      const textContainer =
        document.createElement('div');

      textContainer.style.cssText = `
        min-width: 0;
        flex: 1;
        padding-right: 12px;
        display: flex;
        gap: 8px;
        align-items: center;
      `;


      // ---------------------------------------------------
      // Cover image
      // ---------------------------------------------------

      if (
        book.cover_url &&
        book.cover_url.trim() !== ''
      ) {

        const thumbImg =
          document.createElement('img');

        thumbImg.src = book.cover_url;

        thumbImg.alt = '';

        thumbImg.style.cssText = `
          width: 24px;
          height: 36px;
          object-fit: cover;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          flex-shrink: 0;
        `;

        textContainer.appendChild(thumbImg);
      }


      // ---------------------------------------------------
      // Book metadata
      // ---------------------------------------------------

      const metaBox =
        document.createElement('div');

      metaBox.style.cssText = `
        min-width: 0;
        flex: 1;
      `;


      // Title

      const rowTitle =
        document.createElement('h4');

      rowTitle.className = 'font-serif';

      rowTitle.style.cssText = `
        font-size: 13px;
        font-weight: 500;
        color: #1c1917;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      rowTitle.innerText = book.title;


      // Author

      const rowAuthor =
        document.createElement('p');

      rowAuthor.style.cssText = `
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


      metaBox.appendChild(rowTitle);
      metaBox.appendChild(rowAuthor);

      textContainer.appendChild(metaBox);


      // ---------------------------------------------------
      // Vote badge
      // ---------------------------------------------------

      const voteBadge =
        document.createElement('div');

      voteBadge.className = 'badge-votes';

      voteBadge.innerText =
        `${book.voteCount} Votes`;


      // ---------------------------------------------------
      // Assemble row
      // ---------------------------------------------------

      item.appendChild(textContainer);
      item.appendChild(voteBadge);

      matchesList.appendChild(item);
    });


    /*
     * IMPORTANT:
     *
     * We intentionally DO NOT call setupSwipeGestures()
     * on the End of Chapter screen.
     *
     * Therefore the leaderboard is completely independent
     * from the card swipe system.
     */
    return;
  }


  // =======================================================
  // ACTIVE BOOK CARD
  // =======================================================

  emptyState.classList.add('hidden');


  const topBook =
    bookQueue[bookQueue.length - 1];


  const card =
    document.createElement('div');

  card.className = 'book-card';

  card.style.height = '100%';

  card.id = `card-${topBook.id}`;


  // =======================================================
  // CARD CONTENT SCROLLER
  // =======================================================

  const scrollWrapper =
    document.createElement('div');

  scrollWrapper.style.cssText = `
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    overflow-y: auto;
    max-height: 100%;
    width: 100%;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  `;


  // =======================================================
  // COVER
  // =======================================================

  if (
    topBook.cover_url &&
    topBook.cover_url.trim() !== ''
  ) {

    const mainCoverImg =
      document.createElement('img');

    mainCoverImg.src = topBook.cover_url;

    mainCoverImg.alt = '';

    mainCoverImg.style.cssText = `
      width: 90px;
      height: 135px;
      object-fit: cover;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(44,39,36,0.15);
      margin-bottom: 4px;
      flex-shrink: 0;
    `;

    scrollWrapper.appendChild(mainCoverImg);

  } else {

    const defaultQuote =
      document.createElement('div');

    defaultQuote.className =
      'card-quote-mark font-serif';

    defaultQuote.innerText = '“';

    scrollWrapper.appendChild(defaultQuote);
  }


  // =======================================================
  // BOOK DETAILS
  // =======================================================

  const infoDetailsBox =
    document.createElement('div');

  infoDetailsBox.style.cssText = `
    padding: 0 4px;
    width: 100%;
  `;


  // Title

  const mainTitleElement =
    document.createElement('h3');

  mainTitleElement.className =
    'font-serif card-title';

  mainTitleElement.style.cssText = `
    font-size: 20px;
    margin-bottom: 4px;
    line-clamp: 2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `;

  mainTitleElement.innerText =
    topBook.title;


  // Author

  const mainAuthorElement =
    document.createElement('p');

  mainAuthorElement.className =
    'card-author';

  mainAuthorElement.style.cssText = `
    font-size: 11px;
    margin-bottom: 4px;
  `;

  mainAuthorElement.innerText =
    topBook.author || 'Unknown Author';


  infoDetailsBox.appendChild(mainTitleElement);
  infoDetailsBox.appendChild(mainAuthorElement);


  // =======================================================
  // RATING
  // =======================================================

  if (topBook.rating) {

    const ratingElement =
      document.createElement('p');

    ratingElement.style.cssText = `
      font-size: 10px;
      color: #ca8a04;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin-bottom: 8px;
    `;

    ratingElement.innerText =
      `⭐ ${Number(topBook.rating).toFixed(1)} / 5`;

    infoDetailsBox.appendChild(ratingElement);
  }


  // =======================================================
  // DESCRIPTION
  // =======================================================

  const descriptionElement =
    document.createElement('p');

  descriptionElement.style.cssText = `
    font-size: 11px;
    color: #57534e;
    text-align: justify;
    line-height: 1.5;
    font-weight: 300;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    line-clamp: 5;
    overflow: hidden;
    margin-top: 4px;
  `;

  descriptionElement.innerText =
    topBook.description || 'No summary available.';

  infoDetailsBox.appendChild(descriptionElement);

  scrollWrapper.appendChild(infoDetailsBox);

  card.appendChild(scrollWrapper);


  // =======================================================
  // SWIPE GESTURES
  // =======================================================

  setupSwipeGestures(card, topBook.id);


  // =======================================================
  // ADD CARD TO PAGE
  // =======================================================

  container.appendChild(card);
}


// =========================================================
// SWIPE GESTURES
// =========================================================

function setupSwipeGestures(el, bookId) {

  let startX = 0;
  let startY = 0;

  let currentX = 0;
  let currentY = 0;

  let isDragging = false;

  let gestureDirection = null;

  const swipeThreshold = 100;


  // =======================================================
  // SWIPE INDICATORS
  // =======================================================

  const keepIndicator =
    document.createElement('div');

  keepIndicator.className =
    'swipe-indicator indicator-keep';

  keepIndicator.innerText =
    '❤️ KEEP';


  const passIndicator =
    document.createElement('div');

  passIndicator.className =
    'swipe-indicator indicator-pass';

  passIndicator.innerText =
    '❌ PASS';


  el.appendChild(keepIndicator);
  el.appendChild(passIndicator);


  // =======================================================
  // TOUCH START
  // =======================================================

  el.addEventListener(
    'touchstart',
    e => {

      /*
       * IMPORTANT:
       *
       * If the user starts touching a scrollable area
       * inside the card, don't immediately assume this
       * is a horizontal card swipe.
       */
      if (
        e.target.closest('.leaderboard-container') ||
        e.target.closest('[data-scrollable="true"]')
      ) {
        isDragging = false;
        gestureDirection = null;
        return;
      }


      const touch = e.touches[0];

      startX = touch.clientX;
      startY = touch.clientY;

      currentX = startX;
      currentY = startY;

      isDragging = true;

      gestureDirection = null;

      el.classList.add('card-drag-active');
    },
    {
      passive: true
    }
  );


  // =======================================================
  // TOUCH MOVE
  // =======================================================

  el.addEventListener(
    'touchmove',
    e => {

      /*
       * Never interfere with a scrollable child.
       */
      if (
        e.target.closest('.leaderboard-container') ||
        e.target.closest('[data-scrollable="true"]')
      ) {
        return;
      }


      if (!isDragging) return;


      const touch = e.touches[0];

      currentX = touch.clientX;
      currentY = touch.clientY;


      const diffX = currentX - startX;
      const diffY = currentY - startY;


      /*
       * Determine whether the gesture is horizontal
       * or vertical.
       *
       * Vertical movement = normal page/card content
       * movement, so don't swipe the card.
       */
      if (!gestureDirection) {

        if (
          Math.abs(diffX) < 8 &&
          Math.abs(diffY) < 8
        ) {
          return;
        }

        if (Math.abs(diffY) > Math.abs(diffX)) {

          gestureDirection = 'vertical';

          isDragging = false;

          return;

        } else {

          gestureDirection = 'horizontal';
        }
      }


      /*
       * Only horizontal gestures get here.
       */
      if (gestureDirection !== 'horizontal') {
        return;
      }


      const rotation = diffX / 15;

      el.style.transform =
        `translate(${diffX}px, ${diffY}px) rotate(${rotation}deg)`;


      // KEEP

      if (diffX > 10) {

        keepIndicator.style.opacity =
          Math.min(
            diffX / swipeThreshold,
            1
          );

        passIndicator.style.opacity = 0;


      // PASS

      } else if (diffX < -10) {

        passIndicator.style.opacity =
          Math.min(
            Math.abs(diffX) / swipeThreshold,
            1
          );

        keepIndicator.style.opacity = 0;


      // CENTER

      } else {

        keepIndicator.style.opacity = 0;
        passIndicator.style.opacity = 0;
      }
    },
    {
      passive: true
    }
  );


  // =======================================================
  // TOUCH END
  // =======================================================

  el.addEventListener(
    'touchend',
    () => {

      if (!isDragging) {

        /*
         * Reset after a vertical gesture.
         */
        gestureDirection = null;

        startX = 0;
        startY = 0;
        currentX = 0;
        currentY = 0;

        return;
      }


      isDragging = false;

      el.classList.remove('card-drag-active');


      const diffX =
        currentX - startX;


      /*
       * Only horizontal gestures can trigger
       * a book swipe.
       */
      if (
        gestureDirection === 'horizontal' &&
        Math.abs(diffX) > swipeThreshold &&
        currentX !== 0
      ) {

        const direction =
          diffX > 0
            ? 'right'
            : 'left';

        executeSwipe(
          bookId,
          direction,
          el
        );

      } else {

        /*
         * Snap card back to center.
         */
        el.style.transform =
          'translate(0px, 0px) rotate(0deg)';

        keepIndicator.style.opacity = 0;

        passIndicator.style.opacity = 0;
      }


      gestureDirection = null;

      startX = 0;
      startY = 0;
      currentX = 0;
      currentY = 0;
    }
  );
}


// =========================================================
// MANUAL SWIPE BUTTONS
// =========================================================

function handleManualSwipe(direction) {

  if (bookQueue.length === 0) {
    return;
  }


  const topBook =
    bookQueue[bookQueue.length - 1];


  const cardEl =
    document.getElementById(
      `card-${topBook.id}`
    );


  /*
   * Flash the appropriate indicator.
   */

  if (cardEl) {

    const indicator =
      cardEl.querySelector(
        direction === 'right'
          ? '.indicator-keep'
          : '.indicator-pass'
      );

    if (indicator) {
      indicator.style.opacity = '1';
    }
  }


  executeSwipe(
    topBook.id,
    direction,
    cardEl
  );
}


// =========================================================
// EXECUTE SWIPE
// =========================================================

async function executeSwipe(
  bookId,
  direction,
  cardEl
) {

  if (cardEl) {

    const flyX =
      direction === 'right'
        ? window.innerWidth + 200
        : -(window.innerWidth + 200);


    cardEl.style.transform =
      `translate(${flyX}px, 0px) rotate(${flyX / 12}deg)`;

    cardEl.style.opacity = '0';
  }


  /*
   * Save selection to Supabase.
   */

  await apiLogSwipe(
    currentUser,
    bookId,
    direction
  );


  /*
   * Remove book locally.
   */

  bookQueue.pop();


  /*
   * Render next card after animation.
   */

  setTimeout(() => {
    renderDeck();
  }, 250);
}


// =========================================================
// MODAL
// =========================================================

function toggleModal(show) {

  document
    .getElementById('add-modal')
    .classList
    .toggle(
      'hidden',
      !show
    );
}


// =========================================================
// ADD BOOK
// =========================================================

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
    alert('Title is required!');
    return;
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

    alert(
      'Error adding book: ' +
      error.message
    );

    return;
  }


  /*
   * Clear form.
   */

  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  document.getElementById('book-cover-manual').value = '';
  document.getElementById('book-description-manual').value = '';


  toggleModal(false);

  refreshDeck();
}