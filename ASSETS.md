# Ассеты

Все материалы из Figma уже в репозитории. Имена приведены к латинице: с кириллицей и
пробелами в путях бывают проблемы при отдаче файлов с хостинга, поэтому файлы переименованы,
а вёрстка ссылается на новые пути.

## Структура

```
assets/
  avatar.png              фото профиля (376×376, используется и в сайдбаре, и в футере)
  footer-bg.png           фон футера (2664×1336)
  logos/                  логотипы проектов, 128×128 PNG
    restore.png  restore-black.png  scholotch.png
    oped.png  xiaomi.png  masterskaya.png  doggymoggy.png
  icons/                  home.svg, chevron-right.svg, chevron-left.svg, menu.png, favicon.png
  cases/
    cchb-fon.png  cchb-video.mp4  cchb-1…3.png            Цветное vs. Чёрно-белое
    neurocamp-bg.png  neurocamp-video.mp4                 NEURO CAMP
    digitalart-fon.png  digitalart-video.mp4  digitalart-1…3.png
    oped-video.mp4                                        OP:ED
    rumikom-fon.png  rumikom-1…4.png                      Румиком
    masterskaya-video.mp4                                 Мастерская дизайн-практик
    doggymoggy-video.mp4                                  DoggyMoggy
  about/
    about-bg-1.png  about-bg-2.png  about-photo.png
    about-video.mp4  medor-video.mp4
  feed/
    dl-1.png … dl-62.png                                  дизайн-лента
```

## Видео

Восемь роликов суммарно весят около 86 МБ, поэтому они не грузятся все сразу:

- `preload="metadata"` — браузер тянет только заголовок файла и показывает первый кадр;
- скрипт запускает воспроизведение, когда блок попадает в экран, и ставит на паузу, когда уходит.

Если захотите ускорить загрузку ещё сильнее — стоит пережать ролики в 1080p H.264
(например, `ffmpeg -i in.mp4 -vf scale=-2:1080 -crf 26 -an out.mp4`) и добавить `.webm`.
Звук в роликах не нужен: они играют без него.

## Ссылки

Кнопки в сайдбаре и футере ведут на:

| Кнопка | Адрес |
|---|---|
| CV | https://hirehi.ru/resume/XbLth3skez |
| LinkedIn | https://www.linkedin.com/in/arina-serova-61530b253/ |
| Behance | https://www.behance.net/greisolar |
| Telegram | https://t.me/greisolar |

Все открываются в новой вкладке с `rel="noopener"`.

## Языки

Страница двуязычная и одна: русский текст лежит в разметке, английский —
в атрибутах `data-en` (у заголовков с обводкой ещё `data-text-en`, у кнопок
`data-label-en`, у картинок `data-alt-en`). Кнопка в правом верхнем углу
переключает язык на месте, без перезагрузки, и запоминает выбор в `localStorage`.
По умолчанию открывается русская версия.

Тексты правятся в генераторе — там русский и английский идут парой, поэтому
не разъезжаются.
