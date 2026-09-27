/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
  'https://hixflcifimnsutwzevim.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_NxOlmZjO9B-EJnb6xtckvA_Ak129OON';


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

    'apikey':
      SUPABASE_ANON_KEY,

    'Authorization':
      `Bearer ${SUPABASE_ANON_KEY}`,

    'Content-Type':
      'application/json',

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
        'Supabase error:',
        response.status,
        errorText
      );

      throw new Error(
        `Database error: ${response.status}`
      );
    }


    /*
     * DELETE requests normally return
     * no content.
     */
    if (
      response.status === 204 ||
      response.status === 201
    ) {

      /*
       * 201 may contain data, so try to
       * read it when possible.
       */
      if (
        response.status === 201
      ) {

        try {
          return await response.json();
        } catch {
          return [];
        }
      }

      return [];
    }


    return await response.json();

  } catch (err) {

    console.error(
      'Supabase API Connection Error:',
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


  try {

    const res =
      await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`
      );


    const data =
      await res.json();


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

  } catch (e) {

    console.error(
      'Google Books search fell short:',
      e
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


/* =========================================================
   GET UNSWIPED BOOKS
   ========================================================= */

export async function apiGetUnswipedBooks(
  username
) {

  const swipedData =
    await supabaseRequest(
      `swipes?user_id=eq.${encodeURIComponent(username)}&select=book_id`
    );


  const excludedIds =
    swipedData
      ? swipedData.map(
          s => s.book_id
        )
      : [];


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

          direction
        })
    }
  );
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
   GET GROUP MATCHES
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

      const bId =
        String(
          swipe.book_id
        );


      if (
        !matchCounts[bId]
      ) {

        matchCounts[bId] = {
          count: 0,
          voters: []
        };
      }


      const userId =
        String(
          swipe.user_id
        ).trim();


      if (
        !matchCounts[bId]
          .voters
          .includes(userId)
      ) {

        matchCounts[bId]
          .count += 1;

        matchCounts[bId]
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


/* =========================================================
   RESET CURRENT USER'S SWIPES
   ========================================================= */

export async function apiResetSwipes(
  username
) {

  const path =
    `swipes?user_id=eq.${encodeURIComponent(username)}`;


  const result =
    await supabaseRequest(
      path,
      {
        method: 'DELETE'
      }
    );


  return {

    success:
      result !== null,

    error:
      result === null
        ? {
            message:
              'Failed to reset your swipes.'
          }
        : null
  };
}