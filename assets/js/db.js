// --- CONFIGURATION ---
const SUPABASE_URL = "https://hixflcifimnsutwzevim.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_NxOlmZjO9B-EJnb6xtckvA_Ak129OON";

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
    if (!response.ok) throw new Error(`Database error: ${response.status}`);
    if (response.status === 204) return [];
    return await response.json();
  } catch (err) {
    console.error("Supabase API Connection Error:", err);
    return null;
  }
}

/**
 * Natively query the free Google Books API to pull cover metadata.
 */
async function fetchGoogleBookMetadata(title, author) {
  let query = `intitle:${encodeURIComponent(title)}`;
  if (author) query += `+inauthor:${encodeURIComponent(author)}`;
  
  try {
    // FIXED: Patched protocol path string mappings
    const res = await fetch(`https://googleapis.com{query}&maxResults=1`);
    const data = await res.json();
    
    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      let cover = volumeInfo.imageLinks?.thumbnail || '';
      if (cover.startsWith('http://')) cover = cover.replace('http://', 'https://');
      
      return {
        author: volumeInfo.authors ? volumeInfo.authors.join(', ') : author || 'Unknown Author',
        description: volumeInfo.description || 'No description available for this volume.',
        rating: volumeInfo.averageRating || null,
        cover_url: cover
      };
    }
  } catch (e) {
    console.error("Google Books search fell short:", e);
  }
  return { author: author || 'Unknown Author', description: 'No description found.', rating: null, cover_url: '' };
}

export async function apiGetUnswipedBooks(username) {
  const swipedData = await supabaseRequest(`swipes?user_id=eq.${encodeURIComponent(username)}&select=book_id`);
  const excludedIds = swipedData ? swipedData.map(s => s.book_id) : [];

  let path = 'books?select=*&order=created_at.desc';
  if (excludedIds.length > 0) path += `&id=not.in.(${excludedIds.join(',')})`;

  return await supabaseRequest(path) || [];
}

export async function apiLogSwipe(username, bookId, direction) {
  await supabaseRequest('swipes', {
    method: 'POST',
    body: JSON.stringify({ user_id: username, book_id: bookId, direction })
  });
}

/**
 * Insert a brand new book with mixed automated/manual overrides into the database.
 */
export async function apiAddBook(title, author, manualCover, manualDesc, username) {
  const metadata = await fetchGoogleBookMetadata(title, author);

  const finalAuthor = author.trim() || metadata.author;
  const finalCover = manualCover.trim() || metadata.cover_url;
  const finalDesc = manualDesc.trim() || metadata.description;

  const data = await supabaseRequest('books', {
    method: 'POST',
    body: JSON.stringify({ 
      title: title.trim(), 
      author: finalAuthor, 
      added_by: username,
      cover_url: finalCover,
      description: finalDesc,
      rating: metadata.rating
    })
  });
  return { data, error: data === null ? { message: "Failed to post book record to cloud server." } : null };
}

export async function apiGetMatches() {
  const books = await supabaseRequest('books?select=*');
  const swipes = await supabaseRequest('swipes?direction=eq.right&select=book_id,user_id');
  if (!books || !swipes) return [];

  const matchCounts = {};
  swipes.forEach(s => {
    const bId = String(s.book_id);
    if (!matchCounts[bId]) matchCounts[bId] = { count: 0, voters: [] };
    if (!matchCounts[bId].voters.includes(String(s.user_id).trim())) {
      matchCounts[bId].count += 1;
      matchCounts[bId].voters.push(String(s.user_id).trim());
    }
  });

  return books.map(book => ({
    ...book,
    voteCount: matchCounts[String(book.id)]?.count || 0
  })).filter(b => b.voteCount >= 1).sort((a, b) => b.voteCount - a.voteCount);
}
