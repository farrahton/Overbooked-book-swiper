/* =========================================
   SUPABASE CONFIGURATION
========================================= */

const SUPABASE_URL =
  "https://hixflcifimnsutwzevim.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_NxOlmZjO9B-EJnb6xtckvA_Ak129OON";


/* =========================================
   SUPABASE REQUEST
========================================= */

async function supabaseRequest(
  path,
  options = {}
) {

  const url =
    `${SUPABASE_URL}/rest/v1/${path}`;

  const headers = {

    "apikey":
      SUPABASE_ANON_KEY,

    "Authorization":
      `Bearer ${SUPABASE_ANON_KEY}`,

    "Content-Type":
      "application/json",

    ...options.headers
  };


  try {

    const response =
      await fetch(
        url,
        {
          ...options,
          headers
        }
      );


    if (!response.ok) {

      const errorText =
        await response.text();

      throw new Error(
        `${response.status}: ${errorText}`
      );
    }


    if (response.status === 204) {
      return [];
    }


    const text =
      await response.text();


    if (!text) {
      return [];
    }


    return JSON.parse(text);

  } catch (error) {

    console.error(
      "Supabase API Error:",
      error
    );

    throw error;
  }
}


/* =========================================
   GOOGLE BOOKS METADATA
========================================= */

async function fetchGoogleBookMetadata(
  title,
  author
) {

  let query =
    `intitle:${encodeURIComponent(title)}`;


  if (author) {

    query +=
      `+inauthor:${encodeURIComponent(author)}`;
  }


  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`;


  try {

    const response =
      await fetch(url);


    if (!response.ok) {
      throw new Error(
        `Google Books returned ${response.status}`
      );
    }


    const data =
      await response.json();


    if (
      data.items &&
      data.items.length > 0
    ) {

      const volumeInfo =
        data.items[0].volumeInfo;


      let cover =
        volumeInfo.imageLinks?.thumbnail || '';


      if (
        cover.startsWith('http://')
      ) {

        cover =
          cover.replace(
            'http://',
            'https://'
          );
      }


      return {

        author:
          volumeInfo.authors
            ? volumeInfo.authors.join(', ')
            : author || 'Unknown Author',

        description:
          volumeInfo.description ||
          'No description available for this volume.',

        rating:
          volumeInfo.averageRating ||
          null,

        cover_url:
          cover
      };
    }

  } catch (error) {

    console.error(
      "Google Books search failed:",
      error
    );
  }


  return {

    author:
      author || 'Unknown Author',

    description:
      'No description found.',

    rating:
      null,

    cover_url:
      ''
  };
}


/* =========================================
   GET BOOKS THIS USER HAS NOT SWIPED
========================================= */

export async function apiGetUnswipedBooks(
  username
) {

  const swipedData =
    await supabaseRequest(
      `swipes?user_id=eq.${encodeURIComponent(username)}&select=book_id`
    );


  const excludedIds =
    Array.isArray(swipedData)
      ? swipedData.map(
          swipe => swipe.book_id
        )
      : [];


  let path =
    'books?select=*&order=created_at.desc';


  if (excludedIds.length > 0) {

    path +=
      `&id=not.in.(${excludedIds.join(',')})`;
  }


  return (
    await supabaseRequest(path)
  ) || [];
}


/* =========================================
   SAVE PASS / KEEP
========================================= */

export async function apiLogSwipe(
  username,
  bookId,
  direction
) {

  return await supabaseRequest(
    'swipes',
    {
      method: 'POST',

      body: JSON.stringify({
        user_id: username,
        book_id: bookId,
        direction
      })
    }
  );
}


/* =========================================
   ADD BOOK
========================================= */

export async function apiAddBook(
  title,
  author,
  manualCover,
  manualDesc,
  username
) {

  const metadata =
    await fetchGoogleBookMetadata(
      title,
      author
    );


  const finalAuthor =
    author.trim() ||
    metadata.author;


  const finalCover =
    manualCover.trim() ||
    metadata.cover_url;


  const finalDesc =
    manualDesc.trim() ||
    metadata.description;


  try {

    const data =
      await supabaseRequest(
        'books',
        {
          method: 'POST',

          body: JSON.stringify({

            title:
              title.trim(),

            author:
              finalAuthor,

            added_by:
              username,

            cover_url:
              finalCover,

            description:
              finalDesc,

            rating:
              metadata.rating
          })
        }
      );


    return {
      data,
      error: null
    };

  } catch (error) {

    return {
      data: null,
      error
    };
  }
}


/* =========================================
   GET GROUP MATCHES
========================================= */

export async function apiGetMatches() {

  const books =
    await supabaseRequest(
      'books?select=*'
    );


  const swipes =
    await supabaseRequest(
      'swipes?direction=eq.right&select=book_id,user_id'
    );


  if (
    !books ||
    !swipes
  ) {
    return [];
  }


  const matchCounts = {};


  swipes.forEach(swipe => {

    const bookId =
      String(swipe.book_id);

    const userId =
      String(swipe.user_id).trim();


    if (!matchCounts[bookId]) {

      matchCounts[bookId] = {
        count: 0,
        voters: []
      };
    }


    /*
      Make sure one person cannot count
      twice for the same book.
    */

    if (
      !matchCounts[bookId]
        .voters
        .includes(userId)
    ) {

      matchCounts[bookId].count += 1;

      matchCounts[bookId].voters.push(
        userId
      );
    }

  });


  return books

    .map(book => ({

      ...book,

      voteCount:
        matchCounts[
          String(book.id)
        ]?.count || 0

    }))

    .filter(
      book =>
        book.voteCount >= 1
    )

    .sort(
      (a, b) =>
        b.voteCount -
        a.voteCount
    );
}


/* =========================================
   RESET THIS USER'S SWIPES
========================================= */

export async function apiResetSwipes(
  username
) {

  try {

    await supabaseRequest(
      `swipes?user_id=eq.${encodeURIComponent(username)}`,
      {
        method: 'DELETE'
      }
    );


    return {
      error: null
    };

  } catch (error) {

    return {
      error
    };
  }
}