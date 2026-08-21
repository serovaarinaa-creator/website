document.addEventListener("DOMContentLoaded", () => {
  /* --- Мобильное меню: бургер открывает оверлей с оглавлением --- */
  const overlay = document.querySelector(".case-menu-overlay");
  const burger = document.querySelector(".case-burger");
  const closeBtn = document.querySelector(".case-menu-close");

  if (overlay && burger) {
    const open = () => {
      overlay.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      overlay.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    burger.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
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
