let tradition = "all";
let category = "all";
let query = "";

const CATS = {
  hadith: "Хадисы",
  tafsir: "Тафсиры",
  aqida: "Акида",
  fiqh: "Фикх",
  ethics: "Нравственность",
  history: "История"
};

const TRAD = {
  shia: "Шиитские книги",
  sunni: "Суннитские книги"
};

/* ================================
   НАВИГАЦИЯ И СКРЫТЫЕ РАЗДЕЛЫ
================================ */

function showSection(id, options = {}) {
  const section = document.getElementById(id);
  if (!section) return;

  section.classList.remove("app-section-hidden");

  // Каждый переход на новый раздел мягко проявляет сам раздел,
  // а браузер уже выполняет плавную прокрутку к нему.
  section.classList.remove("section-reveal");
  void section.offsetWidth;
  section.classList.add("section-reveal");

  document.querySelector(".footer")?.classList.remove("app-section-hidden");

  if (options.scroll !== false) {
    // Сначала даём браузеру применить display/layout, затем прокручиваем.
    // scroll-margin-top в CSS оставляет место под sticky-header.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // После появления раздела подключаем его элементы к анимации появления при чтении.
  requestAnimationFrame(prepareScrollReveals);
}

let revealObserver = null;

function prepareScrollReveals() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  }

  const targets = document.querySelectorAll(
    ".books-grid .book-card, .article-card, .library > h2, .library .toolbar, .favorites > h2, .about > *"
  );

  targets.forEach((element, index) => {
    if (!element.classList.contains("scroll-reveal")) {
      element.classList.add("scroll-reveal");
      element.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 45}ms`);
      revealObserver.observe(element);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  prepareScrollReveals();
  // Карточки книг/статей создаются динамически — подхватываем их автоматически.
  const revealMutationObserver = new MutationObserver(() => prepareScrollReveals());
  revealMutationObserver.observe(document.body, { childList: true, subtree: true });
});

document.addEventListener("click", event => {
  const trigger = event.target.closest("[data-show-section]");
  if (!trigger) return;

  const id = trigger.dataset.showSection;
  if (!id) return;

  event.preventDefault();
  showSection(id);

  if (window.history?.replaceState) {
    history.replaceState(null, "", `#${id}`);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  if (location.hash) {
    const id = location.hash.slice(1);
    if (["library", "favorites", "articles", "about"].includes(id)) {
      showSection(id, { scroll: false });
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }
});

/* ================================
   ИЗБРАННОЕ
================================ */

const FAV_KEY = "shiaway_favorites";

function getFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String) : [];
  } catch (error) {
    return [];
  }
}

function isFavorite(id) {
  return getFavorites().includes(String(id));
}

function toggleFavorite(id) {
  const key = String(id);
  const list = getFavorites();
  const index = list.indexOf(key);

  if (index === -1) {
    list.push(key);
  } else {
    list.splice(index, 1);
  }

  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch (error) {
    /* хранилище недоступно — просто игнорируем */
  }
}

function bookCardHtml(book) {
  const favActive = isFavorite(book.id);
  const hasCover = Boolean(String(book.cover || "").trim());
  const description = book.description || book.desc || "Описание этой книги пока не добавлено.";

  return `
    <article class="book-card" data-open-book-id="${escapeAttribute(book.id)}" tabindex="0" role="button" aria-label="Открыть информацию о книге: ${escapeAttribute(book.title || "")}">
      <div class="book-card-content">
        <div class="book-top">
          <span class="book-badge">${TRAD[book.tradition] || "Книга"}</span>
          <button
            class="fav-btn${favActive ? " active" : ""}"
            data-fav-id="${escapeAttribute(book.id)}"
            aria-label="${favActive ? "Убрать из избранного" : "Добавить в избранное"}"
            aria-pressed="${favActive}"
          >${favActive ? "★" : "☆"}</button>
        </div>

        <h3>${escapeHtml(book.title || "Без названия")}</h3>
        <div class="author">${escapeHtml(book.author || "Автор не указан")}</div>

        <div class="book-bottom">
          <span class="book-cat">${escapeHtml(CATS[book.category] || "")}</span>
          <span class="book-open-hint">Подробнее <b>→</b></span>
        </div>
      </div>
    </article>
  `;
}

