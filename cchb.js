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
