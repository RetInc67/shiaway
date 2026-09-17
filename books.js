/* ================================
   ДАННЫЕ КНИГ
   Загружаются из админки (D1) через API,
   вместо старого захардкоженного массива.
================================ */

let BOOKS = [];

async function loadBooks() {

  try {

    const response = await fetch(
      "https://admin.lib-shiaway.workers.dev/api/books"
    );

    BOOKS = await response.json();

  } catch (error) {

    console.error("Ошибка загрузки книг:", error);

    BOOKS = [];

  }

  // render() определена в app.js — к моменту,
  // когда fetch завершится, app.js уже загрузится.

  if (typeof render === "function") {
    render();
  }

}

loadBooks();