// Нормализация поиска: арабские огласовки, разные формы букв, тире, пробелы
// и знаки препинания не мешают найти книгу.
function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    // Арабские и персидские варианты букв приводим к одной форме.
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ی/g, "ي")
    .replace(/ك/g, "ك")
    .replace(/ک/g, "ك")
    .replace(/ؤ/g, "و")
    .replace(/[ئ]/g, "ي")
    // Убираем огласовки, татвиль и знаки Корана.
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    // Тире, дефисы, пробелы и пунктуация не влияют на совпадение.
    .replace(/[\s\-_‐‑‒–—―.,،؛:;!?؟'"`´()\[\]{}\/\\|]+/g, "")
    .trim();
}

function render() {
  const grid = document.getElementById("books");
  const empty = document.getElementById("empty");
  const results = document.getElementById("results");

  if (!grid) return;

  const q = normalizeSearchText(query);
  const favIds = getFavorites();

  const list = BOOKS.filter(book => {
    const matchesTradition =
      tradition === "all" || book.tradition === tradition;

    const matchesCategory =
      category === "all" ||
      (category === "favorites"
        ? favIds.includes(String(book.id))
        : book.category === category);

    const text = normalizeSearchText(
      `${book.title || ""} ${book.author || ""}`
    );

    const matchesSearch =
      !q || text.includes(q);

    return (
      matchesTradition &&
      matchesCategory &&
      matchesSearch
    );
  });

  grid.innerHTML = list.map(bookCardHtml).join("");

  if (results) {
    results.textContent = `${list.length} книг`;
  }

  if (empty) {
    empty.hidden = list.length !== 0;
  }

  renderFavorites();
}

function renderFavorites() {
  const grid = document.getElementById("favBooks");
  const empty = document.getElementById("favEmpty");
  const results = document.getElementById("favResults");

  if (!grid) return;

  const favIds = getFavorites();

  const list = BOOKS.filter(book => favIds.includes(String(book.id)));

  grid.innerHTML = list.map(bookCardHtml).join("");

  if (results) {
    results.textContent = `${list.length} книг`;
  }

  if (empty) {
    empty.hidden = list.length !== 0;
  }
}

/* ТРАДИЦИИ */

document.querySelectorAll(".tradition").forEach(button => {
  button.addEventListener("click", () => {

    tradition = button.dataset.tradition;

    document
      .querySelectorAll(".tradition")
      .forEach(x => x.classList.remove("active"));

    button.classList.add("active");

    render();
  });
});

/* КАТЕГОРИИ */

document.querySelectorAll(".cat").forEach(button => {
  button.addEventListener("click", () => {

    category = button.dataset.cat;

    document
      .querySelectorAll(".cat")
      .forEach(x => x.classList.remove("active"));

    button.classList.add("active");

    render();
  });
});

/* ПОИСК */

const search = document.getElementById("search");

if (search) {
  search.addEventListener("input", event => {
    query = event.target.value;
    render();
  });
}

/* ИЗБРАННОЕ — клик по звёздочке */

document.addEventListener("click", event => {

  const favButton = event.target.closest("[data-fav-id]");

  if (!favButton) return;

  toggleFavorite(favButton.dataset.favId);

  render();

});

/* МОБИЛЬНОЕ МЕНЮ (гамбургер) */

const mobileMenuBtn = document.getElementById("mobileMenu");
const mobilePanel = document.getElementById("mobilePanel");

if (mobileMenuBtn && mobilePanel) {

  mobileMenuBtn.addEventListener("click", event => {

    event.stopPropagation();

    const isOpen = mobilePanel.classList.toggle("open");

    mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));

  });

  document.addEventListener("click", event => {

    if (!mobilePanel.classList.contains("open")) return;

    if (
      mobilePanel.contains(event.target) ||
      mobileMenuBtn.contains(event.target)
    ) {
      return;
    }

    mobilePanel.classList.remove("open");
    mobileMenuBtn.setAttribute("aria-expanded", "false");

  });

  mobilePanel.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mobilePanel.classList.remove("open");
      mobileMenuBtn.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", event => {

    if (event.key !== "Escape") return;

    mobilePanel.classList.remove("open");
    mobileMenuBtn.setAttribute("aria-expanded", "false");

  });

}

/* ПОДРОБНОСТИ КНИГИ */

function getPdfLinks(book) {
  if (!book) return [];
  if (typeof book.pdf === "string") return book.pdf ? [{ label: "Скачать PDF", url: book.pdf }] : [];
  if (book.pdf && typeof book.pdf === "object") {
    const count = Math.max(Number(book.volumes) || 0, ...Object.keys(book.pdf).map(Number).filter(Number.isFinite), 0);
    return Array.from({ length: count }, (_, i) => ({
      label: count > 1 ? `Том ${i + 1}` : "Скачать PDF",
      url: book.pdf[i + 1] || ""
    }));
  }
  return [];
}


function normalizeCoverUrl(value) {
  if (!value) return "";

  if (typeof value === "object") {
    value = value.display_url || value.url || value.link || value.src || "";
  }

  let url = String(value).trim();
  if (!url) return "";

  // Некоторые ссылки могут быть вставлены без протокола.
  if (/^(i\.ibb\.co|ibb\.co|imgbb\.com)\//i.test(url)) {
    url = "https://" + url;
  }

  // HTML-страница ImgBB не является изображением. Для уже прямых
  // ссылок i.ibb.co ничего не меняем.
  if (/^https?:\/\/imgbb\.com\//i.test(url)) {
    return "";
  }

  return url;
}

