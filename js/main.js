"use strict";

/* Один скрипт на все страницы. Каждый блок сначала проверяет,
   что нужные элементы есть в разметке, и молча выходит, если их нет. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== Toast ===== */
function showToast(message, duration = 4500) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), duration);
}

/* ===== Тень у шапки при прокрутке ===== */
const header = $("#header");
if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* ===== Выезжающее меню ===== */
const drawer = $("#drawer");
const overlay = $("#drawer-overlay");
const openBtn = $("#menu-open");
const closeBtn = $("#menu-close");

if (drawer && overlay && openBtn) {
  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  const isOpen = () => drawer.classList.contains("is-open");

  function openDrawer() {
    if (isOpen()) return;
    lastFocused = document.activeElement;

    // Компенсируем ширину исчезающей полосы прокрутки, чтобы страница не дёргалась.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) document.body.style.paddingRight = gap + "px";

    drawer.hidden = false;
    overlay.hidden = false;
    // Перерисовка до добавления класса — иначе перехода не будет.
    void drawer.offsetWidth;
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.classList.add("is-locked");
    openBtn.setAttribute("aria-expanded", "true");

    const first = drawer.querySelector(FOCUSABLE);
    if (first) first.focus();
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    document.body.style.paddingRight = "";
    openBtn.setAttribute("aria-expanded", "false");

    const finish = () => {
      if (!isOpen()) {
        drawer.hidden = true;
        overlay.hidden = true;
      }
    };
    if (reduceMotion) finish();
    else setTimeout(finish, 420);

    if (restoreFocus && lastFocused) lastFocused.focus();
  }

  openBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", () => closeDrawer());
  overlay.addEventListener("click", () => closeDrawer());

  // Переход по ссылке внутри панели: закрываем без возврата фокуса на кнопку,
  // иначе на якорных ссылках фокус уезжает обратно в шапку.
  $$("a[href]", drawer).forEach((link) =>
    link.addEventListener("click", () => closeDrawer({ restoreFocus: false }))
  );

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // Фокус не должен уходить за пределы открытой панели.
    if (e.key === "Tab") {
      const items = $$(FOCUSABLE, drawer).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

/* ===== Маска телефона +7 (XXX) XXX-XX-XX ===== */
function maskPhone(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    let digits = input.value.replace(/\D/g, "");
    if (digits.startsWith("8")) digits = "7" + digits.slice(1);
    if (!digits.startsWith("7")) digits = "7" + digits;
    digits = digits.slice(0, 11);

    let out = "+7";
    if (digits.length > 1) out += " (" + digits.slice(1, 4);
    if (digits.length >= 4) out += ") " + digits.slice(4, 7);
    if (digits.length >= 7) out += "-" + digits.slice(7, 9);
    if (digits.length >= 9) out += "-" + digits.slice(9, 11);
    input.value = out;
  });
}

const phoneValid = (value) => value.replace(/\D/g, "").length === 11;
maskPhone($("#cf-phone"));

/* ===== Форма заявки (демо) ===== */
const form = $("#contact-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const phone = $("#cf-phone");
    const error = $("#cf-phone-error");
    if (!phoneValid(phone.value)) {
      error.textContent = "Введите телефон в формате +7 (XXX) XXX-XX-XX";
      phone.focus();
      return;
    }
    error.textContent = "";
    form.reset();
    showToast("Спасибо! Заявка принята — перезвоним в течение 15 минут (демо-режим: данные никуда не отправляются).");
  });
}

/* ===== Появление блоков при прокрутке ===== */
const reveals = $$("[data-reveal]");
const revealNow = (el) => el.classList.add("is-revealed");

if (reduceMotion || !("IntersectionObserver" in window)) {
  reveals.forEach(revealNow);
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealNow(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  reveals.forEach((el) => {
    const delay = el.dataset.revealDelay;
    if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
    observer.observe(el);
  });

  // Страховка: если наблюдатель почему-то не сработал (бывает во встроенных
  // webview), показываем всё, чтобы контент не остался скрытым.
  setTimeout(() => {
    if (!reveals.some((el) => el.classList.contains("is-revealed"))) {
      reveals.forEach(revealNow);
    }
  }, 1500);
}

/* ===== Фильтр портфолио ===== */
const grid = $("#portfolio-grid");
if (grid) {
  const buttons = $$("[data-filter-btn]");
  const cards = $$(".project", grid);
  const empty = $("#portfolio-empty");

  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      const value = btn.dataset.filterBtn;

      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });

      let shown = 0;
      cards.forEach((card) => {
        const match = value === "all" || card.dataset.filter === value;
        card.hidden = !match;
        if (match) shown++;
      });

      if (empty) empty.hidden = shown > 0;
    })
  );
}

/* ===== Калькулятор предварительной стоимости ===== */
const calcArea = $("#calc-area");
const calcType = $("#calc-type");
const calcOut = $("#calc-out");

if (calcArea && calcType && calcOut) {
  const MIN = 10;
  const MAX = 400;
  const format = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  const clamp = (n) => Math.min(MAX, Math.max(MIN, n));

  const recalc = () => {
    const raw = Number(calcArea.value);
    const rate = Number(calcType.value) || 0;
    if (!raw) {
      calcOut.textContent = "—";
      return;
    }
    calcOut.textContent = format(Math.round((clamp(raw) * rate) / 500) * 500);
  };

  calcArea.addEventListener("input", recalc);
  calcType.addEventListener("change", recalc);

  // Приводим поле к допустимому диапазону только после ввода, иначе
  // промежуточное «1» на пути к «120» превращалось бы в «10».
  calcArea.addEventListener("change", () => {
    const raw = Number(calcArea.value);
    if (raw) calcArea.value = clamp(raw);
    recalc();
  });

  recalc();
}

/* ===== Сборка комнаты при прокрутке (только главная) ===== */
const assembly = $("#assembly");
if (assembly) {
  const frames = $$(".assembly__frame", assembly);
  const caption = $("#assembly-caption");
  const dotsWrap = $("#assembly-dots");

  frames.forEach(() => dotsWrap.appendChild(document.createElement("span")));
  const dots = $$("span", dotsWrap);

  if (reduceMotion) {
    assembly.classList.add("assembly--static");
    caption.textContent = frames[frames.length - 1].alt;
    dots.forEach((d, i) => d.classList.toggle("is-active", i === dots.length - 1));
  } else {
    const update = () => {
      const track = assembly.offsetHeight - window.innerHeight;
      if (track <= 0) return;
      const progress = Math.min(1, Math.max(0, -assembly.getBoundingClientRect().top / track));
      const pos = progress * (frames.length - 1);

      // Кадр i проявляется поверх предыдущего на своём отрезке трека
      frames.forEach((frame, i) => {
        frame.style.opacity = i === 0 ? 1 : Math.min(1, Math.max(0, pos - (i - 1)));
      });

      const idx = Math.min(frames.length - 1, Math.round(pos));
      if (caption.textContent !== frames[idx].alt) caption.textContent = frames[idx].alt;
      dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }
}
