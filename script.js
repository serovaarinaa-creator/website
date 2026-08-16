document.addEventListener("DOMContentLoaded", () => {
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