function openBookDetails(book) {
  if (!book) return;

  const modal = document.createElement("div");
  modal.className = "book-modal";
  const description = book.description || book.desc || "Описание этой книги пока не добавлено.";
  const links = getPdfLinks(book);
  const cover = normalizeCoverUrl(book.cover);

  modal.innerHTML = `
    <div class="book-modal-backdrop"></div>
    <section class="book-modal-box" role="dialog" aria-modal="true" aria-labelledby="bookModalTitle">
      <button type="button" class="book-modal-close" aria-label="Закрыть">×</button>
      <div class="book-modal-cover ${cover ? "has-cover" : ""}">
        ${cover
          ? `<img src="${escapeAttribute(cover)}" alt="Обложка: ${escapeAttribute(book.title || "")}" referrerpolicy="no-referrer" onerror="this.closest('.book-modal-cover').classList.remove('has-cover'); this.remove();">`
          : `<span>${escapeHtml((book.title || "К").charAt(0))}</span>`}
      </div>
      <div class="book-modal-content">
        <div class="book-modal-kicker">${escapeHtml(TRAD[book.tradition] || "Книга")}</div>
        <h2 id="bookModalTitle">${escapeHtml(book.title || "Без названия")}</h2>
        <div class="book-modal-author">${escapeHtml(book.author || "Автор не указан")}</div>
        <div class="book-modal-meta">
          ${CATS[book.category] ? `<span>${escapeHtml(CATS[book.category])}</span>` : ""}
          ${Number(book.volumes) > 1 ? `<span>${escapeHtml(String(book.volumes))} тома</span>` : ""}
        </div>
        <div class="book-modal-description">${escapeHtml(description).replace(/\n/g, "<br>")}</div>
        <div class="book-download-section">
          <div class="book-download-heading">${links.length > 1 ? "Выберите том" : "Файл книги"}</div>
          <div class="book-modal-actions ${links.length === 1 ? "single-download" : "multi-download"}">
            ${links.length && links.some(item => item.url)
              ? links.map((item, index) => item.url
                  ? `<button type="button" class="book-download" data-book-download="${escapeAttribute(item.url)}"><span class="book-download-label">${escapeHtml(item.label)}</span><span class="book-download-icon">↓</span></button>`
                  : `<button type="button" class="book-download unavailable" disabled><span class="book-download-label">${escapeHtml(item.label)}</span><span class="book-download-status">Нет файла</span></button>`
                ).join("")
              : `<div class="book-no-pdf">PDF пока не добавлен</div>`}
          </div>
        </div>
      </div>
    </section>
  `;

  document.body.appendChild(modal);
  lockBodyScroll();

  const close = () => {
    modal.remove();
    unlockBodyScroll();
  };

  modal.querySelector(".book-modal-close").addEventListener("click", close);
  modal.querySelector(".book-modal-backdrop").addEventListener("click", close);
  modal.querySelectorAll("[data-book-download]").forEach(button => {
    button.addEventListener("click", () => {
      window.open(button.dataset.bookDownload, "_blank", "noopener");
    });
  });
}

document.addEventListener("click", event => {
  const card = event.target.closest("[data-open-book-id]");
  if (!card) return;
  if (event.target.closest("[data-fav-id], [data-book-id], a, button")) return;
  const book = BOOKS.find(b => String(b.id) === String(card.dataset.openBookId));
  openBookDetails(book);
});

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = document.activeElement?.closest?.("[data-open-book-id]");
  if (!card) return;
  event.preventDefault();
  const book = BOOKS.find(b => String(b.id) === String(card.dataset.openBookId));
  openBookDetails(book);
});

/* PDF */

