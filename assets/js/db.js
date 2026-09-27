/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
  "https://hixflcifimnsutwzevim.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_NxOlmZjO9B-EJnb6xtckvA_Ak129OON";


/* =========================================================
   SUPABASE REQUEST HELPER
   ========================================================= */

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

      console.error(
        "Supabase error:",
        response.status,
        errorText
      );

      throw new Error(
        `Database error ${response.status}: ${errorText}`
      );
    }


    /*
      DELETE / PATCH requests may return
      no content.
    */

    if (
      response.status === 204 ||
      response.status === 201
    ) {

      const text =
        await response.text();

      if (!text) {
        return [];
      }

      try {
        return JSON.parse(text);
      } catch {
        return [];
      }
    }


    return await response.json();

  } catch (err) {

    console.error(
      "Supabase API Connection Error:",
      err
    );

    return null;
  }
}


/* =========================================================
   GOOGLE BOOKS METADATA
   ========================================================= */

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

    const res =
      await fetch(url);


    if (!res.ok) {
      throw new Error(
        `Google Books error ${res.status}`
      );
    }


    const data =
      await res.json();


    if (
      data.items &&
      data.items.length > 0
    ) {

      const volumeInfo =
        data.items[0].volumeInfo;


      let cover =
        volumeInfo.imageLinks?.thumbnail ||
        '';


      /*
        Google sometimes returns HTTP covers.
        Upgrade to HTTPS.
      */

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
            : author ||
              'Unknown Author',

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

  } catch (e) {

    console.error(
      "Google Books search failed:",
      e
    );
  }


  return {

    author:
      author ||
      'Unknown Author',

    description:
      'No description found.',

    rating:
      null,

    cover_url:
      ''
  };
}


/* =========================================================
   GET BOOKS THE USER HAS NOT YET VOTED ON
   ========================================================= */

export async function apiGetUnswipedBooks(
  username
) {

  const swipedData =
    await supabaseRequest(
      `swipes?user_id=eq.${encodeURIComponent(username)}&select=book_id`
    );


  /*
    If the swipe query fails, don't silently
    pretend the user has never voted.
  */

  if (swipedData === null) {

    console.error(
      'Could not retrieve swipe history.'
    );

    return [];
  }


  const excludedIds =
    swipedData.map(
      s => s.book_id
    );


  let path =
    'books?select=*&order=created_at.desc';


  if (
    excludedIds.length > 0
  ) {

    path +=
      `&id=not.in.(${excludedIds.join(',')})`;
  }


  return (
    await supabaseRequest(path)
  ) || [];
}


/* =========================================================
   LOG PASS / KEEP
   ========================================================= */

export async function apiLogSwipe(
  username,
  bookId,
  direction
) {

  const data =
    await supabaseRequest(
      'swipes',
      {
        method: 'POST',

        body:
          JSON.stringify({
            user_id:
              username,

            book_id:
              bookId,

            direction:
              direction
          })
      }
    );


  return data;
}


/* =========================================================
   RESET ALL SWIPES FOR ONE USER
   ========================================================= */

export async function apiResetSwipes(
  username
) {

  const encodedUsername =
    encodeURIComponent(username);


  const result =
    await supabaseRequest(
      `swipes?user_id=eq.${encodedUsername}`,
      {
        method: 'DELETE',
        headers: {
          'Prefer':
            'return=minimal'
        }
      }
    );


  /*
    supabaseRequest returns null
    when there is an error.
  */

  if (result === null) {

    return {
      data: null,

      error: {
        message:
          'Supabase rejected the reset request. Check the DELETE policy on the swipes table.'
      }
    };
  }


  return {
    data: result,
    error: null
  };
}


/* =========================================================
   ADD BOOK
   ========================================================= */

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


  const data =
    await supabaseRequest(
      'books',
      {
        method: 'POST',

        headers: {
          'Prefer':
            'return=representation'
        },

        body:
          JSON.stringify({

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

    error:
      data === null
        ? {
            message:
              'Failed to post book record to cloud server.'
          }
        : null

  };
}


/* =========================================================
   GET GROUP MATCHES / LEADERBOARD
   ========================================================= */

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


  swipes.forEach(
    swipe => {

      const bookId =
        String(
          swipe.book_id
        );


      if (
        !matchCounts[bookId]
      ) {

        matchCounts[bookId] = {
          count: 0,
          voters: []
        };
      }


      const userId =
        String(
          swipe.user_id
        ).trim();


      /*
        Make sure one person cannot
        count twice for the same book.
      */

      if (
        !matchCounts[bookId]
          .voters
          .includes(userId)
      ) {

        matchCounts[bookId].count += 1;

        matchCounts[bookId]
          .voters
          .push(userId);
      }
    }
  );


  return books

    .map(
      book => ({

        ...book,

        voteCount:
          matchCounts[
            String(book.id)
          ]?.count || 0

      })
    )

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