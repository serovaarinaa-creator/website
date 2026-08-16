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
        target = clamp(el.getBoundingClientRect().top + window.scrollY);
        start();
      });
    });
  }

  /* --- Слайдеры кейсов: стрелка листает на один слайд --- */
  document.querySelectorAll(".case--slider").forEach((slider) => {
    const track = slider.querySelector(".case__track");
    const arrow = slider.querySelector(".case__arrow");
    if (!track || !arrow) return;

    const step = () => {
      const slide = track.querySelector(".case__slide");
      if (!slide) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return slide.getBoundingClientRect().width + gap;
    };

    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;

    arrow.addEventListener("click", () => {
      if (atEnd()) {
        track.scrollTo({ left: 0 });
      } else {
        track.scrollBy({ left: step() });
      }
    });

    const syncArrow = () => {
      arrow.style.opacity = track.scrollWidth > track.clientWidth + 2 ? "1" : "0";
    };
    syncArrow();
    window.addEventListener("resize", syncArrow);
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

  /* --- Подсветка активного пункта меню при скролле --- */
  const links = [...document.querySelectorAll(".menu__btn")];
  const targets = links
    .map((link) => {
      const id = link.getAttribute("href");
      return id && id.startsWith("#") ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if (targets.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) =>
            link.classList.toggle(
              "is-active",
              link.getAttribute("href") === "#" + entry.target.id
            )
          );
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    targets.forEach((target) => observer.observe(target));
  }

  /* --- Переключатель языка: заглушка до появления английской версии --- */
  const lang = document.querySelector(".lang");
  if (lang) {
    lang.addEventListener("click", () => {
      lang.textContent = lang.textContent.trim().startsWith("RU")
        ? "EN 🇬🇧"
        : "RU 🇷🇺";
    });
  }
});
