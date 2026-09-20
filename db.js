// --- CONFIGURATION ---
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Initialize client abstraction layer
const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetch books from Supabase that the specific current user hasn't swiped on yet.
 */
async function apiGetUnswipedBooks(username) {
  const { data: swipedBooks } = await supabase
    .from('swipes')
    .select('book_id')
    .eq('user_id', username);

  const excludedIds = swipedBooks ? swipedBooks.map(s => s.book_id) : [];

  let query = supabase.from('books').select('*').order('created_at', { ascending: false });
  if (excludedIds.length > 0) {
    query = query.not('id', 'in', `(${excludedIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Database fetch exception:", error);
    return [];
  }
  return data || [];
}

/**
 * Log a swipe operation into the remote cloud datastore.
 */
async function apiLogSwipe(username, bookId, direction) {
  const { error } = await supabase
    .from('swipes')
    .insert([{ user_id: username, book_id: bookId, direction }]);
  if (error) console.error("Database logging exception:", error);
}

/**
 * Write a new book entity card into the schema pipeline.
 */
async function apiAddBook(title, author, username) {
  const { data, error } = await supabase
    .from('books')
    .insert([{ title, author, added_by: username }]);
  return { data, error };
}
