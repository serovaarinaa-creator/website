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
