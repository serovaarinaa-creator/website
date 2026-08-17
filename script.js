document.addEventListener("DOMContentLoaded", () => {
  /* --- Мягкий скролл колесом --- */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  if (finePointer && !reduceMotion) {
    // родной smooth выключаем, иначе он спорит с нашей анимацией на якорях
    root.style.scrollBehavior = "auto";

    let target = window.scrollY;
    let raf = 0;

    const maxScroll = () => root.scrollHeight - window.innerHeight;
    const clamp = (v) => Math.min(Math.max(v, 0), Math.max(maxScroll(), 0));

    const tick = () => {
      const diff = target - window.scrollY;
      if (Math.abs(diff) < 0.5) {
        raf = 0;
        return;
      }
      window.scrollTo(0, window.scrollY + diff * 0.18);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        // открыт просмотр работы — страница под ним стоит
        if (document.body.dataset.lock !== undefined) return;
        e.preventDefault();

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 16;
        else if (e.deltaMode === 2) delta *= window.innerHeight;

        // цель не должна убегать дальше экрана — иначе инерция тачпада
        // накапливает события и страница улетает рывком
        const limit = window.innerHeight;
        target = clamp(
          Math.min(
            Math.max(target + delta, window.scrollY - limit),
            window.scrollY + limit
          )
        );
        start();
      },
      { passive: false }
    );

    // скролл не от нас (клавиатура, полоса прокрутки, тач) — синхронизируем цель
    window.addEventListener("scroll", () => {
      if (!raf) target = window.scrollY;
    });
    window.addEventListener("resize", () => {
      target = clamp(target);
    });

    // якоря в меню ведём через ту же анимацию
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const el = document.querySelector(link.getAttribute("href"));
        if (!el) return;
        e.preventDefault();
        const bar = document.querySelector(".menu");
        const offset = bar ? bar.getBoundingClientRect().height + 24 : 80;
        const top = el.getBoundingClientRect().top + window.scrollY;
        target = clamp(link.getAttribute("href") === "#top" ? 0 : top - offset);
        start();
      });
    });
  }

  /* --- Слайдеры кейсов: стрелки листают на один слайд --- */
  document.querySelectorAll(".case--slider").forEach((slider) => {
    const track = slider.querySelector(".case__track");
    const prev = slider.querySelector(".case__arrow--prev");
    const next = slider.querySelector(".case__arrow--next");
    const fadePrev = slider.querySelector(".case__fade--prev");
    const fadeNext = slider.querySelector(".case__fade--next");
    if (!track || !next) return;

    const step = () => {
      const slide = track.querySelector(".case__slide");
      if (!slide) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return slide.getBoundingClientRect().width + gap;
    };

    const atStart = () => track.scrollLeft <= 2;
    const atEnd = () =>
      track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;

    const sync = () => {
      const scrollable = track.scrollWidth > track.clientWidth + 2;
      const showPrev = scrollable && !atStart();
      const showNext = scrollable && !atEnd();
      if (prev) prev.hidden = !showPrev;
      if (fadePrev) fadePrev.hidden = !showPrev;
      next.hidden = !showNext;
      if (fadeNext) fadeNext.hidden = !showNext;
    };

    /* Плавный переход вместо нативного: у браузера scroll-behavior: smooth
       отрабатывает рывком, поэтому ведём ленту сами с разгоном и торможением. */
    let anim = 0;

    const slideTo = (delta) => {
      cancelAnimationFrame(anim);
      const from = track.scrollLeft;
      const max = track.scrollWidth - track.clientWidth;
      const to = Math.min(Math.max(from + delta, 0), max);
      if (to === from) return;

      const duration = 620;
      const started = performance.now();
      // плавно разгоняется и плавно тормозит
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      // scroll-snap дёргает ленту к ближайшей точке прямо во время анимации —
      // отключаем на время перехода, потом возвращаем значение из CSS
      track.style.scrollSnapType = "none";

      const frame = (now) => {
        const t = Math.min((now - started) / duration, 1);
        track.scrollLeft = from + (to - from) * ease(t);
        if (t < 1) {
          anim = requestAnimationFrame(frame);
        } else {
          anim = 0;
          track.style.scrollSnapType = "";
        }
      };
      anim = requestAnimationFrame(frame);
    };

    next.addEventListener("click", () => slideTo(step()));
    if (prev) prev.addEventListener("click", () => slideTo(-step()));

    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });

  /* --- Видео играют только пока видны на экране --- */
  const videos = [...document.querySelectorAll("video")];

  /* Диагностический выключатель: ?video=off открывает страницу вообще без
     видео, на одних постерах. Нужен, чтобы за один заход отличить тормоза
     от декодирования роликов от тормозов вёрстки — если с ?video=off всё
     летает, дело в видео, если нет — в чём-то другом. */
  if (new URLSearchParams(location.search).get("video") === "off") {
    videos.forEach((video) => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
  } else if (videos.length) {
    /* Буферизация заранее. В разметке стоит preload="metadata" — браузер тянет
       только заголовок файла. Chrome сверх этого набирает ещё и часть картинки,
       поэтому play() у него стартует сразу; Safari трактует "metadata" буквально
       и на play() только начинает качать — отсюда пауза в несколько секунд перед
       первым кадром. Поэтому за 800px до появления блока переводим ролик в
       preload="auto": к моменту, когда до него дойдёт прокрутка, он уже готов.
       Ролики теперь по 0,06–1,7 МБ, так что это дёшево. */
    const warmer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const video = entry.target;
          warmer.unobserve(video);
          /* Только поднимаем preload. Вызывать тут load() нельзя: он сбрасывает
             элемент и обрывает уже начатое автовоспроизведение — из-за этого
             ролик оставался на постере. */
          if (video.preload !== "auto") video.preload = "auto";
        });
      },
      { rootMargin: "800px" }
    );

    /* Играет всё, что видно на экране. Запуск в разметке делает autoplay,
       скрипт только подстраховывает: если браузер автозапуск отменил
       (данных ещё нет), пробуем снова, а ушедшее с экрана ставим на паузу. */
    /* Когда браузер отказывается играть ролик, он рисует поверх него свою
       кнопку play — на iOS Safari её не убрать стилями надёжно. Поэтому такой
       ролик подменяем его же кадром-постером: кнопки нет, картинка та же,
       геометрия та же (класс копируем). Подменяем только по факту отказа
       play(), а не по таймауту: медленная сеть отказ не даёт, там промис
       просто висит, и видео потом доигрывается само. */
    const swapped = new Map();

    const toPoster = (video) => {
      const src = video.getAttribute("poster");
      if (!src || swapped.has(video) || !video.isConnected) return;
      const img = document.createElement("img");
      img.src = src;
      img.className = video.className;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      swapped.set(video, img);
      video.replaceWith(img);
    };

    const fromPoster = (video) => {
      const img = swapped.get(video);
      if (!img || !img.isConnected) return;
      swapped.delete(video);
      img.replaceWith(video);
    };

    const nudge = (video) => {
      if (!video.paused) return;
      const play = video.play();
      if (play) play.catch(() => toPoster(video));
    };

    const player = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) nudge(video);
          else if (!video.paused) video.pause();
        });
      },
      { rootMargin: "100px" }
    );

    const onScreen = (video) => {
      const r = video.getBoundingClientRect();
      return r.bottom > -100 && r.top < window.innerHeight + 100;
    };

    videos.forEach((video) => {
      warmer.observe(video);
      player.observe(video);
      /* Пока данных нет, play() браузер отменяет — как только ролик готов,
         пробуем ещё раз, иначе кадр так и останется стоять. */
      ["loadeddata", "canplay"].forEach((evt) =>
        video.addEventListener(evt, () => {
          if (onScreen(video)) nudge(video);
        })
      );
    });

    /* Автозапуск браузер может и запретить: Safari так делает в режиме
       энергосбережения и когда в настройках сайта выключено автовоспроизведение
       (именно в этом случае он и рисовал поверх ролика кнопку play). Разрешение
       на воспроизведение даёт любое действие пользователя, поэтому по первому
       же из них досылаем play() всем роликам на экране. Слушатели одноразовые
       и снимают себя сами, чтобы не висеть на прокрутке. */
    const gestures = ["pointerdown", "touchstart", "keydown", "wheel"];
    const kick = () => {
      gestures.forEach((evt) => window.removeEventListener(evt, kick));
      // жест снимает запрет — возвращаем подменённые ролики и пробуем снова
      [...swapped.keys()].forEach(fromPoster);
      videos.forEach((video) => {
        if (onScreen(video)) nudge(video);
      });
    };
    gestures.forEach((evt) =>
      window.addEventListener(evt, kick, { passive: true })
    );
  }

  /* --- Дизайн-лента: на узких экранах три колонки макета сводим в две --- */
  const feedGrid = document.querySelector(".feed__grid");
  if (feedGrid) {
    const cols = [...feedGrid.querySelectorAll(".feed__col")];
    const original = cols.map((col) => [...col.children]);
    const order = (el) => {
      const img = el.querySelector("img");
      const m = img && img.getAttribute("src").match(/dl-(\d+)/);
      return m ? Number(m[1]) : 0;
    };
    // сквозной порядок работ: дл-1, дл-2, дл-3 …
    const all = original.flat().sort((a, b) => order(a) - order(b));
    const designHeight = (el) => {
      const img = el.querySelector("img");
      return img ? Number(img.getAttribute("height")) || 1 : 1;
    };

    let mode = "";

    const layout = () => {
      const want = window.matchMedia("(max-width: 720px)").matches ? "two" : "three";
      if (want === mode) return;
      mode = want;

      if (want === "two") {
        // раскладываем по порядку, каждую следующую — в колонку покороче,
        // чтобы низ обеих колонок сходился
        const heights = [0, 0];
        all.forEach((item) => {
          const i = heights[0] <= heights[1] ? 0 : 1;
          heights[i] += designHeight(item);
          cols[i].appendChild(item);
        });
        if (cols[2]) cols[2].hidden = true;
      } else {
        if (cols[2]) cols[2].hidden = false;
        original.forEach((items, i) =>
          items.forEach((item) => cols[i].appendChild(item))
        );
      }
    };

    layout();
    window.addEventListener("resize", layout);
  }

  /* --- Подсветка активного пункта меню --- */
  const links = [...document.querySelectorAll(".menu__btn")];
  const navItems = links.map((link) => {
    const href = link.getAttribute("href");
    return { link, el: href === "#top" ? null : document.querySelector(href) };
  });

  if (navItems.length) {
    // высота липкой шапки — на неё смещаем и цель перехода, и порог подсветки
    const barHeight = () => {
      const bar = document.querySelector(".menu");
      return bar ? bar.getBoundingClientRect().bottom + 12 : 80;
    };

    /* Активен ровно один пункт: берём последний раздел, начало которого уже
       выше линии под шапкой. Раньше подсветка вешалась по IntersectionObserver
       и «Главная» подсвечивалась вместе с «Обо мне», потому что её цель —
       контейнер всей страницы, который пересекается всегда. */
    const updateActive = () => {
      const probe = window.scrollY + barHeight() + 1;
      let activeIndex = 0;
      navItems.forEach((item, i) => {
        if (!item.el) return;
        const rect = item.el.getBoundingClientRect();
        if (!rect.height) return; // скрытый раздел не участвует
        if (probe >= rect.top + window.scrollY) activeIndex = i;
      });
      navItems.forEach((item, i) =>
        item.link.classList.toggle("is-active", i === activeIndex)
      );
    };

    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    updateActive();

    // клик подсвечивает пункт сразу, не дожидаясь конца прокрутки
    navItems.forEach((item, i) => {
      item.link.addEventListener("click", () => {
        navItems.forEach((other, j) =>
          other.link.classList.toggle("is-active", i === j)
        );
      });
    });
  }

  /* --- Всплывающие слои: просмотр работы и сообщение о кейсе ---
     Оба ведут себя одинаково: фон уходит в цвет страницы и размывается,
     содержимое вырастает с того места, по которому кликнули. */
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const overlay = (layer, box) => {
    if (!layer || !box) return null;
    let back = null; // куда возвращаться при закрытии
    let closing = null;

    /* Считаем, где было начало, и анимируем слой от него к финальному месту. */
    const flip = (from, reverse) => {
      const to = box.getBoundingClientRect();
      if (!from.width || !to.width) return null;
      const scale = from.width / to.width;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const shifted = `translate(${dx}px, ${dy}px) scale(${scale})`;
      const frames = reverse ? [{ transform: "none" }, { transform: shifted }]
                             : [{ transform: shifted }, { transform: "none" }];
      return box.animate(frames, {
        duration: reverse ? 320 : 420,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      });
    };

    /* from — прямоугольник, из которого растём; ready — когда размеры слоя
       уже известны (картинке нужно дождаться загрузки). */
    const open = (from, focusBack, ready) => {
      if (closing) closing.cancel();
      back = focusBack || null;
      layer.hidden = false;
      // страница под слоем не должна прокручиваться
      document.body.dataset.lock = "";
      document.body.style.overflow = "hidden";

      // считываем размер, чтобы браузер зафиксировал стартовое состояние,
      // и включаем проявление сразу — не дожидаясь кадра анимации
      void layer.offsetWidth;
      layer.classList.add("is-open");

      const grow = () => requestAnimationFrame(() => smooth && flip(from(), false));
      if (ready) ready(grow);
      else grow();
    };

    const close = (rect) => {
      if (layer.hidden) return;
      layer.classList.remove("is-open");

      const finish = () => {
        layer.hidden = true;
        delete document.body.dataset.lock;
        document.body.style.overflow = "";
        if (back) back.focus({ preventScroll: true });
        back = null;
        closing = null;
        layer.dispatchEvent(new CustomEvent("overlay:closed"));
      };

      // если исходное место всё ещё на экране — уводим слой обратно к нему
      const to = rect && rect();
      const visible = to && to.width && to.bottom > 0 && to.top < window.innerHeight;
      closing = smooth && visible ? flip(to, true) : null;

      if (closing) closing.addEventListener("finish", finish);
      else setTimeout(finish, smooth ? 320 : 0);
    };

    return { layer, open, close };
  };

  /* --- Просмотр работы из дизайн-ленты --- */
  const lightbox = document.querySelector(".lightbox");
  const shot = lightbox && lightbox.querySelector(".lightbox__img");
  const viewer = overlay(lightbox, shot);
  let closeViewer = () => {};
  if (viewer) {
    let source = null;
    const sourceRect = () => (source ? source.getBoundingClientRect() : null);

    document.querySelectorAll(".feed__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const img = btn.querySelector("img");
        if (!img) return;
        source = img;
        shot.src = img.currentSrc || img.src;
        shot.alt = img.alt;
        const from = img.getBoundingClientRect();
        // размеры большой копии известны только после загрузки — до тех пор
        // ждать нельзя, иначе слой залипает невидимым
        viewer.open(() => from, btn, (grow) => {
          if (shot.complete && shot.naturalWidth) grow();
          else shot.addEventListener("load", grow, { once: true });
        });
      });
    });

    closeViewer = () => viewer.close(sourceRect);
    lightbox.addEventListener("click", closeViewer);
    lightbox.addEventListener("overlay:closed", () => {
      shot.removeAttribute("src");
      source = null;
    });
  }

  /* --- Сообщение о кейсе в работе --- */
  const modal = document.querySelector(".modal");
  const dialog = overlay(modal, modal && modal.querySelector(".modal__card"));
  let closeDialog = () => {};
  if (dialog) {
    let from = null;
    const rect = () => from;

    document.querySelectorAll(".case").forEach((card) => {
      // стрелки листают слайдер — по ним окно не открываем
      let start = null;
      card.addEventListener("pointerdown", (e) => {
        start = { x: e.clientX, y: e.clientY };
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest(".case__arrow")) return;
        // это был свайп по ленте слайдов, а не клик
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
        // карточка кейса намного больше окна, поэтому растём не из неё,
        // а из точки нажатия
        from = new DOMRect(e.clientX - 24, e.clientY - 24, 48, 48);
        dialog.open(rect, card);
      });
    });

    closeDialog = () => dialog.close(rect);
    modal.addEventListener("click", closeDialog);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeViewer();
    closeDialog();
  });

  /* --- Переключение языка --- */
  const langBtn = document.querySelector(".lang");
  if (langBtn) {
    const META = {
      ru: {
        title: "Арина Серова — графический дизайнер",
        description:
          "Портфолио Арины Серовой: брендинг, айдентика и креативные коммуникации. 5+ лет в дизайне.",
        ogDescription: "Брендинг, айдентика и креативные коммуникации.",
        label: "RU\u00a0🇷🇺",
      },
      en: {
        title: "Arina Serova — graphic designer",
        description:
          "Arina Serova's portfolio: branding, identity and creative communications. 5+ years in design.",
        ogDescription: "Branding, identity and creative communications.",
        label: "EN\u00a0🇬🇧",
      },
    };

    /* Русский текст лежит в разметке, английский — в data-атрибутах.
       При первом переключении русский вариант запоминаем рядом, чтобы
       возвращаться к нему без перезагрузки страницы. */
    const swap = (selector, dataKey, read, write) => {
      document.querySelectorAll(selector).forEach((el) => {
        const ruKey = dataKey + "Ru";
        if (el.dataset[ruKey] === undefined) el.dataset[ruKey] = read(el);
        write(el, lang === "en" ? el.dataset[dataKey] : el.dataset[ruKey]);
      });
    };

    let lang = "ru";

    const applyLang = (next) => {
      lang = next;
      document.documentElement.lang = next;

      // видимый текст
      swap("[data-en]", "en", (el) => el.innerHTML, (el, v) => (el.innerHTML = v));
      // подложка обводки рисуется из data-text
      swap("[data-text-en]", "textEn", (el) => el.dataset.text,
           (el, v) => (el.dataset.text = v));
      // подписи для скринридеров
      swap("[data-label-en]", "labelEn", (el) => el.getAttribute("aria-label"),
           (el, v) => el.setAttribute("aria-label", v));
      // альтернативный текст картинок
      swap("[data-alt-en]", "altEn", (el) => el.getAttribute("alt"),
           (el, v) => el.setAttribute("alt", v));

      const meta = META[next];
      document.title = meta.title;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", meta.description);
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", meta.title);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", meta.ogDescription);

      langBtn.textContent = meta.label;
      try {
        localStorage.setItem("lang", next);
      } catch (e) {
        /* приватный режим — просто не запоминаем выбор */
      }
    };

    // по умолчанию русский; запоминаем только явный выбор посетителя
    let saved = null;
    try {
      saved = localStorage.getItem("lang");
    } catch (e) {
      saved = null;
    }
    if (saved === "en") applyLang("en");

    langBtn.addEventListener("click", () => applyLang(lang === "en" ? "ru" : "en"));
  }
});