document.addEventListener("click", event => {

  const button = event.target.closest("[data-book-id]");

  if (!button) return;

  const book = BOOKS.find(
    b => String(b.id) === String(button.dataset.bookId)
  );

  if (!book || !book.pdf) return;

  /* Одна ссылка — старый формат */

  if (typeof book.pdf === "string") {

  const modal = document.createElement("div");

  modal.className = "pdf-modal";

  modal.innerHTML = `
    <div class="pdf-modal-bg"></div>

    <div class="pdf-modal-box" role="dialog" aria-modal="true">

      <div class="pdf-modal-header">

        <div class="pdf-modal-heading">

          <div class="pdf-modal-label">
            PDF
          </div>

          <h2>
            Скачать книгу
          </h2>

          <p>
            ${escapeHtml(book.title)}
          </p>

        </div>

        <button
          type="button"
          class="pdf-modal-close"
          aria-label="Закрыть"
        >
          ×
        </button>

      </div>

      <div class="pdf-modal-content">

        <div class="pdf-volume-title">
          Скачать книгу
        </div>

        <div class="pdf-volume-list single-volume">

          <button
            type="button"
            class="pdf-volume"
            data-volume-url="${escapeAttribute(book.pdf)}"
          >
            <span class="pdf-volume-name">
              Скачать книгу в PDF
            </span>

            <span class="pdf-volume-icon">
              ↓
            </span>
          </button>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(modal);
  lockBodyScroll();

  const closeModal = () => {
    modal.remove();
    unlockBodyScroll();
  };

  modal
    .querySelector(".pdf-modal-close")
    .addEventListener("click", closeModal);

  modal
    .querySelector(".pdf-modal-bg")
    .addEventListener("click", closeModal);

  modal
    .querySelector("[data-volume-url]")
    .addEventListener("click", () => {

      window.open(
        book.pdf,
        "_blank"
      );

    });

  return;
}

  /* Количество томов */

  const count = Number(book.volumes) || 0;

  if (count <= 0) return;

  /* Создание окна */

  const modal = document.createElement("div");

  modal.className = "pdf-modal";

  let volumeButtons = "";

  for (let i = 1; i <= count; i++) {

    const url = book.pdf[i];

    if (url) {

      volumeButtons += `
        <button
          type="button"
          class="pdf-volume"
          data-volume-url="${escapeAttribute(url)}"
        >
          <span class="pdf-volume-name">
            Том ${i}
          </span>

          <span class="pdf-volume-icon">
            ↓
          </span>
        </button>
      `;

    } else {

      volumeButtons += `
        <button
          type="button"
          class="pdf-volume pdf-volume-disabled"
          disabled
        >
          <span class="pdf-volume-name">
            Том ${i}
          </span>

          <span class="pdf-volume-icon">
            —
          </span>
        </button>
      `;

    }
  }

  modal.innerHTML = `

    <div class="pdf-modal-bg"></div>

    <div
      class="pdf-modal-box"
      role="dialog"
      aria-modal="true"
    >

      <div class="pdf-modal-header">

        <div class="pdf-modal-heading">

          <div class="pdf-modal-label">
            PDF
          </div>

          <h2>
            Скачать книгу
          </h2>

          <p>
            ${escapeHtml(book.title)}
          </p>

        </div>

        <button
          type="button"
          class="pdf-modal-close"
          aria-label="Закрыть"
        >
          ×
        </button>

      </div>

      <div class="pdf-modal-content">

        <div class="pdf-volume-title">
          Выберите том
        </div>

        <div class="pdf-volume-list${count === 1 ? " single-volume" : ""}">
          ${volumeButtons}
        </div>

      </div>

    </div>

  `;

  document.body.appendChild(modal);
  lockBodyScroll();

  /* Закрытие */

  const closeModal = () => {
    modal.remove();
    unlockBodyScroll();
  };

  modal
    .querySelector(".pdf-modal-close")
    .addEventListener("click", closeModal);

  modal
    .querySelector(".pdf-modal-bg")
    .addEventListener("click", closeModal);

  /* Открытие тома */

  modal
    .querySelectorAll("[data-volume-url]")
    .forEach(volumeButton => {

      volumeButton.addEventListener("click", () => {

        const url =
          volumeButton.dataset.volumeUrl;

        window.open(
          url,
          "_blank"
        );

      });

    });

});

/* ESC */

document.addEventListener("keydown", event => {

  if (event.key !== "Escape") return;

  const modal =
    document.querySelector(".book-modal, .pdf-modal");

  if (modal) {
    modal.remove();
    unlockBodyScroll();
  }

});

/* CTRL / CMD + K */

document.addEventListener("keydown", event => {

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  ) {

    event.preventDefault();

    if (search) {
      search.focus();
    }

  }

});

/* ЗАЩИТА ССЫЛОК */

/* БЛОКИРОВКА ПРОКРУТКИ ФОНА ПРИ ОТКРЫТОМ ОКНЕ */

let scrollLockCount = 0;
let scrollLockPrevBodyOverflow = "";
let scrollLockPrevBodyPaddingRight = "";
let scrollLockPrevHtmlOverflow = "";

function lockBodyScroll() {

  if (scrollLockCount === 0) {

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    scrollLockPrevBodyOverflow = document.body.style.overflow;
    scrollLockPrevBodyPaddingRight = document.body.style.paddingRight;
    scrollLockPrevHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {

      const currentPadding =
        parseFloat(getComputedStyle(document.body).paddingRight) || 0;

      document.body.style.paddingRight =
        `${currentPadding + scrollbarWidth}px`;

    }

  }

  scrollLockCount++;

}

function unlockBodyScroll() {

  if (scrollLockCount === 0) return;

  scrollLockCount--;

  if (scrollLockCount === 0) {

    document.documentElement.style.overflow = scrollLockPrevHtmlOverflow;
    document.body.style.overflow = scrollLockPrevBodyOverflow;
    document.body.style.paddingRight = scrollLockPrevBodyPaddingRight;

  }

}

function escapeAttribute(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ОКНО ВЫБОРА ТОМОВ */

const pdfStyle = document.createElement("style");

pdfStyle.textContent = `

  .pdf-modal {
    position: fixed;
    inset: 0;

    z-index: 99999;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 20px;

    animation: pdfModalFade .18s ease;
  }

  .pdf-modal-bg {
    position: absolute;
    inset: 0;

    background: rgba(8, 10, 14, .72);

    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .pdf-modal-box {
    position: relative;

    z-index: 1;

    width: min(480px, 100%);

    max-height: 86vh;

    overflow: hidden;

    border: 1px solid rgba(255,255,255,.10);

    border-radius: 24px;

    background:
      linear-gradient(
        180deg,
        #17191f 0%,
        #111318 100%
      );

    color: #fff;

    box-shadow:
      0 30px 90px rgba(0,0,0,.50);

    animation: pdfModalUp .22s ease;
  }

  .pdf-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;

    padding: 24px 24px 20px;

    border-bottom:
      1px solid rgba(255,255,255,.08);
  }

  .pdf-modal-heading {
    min-width: 0;

    padding-right: 15px;
  }

  .pdf-modal-label {
    display: inline-flex;
    align-items: center;

    margin-bottom: 8px;

    padding: 5px 9px;

    border-radius: 7px;

    background: rgba(255,255,255,.08);

    color: rgba(255,255,255,.60);

    font-size: 11px;
    font-weight: 700;

    letter-spacing: .08em;
  }

  .pdf-modal-heading h2 {
    margin: 0;

    font-size: 22px;
    font-weight: 700;

    letter-spacing: -.3px;
  }

  .pdf-modal-heading p {
    margin: 7px 0 0;

    color: rgba(255,255,255,.52);

    font-size: 14px;

    line-height: 1.4;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;
  }

  .pdf-modal-close {
    flex: 0 0 auto;

    width: 38px;
    height: 38px;

    display: flex;
    align-items: center;
    justify-content: center;

    border: 1px solid rgba(255,255,255,.08);

    border-radius: 50%;

    background: rgba(255,255,255,.06);

    color: rgba(255,255,255,.70);

    font-size: 25px;
    line-height: 1;

    cursor: pointer;

    transition:
      background .15s ease,
      color .15s ease,
      transform .15s ease;
  }

  .pdf-modal-close:hover {
    background: rgba(255,255,255,.12);

    color: #fff;

    transform: scale(1.05);
  }

  .pdf-modal-content {
    padding: 20px;
  }

  .pdf-volume-title {
    margin: 0 0 12px;

    color: rgba(255,255,255,.50);

    font-size: 13px;
    font-weight: 600;
  }

  .pdf-volume-list {
    display: grid;

    grid-template-columns:
      repeat(3, minmax(0, 1fr));

    gap: 10px;

    max-height: 55vh;

    overflow-y: auto;

    padding-top: 4px;
    padding-right: 2px;
  }

  .pdf-volume-list::-webkit-scrollbar {
    width: 5px;
  }

  .pdf-volume-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .pdf-volume-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,.13);

    border-radius: 10px;
  }

  .pdf-volume {
    width: 100%;
    min-height: 58px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 15px;

    border:
      1px solid rgba(255,255,255,.08);

    border-radius: 14px;

    background:
      rgba(255,255,255,.055);

    color: #fff;

    font-size: 15px;
    font-weight: 600;

    text-align: left;

    cursor: pointer;

    transition:
      background .15s ease,
      border-color .15s ease,
      transform .15s ease;
  }

  .pdf-volume:hover {
    background:
      rgba(255,255,255,.10);

    border-color:
      rgba(255,255,255,.16);

    transform: translateY(-1px);
  }

  .pdf-volume:active {
    transform: scale(.98);
  }

  .pdf-volume-name {
    overflow: hidden;

    white-space: nowrap;

    text-overflow: ellipsis;
  }

  .pdf-volume-icon {
    flex: 0 0 auto;

    width: 29px;
    height: 29px;

    display: flex;
    align-items: center;
    justify-content: center;

    margin-left: 10px;

    border-radius: 50%;

    background:
      rgba(255,255,255,.08);

    color: rgba(255,255,255,.72);

    font-size: 15px;
  }

  .pdf-volume-disabled {
    opacity: .30;

    cursor: not-allowed;
  }

  .pdf-volume-disabled:hover {
    transform: none;

    background:
      rgba(255,255,255,.055);

    border-color:
      rgba(255,255,255,.08);
  }

  @keyframes pdfModalFade {

    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }

  }

  @keyframes pdfModalUp {

    from {
      opacity: 0;

      transform:
        translateY(16px)
        scale(.97);
    }

    to {
      opacity: 1;

      transform:
        translateY(0)
        scale(1);
    }

  }

  @media (max-width: 520px) {

    .pdf-modal {
      padding: 12px;
    }

    .pdf-modal-box {
      border-radius: 21px;
    }

    .pdf-modal-header {
      padding: 20px 18px 17px;
    }

    .pdf-modal-content {
      padding: 16px;
    }

    .pdf-modal-heading h2 {
      font-size: 20px;
    }

    .pdf-volume-list {
      grid-template-columns: 1fr;

      max-height: 60vh;
    }

  }

