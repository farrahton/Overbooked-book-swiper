// --- CONFIGURATION ---
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL"; 
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

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
    const res = await fetch(`https://googleapis.com{query}&maxResults=1`);
    const data = await res.json();
    
    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      // Force cover URLs from http to secure https
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
  // Fallback if no matching entry is found on Google
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

export async function apiAddBook(title, author, username) {
  // Query Google Books metadata before saving to database
  const metadata = await fetchGoogleBookMetadata(title, author);

  const data = await supabaseRequest('books', {
    method: 'POST',
    body: JSON.stringify({ 
      title, 
      author: metadata.author, 
      added_by: username,
      cover_url: metadata.cover_url,
      description: metadata.description,
      rating: metadata.rating
    })
  });
  return { data, error: data === null ? { message: "Failed to post book" } : null };
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
