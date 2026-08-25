/* Если открыли сайт по ссылке с #top в конце — сам клик по кнопке «домой»
   в меню этот хэш в адресную строку никогда не пишет (там preventDefault,
   см. обработчик ниже), но ссылку с ним могли сохранить или расшарить
   где-то отдельно. Молча убираем хэш из адресной строки: на позицию это
   не влияет, id="top" и так стоит в самом начале страницы. */
if (location.hash === "#top") {
  history.replaceState(null, "", location.pathname + location.search);
}

document.addEventListener("DOMContentLoaded", () => {
  /* --- Прокрутка --- */
  /* Раньше здесь колесо перехватывалось вручную: не-passive обработчик wheel
     с preventDefault() и window.scrollTo() в каждом кадре requestAnimationFrame.
     В Safari на макбуке это самая дорогая конструкция на странице: обычная
     прокрутка там идёт мимо основного потока, а preventDefault() на wheel
     принудительно возвращает её в основной поток и отключает асинхронный
     скролл целиком. Тачпад шлёт события инерции сотнями в секунду, и каждое
     тянуло за собой пересчёт вёрстки, размытие стеклянных чипов и пересборку
     всех видеослоёв — отсюда лаги, которых нет ни на айфоне (там указатель
     не fine, ветка не включалась), ни в других браузерах. Прокрутку отдаём
     системе: у macOS своя инерция, и она бесплатная. */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Сглаживания колеса здесь больше нет, и возвращать его не стоит.

     Пробовали дважды. Замысел был такой: перехватывать только мышь, а тачпад
     оставлять системе — у него инерция своя, от macOS, мимо основного потока
     и бесплатная. Но надёжно отличить одно устройство от другого не выходит.
     Safari нормализует оба в одинаковые пиксельные дельты (wheelDeltaY у обоих
     это просто deltaY*3), и остаётся гадать по рисунку потока событий.

     Гадание ошибается, а цена ошибки несимметрична: непассивный обработчик
     wheel с preventDefault() возвращает прокрутку в основной поток и выключает
     асинхронный скролл целиком. То есть один неверный вердикт возвращает ровно
     те тормоза, ради которых всё и затевалось. Проверено на живом Safari —
     лаги вернулись.

     Плавность колеса мыши того не стоит. Прокрутку целиком ведёт система. */

  /* Якоря в меню ведём нативным плавным скроллом — он не занимает основной
     поток и работает только на время самого перехода. */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const el = document.querySelector(link.getAttribute("href"));
      if (!el) return;
      e.preventDefault();
      const bar = document.querySelector(".menu");
      const offset = bar ? bar.getBoundingClientRect().height + 24 : 80;
      const top =
        link.getAttribute("href") === "#top"
          ? 0
          : el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({
        top: Math.max(top, 0),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  });

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
       первым кадром. Поэтому за 600px до появления блока переводим ролик в
       preload="auto": к моменту, когда до него дойдёт прокрутка, он уже готов.

       Одновременное декодирование ограничивает не этот запас, а пауза ниже:
       всё, до чего ещё не долистали, гасится сразу при загрузке страницы,
       не дожидаясь первого колбэка наблюдателя. Пробовали вместо этого
       выключить autoplay и поставить preload="none" — по замерам браузер
       переставал трогать шесть файлов из восьми, но в Safari на макбуке
       ролики после этого не запускались вообще. Разметку вернули к рабочей,
       ограничение оставили на паузе. */
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
      { rootMargin: "600px" }
    );

    /* Играет всё, что видно на экране. Запуск в разметке делает autoplay,
       скрипт только подстраховывает: если браузер автозапуск отменил
       (данных ещё нет), пробуем снова, а ушедшее с экрана ставим на паузу.
       Скриптовый play() Safari отрабатывает заметно хуже разметочного
       autoplay, поэтому запуск оставлен браузеру. */
    /* iOS Safari поверх ролика, который не смог запуститься, рисует свою
       кнопку play — причём даже без атрибута controls и без единого тапа
       пользователя: сам факт того, что видео стоит на паузе, а не играет,
       уже включает эту кнопку. Щит выше не помогает, потому что кнопка не
       реакция на тап — это индикатор состояния. Единственный надёжный способ
       её убрать — не держать на экране паузнутое видео вообще: при любом
       отказе play() подменяем ролик его же кадром-постером. У картинки
       кнопки нет по построению. Подменяем именно по факту отказа promise,
       а не по таймауту: если дело в медленной сети, промис не отклоняется,
       а просто ждёт данные, и ролик потом доигрывается сам — эта ветка
       ничего не подменяет. */
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

    /* Скриптовый запуск — запасной путь, не основной. Отказ виден по промису,
       и только настоящий запрет автозапуска (NotAllowedError) подменяет ролик
       постером — ради этого вся ветка и написана.

       Раньше подменялся любой отказ, и это выходило боком: play() ждёт данные,
       ролик за это время уходит с экрана, наш же pause() рвёт промис с
       AbortError — и ролик навсегда оставался картинкой, хотя браузер ничего
       не запрещал. Ошибки загрузки тоже лечит следующий canplay, а не подмена.
       Пока данных нет, на месте видео и так стоит кадр из атрибута poster. */
    /* err.name === "NotAllowedError" раньше был единственным поводом для
       подмены — уже, чем нужно. AbortError (наш же pause() оборвал ещё не
       решившийся промис) по-прежнему пропускаем: тут браузер ничего не
       запрещал. А вот остальные отказы (например NotSupportedError или
       ошибка декодера) тоже должны уходить в постер — иначе ролик
       остаётся в DOM на паузе, и Safari рисует поверх него свою кнопку
       play, хотя мы её как раз пытаемся не допустить. */
    const scriptedPlay = (video) => {
      const play = video.play();
      if (!play) return;
      play.catch((err) => {
        if (err && err.name !== "AbortError") toPoster(video);
      });
    };

    /* Запуск отдаём браузеру, а не play().

       Safari на macOS рисует поверх ролика, запущенного скриптом без участия
       человека, свою круглую кнопку паузы — чтобы человек мог его остановить.
       Стилями она не убирается: правило в таблице браузера помечено
       !important, а такое авторский CSS не перебивает. Над роликом, который
       завёл разметочный autoplay, кнопки нет — проверено на старой версии
       сайта, где скрипт в запуск не вмешивался.

       Поэтому вместо play() зовём load(): по стандарту он возвращает элементу
       флаг автозапуска, и дальше ролик заводит сам браузер — тем же путём, что
       и при первой загрузке страницы. Ролик начинается с первого кадра, что
       для коротких петель даже уместнее.

       Про запас: pause() этот флаг гасит, поэтому одно только снятие паузы
       ролик бы не вернуло — нужен именно load(). */
    const retries = new Map();

    const nudge = (video) => {
      if (!video.paused) return;

      if (!video.hasAttribute("autoplay")) {
        scriptedPlay(video);
        return;
      }

      video.load();

      /* Если автозапуск запрещён (Safari так делает в энергосбережении и когда
         он выключен в настройках сайта), браузер ролик не заведёт и никак об
         этом не сообщит — промиса тут нет. Поэтому один раз проверяем следом
         и уже тогда пробуем скриптом: там отказ виден и ролик уходит в постер.
         Проверка одна и по таймеру, так что зациклиться не на чем. */
      clearTimeout(retries.get(video));
      retries.set(
        video,
        setTimeout(() => {
          retries.delete(video);
          if (!(video.paused && onScreen(video))) return;
          scriptedPlay(video);

          /* Перегрузка аппаратных декодеров (несколько тяжёлых роликов
             разом) может застопорить play() вообще без отказа промиса —
             ролик просто бесконечно стоит на паузе, ничего не бросая в
             catch выше. Раз уж свой шанс он получил и не воспользовался —
             подстраховка: если через ещё немного времени всё так же на
             паузе, подменяем постером тем же путём, что и явный отказ. */
          clearTimeout(retries.get(video));
          retries.set(
            video,
            setTimeout(() => {
              retries.delete(video);
              if (video.paused && onScreen(video)) toPoster(video);
            }, 1500)
          );
        }, 1500)
      );
    };

    const player = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) nudge(video);
          /* Тоже безусловно: у ролика, который ещё не начал играть, это
             снимает флаг автозапуска, чтобы он не завёлся сам за экраном.
             Заодно снимаем отложенную проверку — ролика на экране уже нет. */
          else {
            clearTimeout(retries.get(video));
            retries.delete(video);
            video.pause();
          }
        });
      },
      /* Ровно по краю экрана (rootMargin: 0) ставить нельзя: ролик на границе
         начинает дёргаться play/pause от малейшего движения прокрутки, а
         каждая пауза обрывает ещё не набравший данные play(). Небольшой
         запас даёт ролику досчитаться до первого кадра. */
      { rootMargin: "100px" }
    );

    const onScreen = (video) => {
      const r = video.getBoundingClientRect();
      return r.bottom > -100 && r.top < window.innerHeight + 100;
    };

    videos.forEach((video) => {
      warmer.observe(video);
      player.observe(video);
      /* Раньше тут на loadeddata/canplay досылался повторный запуск: пока
         данных нет, play() браузер отменяет. Теперь запуск делает load(), а он
         сам порождает эти же события — получилась бы бесконечная петля
         load → canplay → load. Да и повторять нечего: ролик с autoplay в
         разметке браузер заводит сам, как только наберёт данные. На случай,
         когда автозапуск запрещён, в nudge() есть разовая проверка по таймеру. */
    });

    /* IntersectionObserver сообщает о видимости не мгновенно, а первым
       колбэком чуть погодя — на практике это иногда означало, что видео,
       видное сразу при открытии страницы, вообще ни разу не пробовало
       запуститься: ни разметочный autoplay, ни наш нюдж не срабатывали,
       хотя ролик был полностью догружен и play() из консоли включал его
       мгновенно. Поэтому сразу же, не дожидаясь колбэка, проверяем
       геометрию напрямую и досылаем play() всему, что уже на экране. */
    videos.forEach((video) => {
      if (onScreen(video)) nudge(video);
      /* А всё, до чего ещё не долистали, наоборот — гасим сразу, не дожидаясь
         первого колбэка IntersectionObserver. Это и есть ограничитель на
         одновременное декодирование: в разметке у восьми роликов стоит
         autoplay, и без этой строчки Safari при открытии страницы заводит
         их все разом. Аппаратных декодеров на процесс конечное число, лишние
         уходят в программное декодирование — это и есть тормоза, а на машине
         послабее play() просто отказывает. Скрипт подключён в конце body и
         успевает отработать до того, как подъедут данные, так что гасить
         почти нечего: снимается флаг автозапуска, и ролик стартует уже от
         наблюдателя, когда до него дойдёт прокрутка.

         pause() зовётся безусловно, а не только у уже играющего ролика.
         Это принципиально: на момент DOMContentLoaded ни один ролик ещё не
         играет — данные не подъехали, — поэтому проверка «if (!paused)» не
         срабатывала ни разу, и все восемь спокойно заводились секундой позже.
         А pause() у стоящего ролика гасит его флаг автозапуска навсегда,
         что нам и нужно. */
      else video.pause();
    });

    /* Автозапуск браузер может и запретить: Safari так делает в режиме
       энергосбережения и когда в настройках сайта выключено автовоспроизведение.
       Оба запрета — это выбор пользователя в системных настройках, снять их
       кодом нельзя; но обычный жест снимает более мягкий вариант запрета
       («до первого взаимодействия»), поэтому по первому же действию
       пользователя пробуем вернуть все подменённые ролики и запустить их
       заново. Если запрет жёсткий, play() откажет опять и toPoster()
       подменит их обратно — без кнопки, просто статичный кадр. */
    const gestures = ["pointerdown", "touchstart", "keydown", "wheel"];
    const kick = () => {
      gestures.forEach((evt) => window.removeEventListener(evt, kick));
      [...swapped.keys()].forEach(fromPoster);
      videos.forEach((video) => {
        if (onScreen(video)) nudge(video);
      });
    };
    gestures.forEach((evt) =>
      window.addEventListener(evt, kick, { passive: true })
    );

    /* Вкладку увели — декодировать нечего и незачем. Safari сам приглушает
       фоновые вкладки не всегда (в отдельном окне рядом с активным — нет),
       а девять ждущих роликов продолжают греть процессор и мешать соседним
       вкладкам. Возвращаемся — запускаем обратно то, что видно. */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        videos.forEach((video) => {
          if (!video.paused) video.pause();
        });
      } else {
        videos.forEach((video) => {
          if (onScreen(video)) nudge(video);
        });
      }
    });
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
    /* Геометрия разделов меняется только от перевёрстки, а не от прокрутки,
       поэтому меряем её отдельно и кладём в кэш. Раньше updateActive дёргала
       getBoundingClientRect() у каждого раздела на каждое событие scroll —
       это принудительный пересчёт вёрстки по нескольку раз за кадр, и в
       Safari он ложился ровно поверх прокрутки. */
    let tops = [];
    let bar = 80;
    let stale = true;

    const measure = () => {
      stale = false;
      bar = barHeight();
      tops = navItems.map((item) => {
        if (!item.el) return null;
        const rect = item.el.getBoundingClientRect();
        return rect.height ? rect.top + window.scrollY : null; // скрытый раздел не участвует
      });
    };

    /* Границы разделов не постоянны: картинки в ленте грузятся лениво, и пока
       они подъезжают, всё, что ниже, съезжает вниз. Ловим это по высоте body —
       любое такое смещение её меняет — и помечаем кэш устаревшим. Пересчёт
       случится один раз в следующем кадре, а не на каждое событие scroll. */
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        stale = true;
      }).observe(document.body);
    }

    let active = -1;

    const paint = () => {
      const probe = window.scrollY + bar + 1;
      let activeIndex = 0;
      tops.forEach((top, i) => {
        if (top !== null && probe >= top) activeIndex = i;
      });
      if (activeIndex === active) return; // класс не трогаем, если ничего не изменилось
      active = activeIndex;
      navItems.forEach((item, i) =>
        item.link.classList.toggle("is-active", i === activeIndex)
      );
    };

    /* На кадр — одна проверка: событий scroll браузер шлёт заметно больше,
       чем успевает отрисовать кадров. */
    let queued = 0;
    const onScroll = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        if (stale) measure();
        paint();
      });
    };

    const updateActive = () => {
      measure();
      paint();
    };

    /* Без ResizeObserver кэш обновлять некому — тогда меряем каждый кадр
       прокрутки. Всё равно это на порядок реже, чем событий scroll. */
    if (!window.ResizeObserver) {
      window.addEventListener("scroll", () => {
        stale = true;
      }, { passive: true });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateActive);
    window.addEventListener("load", updateActive);
    updateActive();

    // клик подсвечивает пункт сразу, не дожидаясь конца прокрутки
    navItems.forEach((item, i) => {
      item.link.addEventListener("click", () => {
        active = i; // иначе paint() решит, что подсвечивать нечего, и класс залипнет
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
  const prevWork = lightbox && lightbox.querySelector(".lightbox__arrow--prev");
  const nextWork = lightbox && lightbox.querySelector(".lightbox__arrow--next");
  const viewer = overlay(lightbox, shot);
  let closeViewer = () => {};
  if (viewer) {
    /* Листаем по номеру файла (dl-1, dl-2, ...), а не по порядку в DOM —
       плитки разложены по трём колонкам под масонри-раскладку, и колонка
       содержит только каждый третий номер. */
    const items = Array.from(document.querySelectorAll(".feed__btn")).sort((a, b) => {
      const numOf = (btn) => parseInt(btn.querySelector("img").src.match(/dl-(\d+)\./)[1], 10);
      return numOf(a) - numOf(b);
    });

    let index = -1;
    const sourceRect = () =>
      index >= 0 ? items[index].querySelector("img").getBoundingClientRect() : null;

    // переключает картинку в уже открытом слое — без повторной анимации роста
    const show = (i) => {
      index = i;
      const img = items[index].querySelector("img");
      shot.src = img.currentSrc || img.src;
      shot.alt = img.alt;
      if (prevWork) prevWork.hidden = index <= 0;
      if (nextWork) nextWork.hidden = index >= items.length - 1;
    };

    items.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        const img = btn.querySelector("img");
        if (!img) return;
        const from = img.getBoundingClientRect();
        show(i);
        // размеры большой копии известны только после загрузки — до тех пор
        // ждать нельзя, иначе слой залипает невидимым
        viewer.open(() => from, btn, (grow) => {
          if (shot.complete && shot.naturalWidth) grow();
          else shot.addEventListener("load", grow, { once: true });
        });
      });
    });

    const step = (delta) => {
      const next = index + delta;
      if (next < 0 || next >= items.length) return;
      show(next);
    };
    // stopPropagation — иначе клик по стрелке всплывает и закрывает слой
    // (клик по самому лайтбоксу его закрывает, см. ниже)
    if (prevWork) prevWork.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
    if (nextWork) nextWork.addEventListener("click", (e) => { e.stopPropagation(); step(1); });

    closeViewer = () => viewer.close(sourceRect);
    lightbox.addEventListener("click", closeViewer);
    lightbox.addEventListener("overlay:closed", () => {
      shot.removeAttribute("src");
      index = -1;
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
        // у готовых кейсов есть настоящая страница — открываем её вместо
        // заглушки "в процессе разработки"
        if (card.dataset.href) {
          location.href = card.dataset.href;
          return;
        }
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

  /* --- Переключение языка ---
     querySelectorAll, а не querySelector: на странице кейса кнопка встречается
     дважды (постоянная в углу на десктопе и внутри мобильного меню) — обе
     должны одинаково переключаться и показывать один и тот же язык. */
  const langBtns = document.querySelectorAll(".lang");
  if (langBtns.length) {
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

      langBtns.forEach((btn) => (btn.textContent = meta.label));
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

    /* Переключение языка похоже на перезагрузку страницы: розовая шторка
       наезжает сверху донизу, текст меняется, пока экран полностью закрыт,
       и шторка тем же движением уезжает дальше вверх. При
       prefers-reduced-motion шторка скрыта в CSS — просто меняем язык. */
    const transitionLayer = document.querySelector(".lang-transition");
    let switching = false;

    const switchLang = (next) => {
      if (switching) return;
      if (!transitionLayer || reduceMotion) {
        applyLang(next);
        return;
      }
      switching = true;
      transitionLayer.classList.add("is-covering");

      const onCovered = (e) => {
        if (e.target !== transitionLayer || e.propertyName !== "transform") return;
        transitionLayer.removeEventListener("transitionend", onCovered);
        applyLang(next);
        transitionLayer.classList.remove("is-covering");
        transitionLayer.classList.add("is-revealing");
        transitionLayer.addEventListener("transitionend", onRevealed);
      };

      const onRevealed = (e) => {
        if (e.target !== transitionLayer || e.propertyName !== "transform") return;
        transitionLayer.removeEventListener("transitionend", onRevealed);
        transitionLayer.classList.remove("is-revealing");
        switching = false;
      };

      transitionLayer.addEventListener("transitionend", onCovered);
    };

    langBtns.forEach((btn) =>
      btn.addEventListener("click", () => switchLang(lang === "en" ? "ru" : "en"))
    );
  }
});