`;

document.head.appendChild(pdfStyle);

/* ЗАПУСК */

render(); 

/* ================================
   AI АССИСТЕНТ
================================ */

(function () {


const style = document.createElement("style");

style.textContent = `

html {
scroll-behavior:smooth;
}


/* КНОПКА */

.ai-jump-btn {

display:inline-flex;
align-items:center;
justify-content:center;

padding:9px 15px;

border-radius:12px;

border:1px solid rgba(255,255,255,.12);

background:
rgba(255,255,255,.07);

color:white;

font-size:13px;

font-weight:600;

cursor:pointer;

transition:.2s;

}


.ai-jump-btn:hover {

transform:translateY(-2px);

background:
rgba(255,255,255,.14);

}



/* БЛОК */

#ai-assistant {

display:none;
width:min(900px,calc(100% - 32px));

margin:70px auto 50px;

border-radius:24px;

overflow:hidden;


border:
1px solid rgba(255,255,255,.10);


background:
linear-gradient(
145deg,
#181a20,
#101216
);


color:white;


box-shadow:
0 30px 90px rgba(0,0,0,.35);

}



.ai-inner {

padding:30px;

}



.ai-head {

display:flex;

align-items:center;

justify-content:space-between;

margin-bottom:22px;

}



.ai-title {

margin:0;

font-size:30px;

font-weight:700;

}



