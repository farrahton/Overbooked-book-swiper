// --- CONFIGURATION ---
const SUPABASE_URL = "https://hixflcifimnsutwzevim.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NxOlmZjO9B-EJnb6xtckvA_Ak129OON";

/**
 * Base communication function executing direct REST HTTP fetch queries natively.
 */
async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...options.headers
  };
  
  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database error Response: ${response.status} - ${errorText}`);
    }
    if (response.status === 204) return [];
    return await response.json();
  } catch (err) {
    console.error("Supabase API Connection Error:", err);
    return null;
  }
}

/**
 * Fetch books that the user has not swiped on yet.
 */
export async function apiGetUnswipedBooks(username) {
  // 1. Fetch IDs of books this user already swiped on
  const swipedData = await supabaseRequest(`swipes?user_id=eq.${encodeURIComponent(username)}&select=book_id`);
  const excludedIds = swipedData ? swipedData.map(s => s.book_id) : [];

  // 2. Query matching pool
  let path = 'books?select=*&order=created_at.desc';
  if (excludedIds.length > 0) {
    path += `&id=not.in.(${excludedIds.join(',')})`;
  }

  const books = await supabaseRequest(path);
  return books || [];
}

/**
 * Save a new user swipe response into the cloud table.
 */
export async function apiLogSwipe(username, bookId, direction) {
  await supabaseRequest('swipes', {
    method: 'POST',
    body: JSON.stringify({ user_id: username, book_id: bookId, direction })
  });
}

/**
 * Insert a brand new book into the shared project collection.
 */
export async function apiAddBook(title, author, username) {
  const data = await supabaseRequest('books', {
    method: 'POST',
    body: JSON.stringify({ title, author, added_by: username })
  });
  return { data, error: data === null ? { message: "Failed to post book record to cloud server." } : null };
}

/**
 * Pull all books and swipes from the cloud to calculate a group preference leaderboard.
 */
export async function apiGetMatches() {
  const books = await supabaseRequest('books?select=*');
  const swipes = await supabaseRequest('swipes?direction=eq.right&select=book_id,user_id');
  
  if (!books || !swipes) return [];

  // Group right swipes together by book_id and store who voted for them
  const matchCounts = {};
  swipes.forEach(s => {
    if (!matchCounts[s.book_id]) {
      matchCounts[s.book_id] = { count: 0, voters: [] };
    }
    // Prevent double counting if unique constraint isn't active
    if (!matchCounts[s.book_id].voters.includes(s.user_id)) {
      matchCounts[s.book_id].count += 1;
      matchCounts[s.book_id].voters.push(s.user_id);
    }
  });

  // Map the vote counts onto your books array
  const leaderboard = books.map(book => {
    const data = matchCounts[book.id] || { count: 0, voters: [] };
    return {
      ...book,
      voteCount: data.count,
      voters: data.voters
    };
  });

  // Filter out books that have fewer than 3 votes (so low-interest books stay off the board)
  // and sort the remaining books from highest votes to lowest votes
  return leaderboard
    .filter(book => book.voteCount >= 3)
    .sort((a, b) => b.voteCount - a.voteCount);
}

