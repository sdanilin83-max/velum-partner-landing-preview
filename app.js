"use strict";

const VELUM_CONFIG = Object.freeze({
  leadEndpoint: "",
});

const LEAD_SOURCE_KEY = "velum:leadSource";
const DIRECT_LEAD_SOURCE = Object.freeze({
  section_id: "direct",
  section_name: "Прямий перехід",
  cta_name: "direct",
});

const SOURCE_NAMES = Object.freeze({
  global_header: "Головна навігація",
  mobile_menu: "Мобільне меню",
  section_01_hero: "Головний екран",
  section_02_training: "Навчання монтажу",
  section_03_earnings: "Скільки можна заробити",
  section_04_audience: "Для кого",
  section_05_benefits: "Чому це вигідно",
  section_06_support: "Підтримка VELUM",
  section_07_video: "Відеовідгук",
  section_08_first_order: "Перше замовлення",
  footer: "Футер",
});

let memoryLeadSource = null;

function saveLeadSource(source) {
  memoryLeadSource = source;
  try {
    window.sessionStorage.setItem(LEAD_SOURCE_KEY, JSON.stringify(source));
  } catch {
    // The in-memory copy keeps attribution when storage is unavailable.
  }
}

function getLeadSource() {
  if (memoryLeadSource) return memoryLeadSource;

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(LEAD_SOURCE_KEY) || "null");
    if (
      stored &&
      typeof stored.section_id === "string" &&
      typeof stored.section_name === "string" &&
      typeof stored.cta_name === "string"
    ) {
      memoryLeadSource = stored;
      return stored;
    }
  } catch {
    // Fall through to the direct-entry source.
  }

  return DIRECT_LEAD_SOURCE;
}

function sourceFromLink(link) {
  const sourceId = link.dataset.source || "direct";
  const section = link.closest("section, header, footer, aside");
  const headingId = section?.getAttribute("aria-labelledby");
  const heading = headingId ? document.getElementById(headingId) : section?.querySelector("h1, h2");
  const sectionName =
    SOURCE_NAMES[sourceId] ||
    heading?.textContent.trim().replace(/\s+/g, " ") ||
    section?.getAttribute("aria-label") ||
    DIRECT_LEAD_SOURCE.section_name;

  return {
    section_id: sourceId,
    section_name: sectionName,
    cta_name:
      link.dataset.cta?.trim() ||
      link.textContent.trim().replace(/\s+/g, " ") ||
      DIRECT_LEAD_SOURCE.cta_name,
  };
}

function initCtaTracking() {
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest('a[href="#apply"]');
      if (!link) return;
      saveLeadSource(sourceFromLink(link));
    },
    { capture: true },
  );
}

function initMobileMenu() {
  const menu = document.querySelector(".mobile-menu");
  if (!menu) return;

  const summary = menu.querySelector("summary");
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !menu.open) return;
    menu.open = false;
    summary?.focus();
  });
}

