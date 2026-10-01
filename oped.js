document.addEventListener("DOMContentLoaded", () => {
  /* --- Мобильное меню: бургер открывает оверлей с оглавлением --- */
  const overlay = document.querySelector(".case-menu-overlay");
  const burger = document.querySelector(".case-burger");

  if (overlay && burger) {
    // Отдельной кнопки закрытия в макете нет — сам бургер переключается
    // в крестик (см. .case-burger__icon-open/__icon-close в cchb.css) и
    // повторный клик закрывает меню.
    const open = () => {
      overlay.classList.add("is-open");
      burger.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Закрыть меню");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      overlay.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Открыть меню");
      document.body.style.overflow = "";
    };

    burger.addEventListener("click", () => {
      if (overlay.classList.contains("is-open")) close();
      else open();
    });
    // клик по пункту оглавления в меню — закрываем оверлей, скролл уже
    // отработает общий обработчик a[href^="#"] из script.js
    overlay.querySelectorAll(".case-menu-overlay__toc a").forEach((link) => {
      link.addEventListener("click", close);
    });
  }

  /* --- «Следующий кейс» — если у него уже есть страница (data-href, тот же
     приём, что и у карточек на главной), просто переходим по ссылке;
     иначе — та же заглушка «в процессе разработки», что и на главной.
     Существует только на десктопе (.case-next лежит в .case-sidebar,
     скрытом на мобилке), поэтому без медиа-запросов в JS. */
  const caseModal = document.querySelector("#case-modal");
  if (caseModal) {
    const openModal = () => {
      caseModal.hidden = false;
      document.body.style.overflow = "hidden";
      // читаем layout, чтобы браузер зафиксировал стартовое состояние
      // до включения перехода — иначе первое открытие проскакивает без анимации
      void caseModal.offsetWidth;
      caseModal.classList.add("is-open");
    };
    const closeModal = () => {
      if (caseModal.hidden) return;
      caseModal.classList.remove("is-open");
      document.body.style.overflow = "";
      caseModal.addEventListener("transitionend", () => { caseModal.hidden = true; }, { once: true });
    };
    document.querySelectorAll(".case-next").forEach((link) => {
      link.addEventListener("click", (e) => {
        if (link.dataset.href) return;
        e.preventDefault();
        openModal();
      });
    });
    caseModal.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  /* --- Подсветка текущего раздела в оглавлении (сайдбар + мобильное меню) ---
     IntersectionObserver вместо scroll-обработчика — тот же приём, что уже
     используется для дизайн-ленты и лайтбокса в script.js: дешевле для
     Safari на макбуке, не считает позиции на каждом кадре прокрутки. */
  const sections = Array.from(document.querySelectorAll(".case-content [id]"));
  const tocLinks = Array.from(document.querySelectorAll(".case-toc a, .case-menu-overlay__toc a"));
  if (sections.length && tocLinks.length) {
    const setActive = (id) => {
      tocLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
      });
    };

    const visible = new Set();
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        // берём самый верхний из ещё видимых разделов
        const top = sections.find((s) => visible.has(s.id));
        if (top) setActive(top.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }
});

/* --- Просмотр изображений: клик по картинке открывает её крупно ---
   Тот же приём, что у дизайн-ленты на главной (script.js): фон уходит в
   цвет страницы и размывается (здесь — белый, как фон кейса), картинка
   вырастает с того места, по которому кликнули, стрелки листают
   соседние изображения кейса, закрыть — клик по фону или Escape.
   Своя реализация, а не общая из script.js: там слой привязан к ленте
   (.feed__btn, нумерация dl-N) и не отдаётся наружу. */
document.addEventListener("DOMContentLoaded", () => {
  const layer = document.querySelector(".case-lightbox");
  if (!layer) return;
  const shot = layer.querySelector(".lightbox__img");
  const prevBtn = layer.querySelector(".lightbox__arrow--prev");
  const nextBtn = layer.querySelector(".lightbox__arrow--next");

  // все изображения кейса, кроме панели «Лого» (там текст поверх картинки)
  const items = Array.from(
    document.querySelectorAll(".case-hero__media img, .case-media:not(.case-media--fill) img")
  );
  if (!items.length) return;

  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = -1;
  let back = null;
  let closing = null;

  const flip = (from, reverse) => {
    const to = shot.getBoundingClientRect();
    if (!from.width || !to.width) return null;
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const shifted = `translate(${dx}px, ${dy}px) scale(${scale})`;
    const frames = reverse
      ? [{ transform: "none" }, { transform: shifted }]
      : [{ transform: shifted }, { transform: "none" }];
    return shot.animate(frames, {
      duration: reverse ? 320 : 420,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
  };

  const sourceRect = () => (index >= 0 ? items[index].getBoundingClientRect() : null);

  // переключает картинку в открытом слое — без повторной анимации роста
  const show = (i) => {
    index = i;
    const img = items[index];
    shot.src = img.currentSrc || img.src;
    shot.alt = img.alt;
    prevBtn.hidden = index <= 0;
    nextBtn.hidden = index >= items.length - 1;
  };

  const open = (i) => {
    if (closing) closing.cancel();
    back = items[i];
    const from = items[i].getBoundingClientRect();
    show(i);
    layer.hidden = false;
    document.body.dataset.lock = "";
    document.body.style.overflow = "hidden";
    void layer.offsetWidth;
    layer.classList.add("is-open");
    const grow = () => requestAnimationFrame(() => smooth && flip(from, false));
    if (shot.complete && shot.naturalWidth) grow();
    else shot.addEventListener("load", grow, { once: true });
  };

  const close = () => {
    if (layer.hidden) return;
    layer.classList.remove("is-open");
    const finish = () => {
      layer.hidden = true;
      delete document.body.dataset.lock;
      document.body.style.overflow = "";
      shot.removeAttribute("src");
      if (back) back.focus({ preventScroll: true });
      back = null;
      index = -1;
      closing = null;
    };
    const to = sourceRect();
    const visible = to && to.width && to.bottom > 0 && to.top < window.innerHeight;
    closing = smooth && visible ? flip(to, true) : null;
    if (closing) closing.addEventListener("finish", finish);
    else setTimeout(finish, smooth ? 320 : 0);
  };

  items.forEach((img, i) => {
    img.classList.add("is-zoomable");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.addEventListener("click", () => open(i));
    img.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(i);
      }
    });
  });

  const step = (delta) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    show(next);
    back = items[next];
  };
  // stopPropagation — иначе клик по стрелке всплывает и закрывает слой
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); step(1); });
  layer.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (layer.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });
});
