/* Просмотр изображений в мобильной версии кейсов (Neuro Camp, ЦЧБ, Digital art).
   Тот же приём, что в oped.js / doggymoggy.js: клик по картинке — фон уходит
   в цвет страницы и размывается, картинка вырастает с того места, по которому
   кликнули, стрелки листают соседние изображения, закрыть — клик по фону или
   Escape. Слой создаётся скриптом, цвет фона берётся из фона страницы кейса.
   На десктопе ничего не делает. */
document.addEventListener("DOMContentLoaded", () => {
  const mobile = window.matchMedia("(max-width: 1080px)");
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // панель «Лого» (текст поверх картинок), декоративные пиксели и подвал не листаем
  const SELECTOR = ".case-content img:not([aria-hidden])";
  const SKIP = ".case-hero__media, .case-collage__pixel, .case-logo-panel, .case-next, .case-media--fill, .case-sidebar, .footer";
  const all = Array.from(document.querySelectorAll(SELECTOR)).filter((img) => !img.closest(SKIP));
  if (!all.length) return;

  const layer = document.createElement("div");
  layer.className = "case-lightbox";
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", "Просмотр изображения");
  layer.hidden = true;
  layer.innerHTML =
    '<button class="lightbox__arrow lightbox__arrow--prev" type="button" aria-label="Предыдущее изображение"><img src="assets/icons/chevron-left.svg" alt="" width="20" height="20"></button>' +
    '<img class="lightbox__img" src="" alt="">' +
    '<button class="lightbox__arrow lightbox__arrow--next" type="button" aria-label="Следующее изображение"><img src="assets/icons/chevron-right.svg" alt="" width="20" height="20"></button>';
  document.body.appendChild(layer);

  const shot = layer.querySelector(".lightbox__img");
  const prevBtn = layer.querySelector(".lightbox__arrow--prev");
  const nextBtn = layer.querySelector(".lightbox__arrow--next");

  // фон слоя — цвет страницы кейса с прозрачностью
  const tint = () => {
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || [0, 0, 0];
    layer.style.background = `rgba(${m[0]}, ${m[1]}, ${m[2]}, 0.72)`;
  };

  let items = [];
  let index = -1;
  let back = null;
  let closing = null;

  // на мобильном часть картинок скрыта (десктопные варианты) — берём только видимые
  const visibleItems = () => all.filter((img) => img.getBoundingClientRect().width > 0);

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

  const show = (i) => {
    index = i;
    const img = items[index];
    shot.src = img.currentSrc || img.src;
    shot.alt = img.alt;
    prevBtn.hidden = index <= 0;
    nextBtn.hidden = index >= items.length - 1;
  };

  const open = (img) => {
    if (!mobile.matches) return;
    if (closing) closing.cancel();
    items = visibleItems();
    const i = items.indexOf(img);
    if (i < 0) return;
    tint();
    back = img;
    const from = img.getBoundingClientRect();
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
      back = null;
      index = -1;
      closing = null;
    };
    const to = index >= 0 ? items[index].getBoundingClientRect() : null;
    const onScreen = to && to.width && to.bottom > 0 && to.top < window.innerHeight;
    closing = smooth && onScreen ? flip(to, true) : null;
    if (closing) closing.addEventListener("finish", finish);
    else setTimeout(finish, smooth ? 320 : 0);
  };

  all.forEach((img) => {
    img.classList.add("is-zoomable");
    img.addEventListener("click", () => open(img));
  });

  const step = (delta) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    show(next);
    back = items[next];
  };
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); step(1); });
  layer.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (layer.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });
  // повернули телефон / растянули окно до десктопа — слой закрываем
  mobile.addEventListener("change", () => { if (!mobile.matches) close(); });
});