.ai-subtitle {

margin-top:8px;

font-size:14px;

color:
rgba(255,255,255,.5);

}



.ai-orb {

width:52px;

height:52px;

display:flex;

align-items:center;

justify-content:center;

border-radius:17px;


background:
rgba(255,255,255,.08);


font-size:22px;

}



/* ЧАТ */

.ai-chat {

display:flex;

flex-direction:column;

gap:10px;

max-height:420px;

overflow-y:auto;

margin-bottom:15px;

}


.ai-message {

max-width:78%;

padding:12px 15px;

border-radius:16px;

font-size:14px;

line-height:1.55;

white-space:pre-wrap;

animation:
aiMessage .2s ease;

}



@keyframes aiMessage {

from{

opacity:0;

transform:translateY(8px);

}

to{

opacity:1;

transform:none;

}

}



.ai-user {

align-self:flex-end;

background:
rgba(255,255,255,.14);

}



.ai-bot {

align-self:flex-start;

background:
rgba(255,255,255,.06);

}



/* ОЖИДАНИЕ */

.ai-wait {

width:42px;

height:28px;

padding:0;

display:flex;

align-items:center;

justify-content:center;

border-radius:14px;

}



.ai-thinking {

display:flex;

gap:4px;

}



.ai-thinking span {

width:5px;

height:5px;

border-radius:50%;

background:white;

opacity:.35;

animation:
aiDots 1.2s infinite;

}


.ai-thinking span:nth-child(2){

animation-delay:.2s;

}


.ai-thinking span:nth-child(3){

animation-delay:.4s;

}


@keyframes aiDots {

50%{

opacity:1;

transform:translateY(-3px);

}

}



/* КОПИРОВАТЬ */

.ai-copy {

margin-top:10px;

padding:5px 11px;

border-radius:10px;


border:
1px solid rgba(255,255,255,.12);


background:
rgba(255,255,255,.08);


color:white;

font-size:11px;

cursor:pointer;

}



/* ВВОД */


.ai-input-wrap {

display:flex;

gap:8px;

padding:8px;

border-radius:17px;


border:
1px solid rgba(255,255,255,.10);


background:
rgba(0,0,0,.25);

}



.ai-input {

flex:1;

resize:none;

background:none;

border:none;

outline:none;

color:white;

padding:12px;

font-size:14px;

}



.ai-send {

width:45px;

height:45px;

border:none;

border-radius:13px;


background:
rgba(255,255,255,.12);


color:white;

font-size:19px;

cursor:pointer;

}



.ai-send:hover {

background:
rgba(255,255,255,.2);

}

`;

document.head.appendChild(style);



const ai = document.createElement("section");

ai.id = "ai-assistant";
ai.classList.add("ai-collapsed");


ai.innerHTML = `

<div class="ai-inner">


<div class="ai-head">

<div>

<h2 class="ai-title">
Исламский AI-ассистент
</h2>


<p class="ai-subtitle">
Вопросы по хадисам, книгам и истории
</p>


</div>


<div class="ai-orb">
✦
</div>


</div>



<div class="ai-chat"></div>



<div class="ai-input-wrap">


<textarea

class="ai-input"

rows="1"

placeholder="Задайте вопрос..."

></textarea>



<button

class="ai-send"

type="button"

>

↑

</button>


</div>


</div>

`;



document.body.appendChild(ai);




/* КНОПКА В ШАПКЕ */


const jump =
document.createElement("button");


jump.className =
"ai-jump-btn";


jump.type =
"button";


jump.textContent =
"✦ AI Ассистент";



const header =

document.getElementById("headerActions") ||

document.querySelector("header") ||

document.querySelector(".header") ||

document.querySelector(".nav") ||

document.querySelector("nav");



if(header){

header.appendChild(jump);

}

else{


document.body.insertBefore(

jump,

document.body.firstChild

);


}




jump.addEventListener("click", () => {
  ai.classList.remove("ai-collapsed");
  ai.style.display = "block";
  ai.scrollIntoView({ behavior:"smooth", block:"start" });
  input.focus();
});






/* ЭЛЕМЕНТЫ */


const chat =
ai.querySelector(".ai-chat");


const input =
ai.querySelector(".ai-input");


const send =
ai.querySelector(".ai-send");







/* ДОБАВЛЕНИЕ СООБЩЕНИЙ */


function addMessage(text,type){


const div =
document.createElement("div");


div.className =
"ai-message ai-"+type;



div.textContent =
text;




if(type==="bot"){


const copy =
document.createElement("button");



copy.className =
"ai-copy";



copy.textContent =
"Копировать";



copy.onclick = ()=>{


navigator.clipboard.writeText(text);



copy.textContent =
"Скопировано";



setTimeout(()=>{


copy.textContent =
"Копировать";


},1500);



};



div.appendChild(copy);



}



chat.appendChild(div);



chat.scrollTop =
chat.scrollHeight;



return div;

}


send.addEventListener(
"click",
async()=>{


const text =
input.value.trim();



if(!text) return;



/* сообщение пользователя */

addMessage(
text,
"user"
);



input.value="";



/* маленький AI думает */


const thinking =
document.createElement("div");


thinking.className =
"ai-message ai-bot ai-wait";


thinking.innerHTML = `