function initActiveNavigation() {
  const links = [
    ...document.querySelectorAll(
      '.desktop-nav a[href^="#"], .mobile-menu nav a[href^="#"]',
    ),
  ];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;

  function setCurrent(id) {
    links.forEach((link) => {
      const active = link.getAttribute("href") === `#${id}`;
      if (active) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setCurrent(visible.target.id);
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
  );

  sections.forEach((section) => observer.observe(section));
}

function initVideoPlaceholder() {
  const trigger = document.querySelector("[data-video-placeholder]");
  const status = document.getElementById("video-status");
  if (!trigger || !status) return;

  trigger.addEventListener("click", () => {
    status.textContent =
      "Відеовідгук ще не передано. Після отримання матеріалу тут з'явиться реальна історія партнера.";
  });
}

function initForm() {
  const form = document.getElementById("lead-form");
  if (!form) return;

  const steps = [...form.querySelectorAll("[data-form-step]")];
  const progressBars = [...form.querySelectorAll(".form-progress > span")];
  const progress = document.getElementById("form-progress");
  const next = form.querySelector(".quiz-next");
  const back = form.querySelector(".quiz-back");
  const status = document.getElementById("form-status");
  let activeStep = 0;
  let isSubmitting = false;

  function errorFor(field) {
    const targetId = field.getAttribute("aria-describedby");
    if (targetId) return document.getElementById(targetId);
    return field.closest(".choice-group")?.querySelector(".field-error") || null;
  }

  function setFieldError(field, message) {
    const error = errorFor(field);
    if (error) error.textContent = message;
    field.setAttribute("aria-invalid", String(Boolean(message)));
  }

  function validateTextField(
    field,
    message,
    validator = (value) => value.length > 0,
  ) {
    const valid = validator(field.value.trim());
    setFieldError(field, valid ? "" : message);
    return valid;
  }

  function validateStep(stepIndex) {
    const step = steps[stepIndex];
    let firstInvalid = null;
    let valid = true;

    if (stepIndex === 0) {
      [["name", "Вкажи ім'я."], ["phone", "Вкажи коректний номер телефону."], ["city", "Вкажи місто."]].forEach(
        ([name, message]) => {
          const field = step.elements.namedItem(name);
          const fieldValid =
            name === "phone"
              ? validateTextField(
                  field,
                  message,
                  (value) => value.replace(/\D/g, "").length >= 10,
                )
              : validateTextField(field, message);
          if (!fieldValid && !firstInvalid) firstInvalid = field;
          valid = fieldValid && valid;
        },
      );
    } else {
      const experience = step.elements.namedItem("experience");
      const experienceValid = validateTextField(
        experience,
        "Обери свій досвід у ремонті.",
      );
      if (!experienceValid && !firstInvalid) firstInvalid = experience;
      valid = experienceValid && valid;

      const projectChoices = [...step.querySelectorAll('input[name="activeProjects"]')];
      const projectValid = Boolean(step.querySelector('input[name="activeProjects"]:checked'));
      setFieldError(
        projectChoices[0],
        projectValid ? "" : "Обери один із варіантів.",
      );
      if (!projectValid && !firstInvalid) firstInvalid = projectChoices[0];
      valid = projectValid && valid;

      const consent = step.querySelector('input[name="consent"]');
      const consentValid = consent.checked;
      setFieldError(consent, consentValid ? "" : "Потрібна згода на обробку даних.");
      if (!consentValid && !firstInvalid) firstInvalid = consent;
      valid = consentValid && valid;
    }

    if (firstInvalid) firstInvalid.focus();
    return valid;
  }

  function showStep(index, focusField = false) {
    activeStep = index;
    steps.forEach((step, stepIndex) => {
      const active = index === stepIndex;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
    });
    progressBars.forEach((bar, barIndex) => {
      bar.classList.toggle("is-active", barIndex <= index);
    });
    if (progress) {
      progress.value = index + 1;
      progress.textContent = `${index + 1} з 2`;
    }
    status.textContent = "";
    status.className = "form-status";

    if (focusField) {
      const firstField = steps[index].querySelector("input, select");
      requestAnimationFrame(() => firstField?.focus({ preventScroll: true }));
    }
  }

  function syncSourceFields() {
    const source = getLeadSource();
    Object.entries(source).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = value;
    });
  }

  next?.addEventListener("click", () => {
    if (validateStep(0)) showStep(1, true);
  });

  back?.addEventListener("click", () => showStep(0, true));

  form.addEventListener("input", (event) => {
    if (event.target.matches("input, select")) setFieldError(event.target, "");
  });

  form.addEventListener("change", (event) => {
    if (event.target.matches("input, select")) setFieldError(event.target, "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting || !validateStep(1)) return;

    if (!VELUM_CONFIG.leadEndpoint) {
      status.textContent =
        "Форма готова. Для відправлення заявки підключіть endpoint у змінній VELUM_CONFIG.leadEndpoint.";
      status.className = "form-status is-error";
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    const submitLabel = submit.querySelector("span");
    isSubmitting = true;
    submit.disabled = true;
    submitLabel.textContent = "Надсилаємо…";
    status.textContent = "";
    status.className = "form-status";
    syncSourceFields();

    try {
      const payload = {
        ...Object.fromEntries(new FormData(form).entries()),
        page_url: window.location.href.split("#")[0],
        submitted_at: new Date().toISOString(),
      };
      const response = await fetch(VELUM_CONFIG.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Lead endpoint failed");
      form.reset();
      showStep(0);
      memoryLeadSource = null;
      try {
        window.sessionStorage.removeItem(LEAD_SOURCE_KEY);
      } catch {
        // Preserve the confirmed success state when storage is unavailable.
      }
      status.textContent =
        "Заявку надіслано. Технічний спеціаліст зв'яжеться з вами.";
      status.className = "form-status is-success";
    } catch {
      status.textContent =
        "Не вдалося надіслати заявку. Введені дані збережено. Спробуйте ще раз або зв'яжіться з VELUM.";
      status.className = "form-status is-error";
    } finally {
      isSubmitting = false;
      submit.disabled = false;
      submitLabel.textContent = "Надіслати заявку";
    }
  });

  showStep(activeStep);
}

function initYear() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function init() {
  initCtaTracking();
  initMobileMenu();
  initActiveNavigation();
  initVideoPlaceholder();
  initForm();
  initYear();
  document.documentElement.classList.add("is-ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
