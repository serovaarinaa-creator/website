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
  if (videos.length) {
    const player = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            const play = video.play();
            if (play) play.catch(() => {});
          } else if (!video.paused) {
            video.pause();
          }
        });
      },
      { rootMargin: "100px" }
    );
    videos.forEach((video) => player.observe(video));
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