<div class="ai-thinking">

<span></span>
<span></span>
<span></span>

</div>

`;



chat.appendChild(thinking);



chat.scrollTop =
chat.scrollHeight;



try{


const response =
await fetch(

"https://shiaway-ai.lib-shiaway.workers.dev/",

{

method:"POST",


headers:{

"Content-Type":
"application/json"

},


body:JSON.stringify({

contents:[

{

parts:[

{

text:text

}

]

}

]

})

}

);





const data =
await response.json();




if(!response.ok){


throw new Error(

data?.error?.message ||

"Ошибка API"

);


}




const answer =

data?.candidates?.[0]

?.content

?.parts?.[0]

?.text;



if(!answer){


throw new Error(
"AI не вернул ответ"
);


}




/* убрать ожидание */


thinking.remove();



/* показать ответ */


addMessage(

answer,

"bot"

);



}



catch(error){



thinking.remove();



addMessage(

"Ошибка AI: "+error.message,

"bot"

);



}



});





/* ENTER отправка */


input.addEventListener(

"keydown",

event=>{


if(

event.key==="Enter" &&

!event.shiftKey

){


event.preventDefault();


send.click();


}


}

);





})();

/* ================================
   СТАТЬИ SHIAWAY — ИЕРАРХИЯ КАК В КАТАЛОГЕ
================================ */
(function(){
 const foldersBox=document.getElementById('articleFolders'), filesBox=document.getElementById('articleFiles'), crumbsBox=document.getElementById('articleBreadcrumbs'), searchBox=document.getElementById('articleSearch'), clearBtn=document.getElementById('articleSearchClear'), emptyBox=document.getElementById('articlesEmpty'), countBox=document.getElementById('articleCount');
 const rubricsSelect=document.getElementById('sidebarRubrics'), recentList=document.getElementById('sidebarRecent');
 if(!foldersBox||!filesBox)return;
 const API_BASES=[location.origin,'https://admin.lib-shiaway.workers.dev'].filter((v,i,a)=>v&&a.indexOf(v)===i); let API_BASE=null,categories=[],articles=[],current=null,query='';
 async function api(path,options){let last;for(const base of API_BASES){try{const r=await fetch(base+path,options);if(r.ok){API_BASE=base;return r;}last=r;}catch(e){last=e;}}throw last||new Error('API unavailable');}
 const esc=v=>escapeHtml(String(v??''));
 const date=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});};
 const children=id=>categories.filter(c=>(c.parent_id==null?null:Number(c.parent_id))===(id==null?null:Number(id))).sort((x,y)=>String(x.name).localeCompare(String(y.name),'ru'));
 const cat=id=>categories.find(c=>String(c.id)===String(id));
 function crumbs(id){let out=[],c=cat(id),seen=new Set();while(c&&!seen.has(c.id)){seen.add(c.id);out.unshift(c);c=cat(c.parent_id)}return out;}
 function norm(v){return String(v||'').normalize('NFKD').toLowerCase().replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[^\p{L}\p{N}]+/gu,'');}
 const ICO_FOLDER='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
 const ICO_FILE='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
 const ICO_FOLDER_BIG='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
 function article(a){return `<a class="article-file" href="article.html?id=${encodeURIComponent(a.id)}"><span class="article-file-icon">${ICO_FILE}</span><span class="article-file-copy"><strong>${esc(a.title||'Без названия')}</strong><small>${esc(date(a.created_at))}</small></span></a>`;}
 function articleRow(a){return `<a class="article-file" href="article.html?id=${encodeURIComponent(a.id)}"><span class="mini-ic">${ICO_FILE}</span>${esc(a.title||'Без названия')}</a>`;}
 function subfolderRow(c){const n=Number(c.article_count||0);return `<button type="button" class="article-subfolder" data-article-cat="${c.id}"><span class="mini-ic">${ICO_FOLDER}</span>${esc(c.name)} <span style="color:#6c6f74">(${n})</span></button>`;}
 function folder(c){const n=Number(c.article_count||0);return `<div class="article-category-block"><div class="article-category-title"><button type="button" data-article-cat="${c.id}">${esc(c.name)}</button><span>(${n})</span></div><div class="article-category-items">${children(c.id).map(folder).join('')}${articles.filter(a=>String(a.category_id)===String(c.id)).map(article).join('')}</div></div>`;}
 function catCard(c){
   const n=Number(c.article_count||0);
   const kids=children(c.id), own=articles.filter(a=>String(a.category_id)===String(c.id));
   const items=[...kids.map(subfolderRow),...own.map(articleRow)].join('');
   return `<div class="article-cat-card"><div class="article-cat-head"><span class="cat-folder-ic">${ICO_FOLDER_BIG}</span><button type="button" data-article-cat="${c.id}">${esc(c.name)}</button><span>(${n})</span></div><div class="article-cat-list">${items||'<span style="color:#555">Пока пусто</span>'}</div></div>`;
 }
 function render(){const q=norm(query);clearBtn.hidden=!query;emptyBox.hidden=true;
   if(q){
     foldersBox.className='article-folders-list'; filesBox.hidden=false; filesBox.className='article-files';
     const ma=articles.filter(a=>norm(`${a.title} ${a.category_name||''} ${a.content||''}`).includes(q));const mc=categories.filter(c=>norm(c.name).includes(q));crumbsBox.innerHTML='<span>Результаты поиска</span>';foldersBox.innerHTML=mc.map(c=>`<div class="search-category"><button data-article-cat="${c.id}">${esc(c.name)}</button></div>`).join('');filesBox.innerHTML=ma.map(article).join('');countBox.textContent=`${ma.length} ${ma.length===1?'статья':'статей'}`;if(!ma.length&&!mc.length)emptyBox.hidden=false;return;}
   crumbsBox.innerHTML=`<button type="button" data-article-root>Статьи</button>`+crumbs(current).map(c=>`<span>/</span><button type="button" data-article-cat="${c.id}">${esc(c.name)}</button>`).join('');
   if(current==null){
     foldersBox.className='article-grid'; filesBox.hidden=true;
     const top=children(null);
     foldersBox.innerHTML=top.map(catCard).join('');
     countBox.textContent=`${categories.length} категорий · ${articles.length} статей`;
     if(!top.length)emptyBox.hidden=false;
     return;
   }
   foldersBox.className='article-folders-list'; filesBox.hidden=false; filesBox.className='article-files';
   const kids=children(current), own=articles.filter(a=>(a.category_id==null?null:Number(a.category_id))===(current==null?null:Number(current)));
   foldersBox.innerHTML=kids.map(c=>`<a class="article-folder" href="#" data-article-cat="${c.id}"><span class="article-folder-icon">${ICO_FOLDER_BIG}</span><span class="article-folder-copy"><strong>${esc(c.name)}</strong><small>${Number(c.article_count||0)} статей</small></span><span class="article-folder-arrow">→</span></a>`).join('');
   filesBox.innerHTML=own.map(article).join(''); countBox.textContent=`${kids.length+own.length}`; if(!kids.length&&!own.length)emptyBox.hidden=false;
 }
 function go(id){current=id==null?null:Number(id);query='';if(searchBox)searchBox.value='';render();document.getElementById('articles')?.scrollIntoView({behavior:'smooth',block:'start'});}
 document.addEventListener('click',e=>{const c=e.target.closest('[data-article-cat]');if(c){e.preventDefault();go(c.dataset.articleCat)}const r=e.target.closest('[data-article-root]');if(r){e.preventDefault();go(null)}});
 searchBox?.addEventListener('input',e=>{query=e.target.value;render()});clearBtn?.addEventListener('click',()=>{query='';searchBox.value='';render();searchBox.focus()});
 rubricsSelect?.addEventListener('change',()=>{if(rubricsSelect.value)go(rubricsSelect.value)});
 function fillSidebar(){
   if(rubricsSelect){
     function opts(id,depth){return children(id).flatMap(c=>[`<option value="${c.id}">${'—'.repeat(depth)} ${esc(c.name)} (${Number(c.article_count||0)})</option>`,...opts(c.id,depth+1)]);}
     rubricsSelect.innerHTML='<option value="">Выберите рубрику</option>'+opts(null,0).join('');
   }
   if(recentList){
     const recent=[...articles].sort((a,b)=>Number(b.id)-Number(a.id)).slice(0,10);
     recentList.innerHTML=recent.map(a=>`<li><span class="mini-ic">${ICO_FILE}</span><a href="article.html?id=${encodeURIComponent(a.id)}">${esc(a.title||'Без названия')}</a></li>`).join('');
   }
 }
 (async()=>{try{
   let ad=[]; let cd={categories:[]};
   try{const ar=await api('/api/articles'); ad=await ar.json();}catch(e){}
   try{const cr=await api('/api/article-categories'); cd=await cr.json();}catch(e){}
   articles=Array.isArray(ad)?ad:(Array.isArray(ad?.articles)?ad.articles:[]);
   categories=Array.isArray(cd?.categories)?cd.categories:(Array.isArray(cd)?cd:[]);
   const params=new URLSearchParams(location.search);const sq=params.get('search');
   if(sq){query=sq;if(searchBox)searchBox.value=sq;}
   render();fillSidebar();
   if(!articles.length&&!categories.length) throw new Error('API returned no article data');
 }catch(e){foldersBox.innerHTML='';filesBox.hidden=false;filesBox.innerHTML='<div class="articles-empty"><h3>Не удалось загрузить статьи</h3><p>Проверьте, что API статей опубликован на Worker и обновите страницу.</p></div>'}})();
})();

