/* ============================================================
   AI Minds — AI Career Guidance Session
   Feedback form + automatic certificate generation

   Flow: validate -> insert into Supabase -> success screen
         -> render certificate -> download landscape A4 PDF
   ============================================================ */

"use strict";

/* ------------------------------------------------------------
   1. CONFIGURATION
   Replace these two values with your own Supabase project
   credentials (Supabase Dashboard -> Project Settings -> API).
   ------------------------------------------------------------ */
const SUPABASE_URL = "https://ekcvefzfizzeahlyccns.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UjVz8lFgG6IsGZuJzFpdZg_XtGSyR1G";

/** Table that stores every submission. */
const FEEDBACK_TABLE = "feedback";

/** AI tools shown as selectable logo cards (single source of truth). */
const AI_TOOLS = [
  { id: "chatgpt", name: "ChatGPT", logo: "assets/chatgpt.png" },
  { id: "gemini", name: "Gemini Notebook", logo: "assets/gemini.png" },
  { id: "gamma", name: "Gamma", logo: "assets/gamma.png" },
  { id: "yoodli", name: "Yoodli", logo: "assets/yoodli.png" },
  { id: "mapify", name: "Mapify", logo: "assets/mapify.png" },
  { id: "napkin", name: "Napkin", logo: "assets/napkin.png" }
];

/** Labels shown under the star rating. */
const RATING_LABELS = ["Poor", "Fair", "Good", "Very Good", "Excellent"];

/** Certificate canvas size — A4 landscape at 96 DPI. */
const CERT_WIDTH_PX = 1123;
const CERT_HEIGHT_PX = 794;
const A4_LANDSCAPE_MM = { width: 297, height: 210 };

/* ------------------------------------------------------------
   2. STATE
   ------------------------------------------------------------ */
const state = {
  selectedTool: "",
  rating: 0,
  isSubmitting: false,
  hasSubmitted: false,
  studentName: "",
  certificateNumber: "",
  /** Rendered certificate image, reused by every download. */
  certificateDataUrl: "",
  hasDownloaded: false
};

/* ------------------------------------------------------------
   3. DOM REFERENCES
   ------------------------------------------------------------ */
const dom = {
  form: document.getElementById("feedbackForm"),
  formSection: document.getElementById("formSection"),
  successSection: document.getElementById("successSection"),
  submitBtn: document.getElementById("submitBtn"),
  formStatus: document.getElementById("formStatus"),
  toolGrid: document.getElementById("toolGrid"),
  ratingStars: document.getElementById("ratingStars"),
  ratingCaption: document.getElementById("ratingCaption"),
  certificate: document.getElementById("certificate"),
  certName: document.getElementById("certName"),
  certDate: document.getElementById("certDate"),
  certificateStatus: document.getElementById("certificateStatus"),
  certPreviewImg: document.getElementById("certPreviewImg"),
  certPreviewSkeleton: document.getElementById("certPreviewSkeleton"),
  downloadBtn: document.getElementById("downloadBtn"),
  downloadAgainBtn: document.getElementById("downloadAgainBtn"),
  confettiCanvas: document.getElementById("confettiCanvas"),
  footerYear: document.getElementById("footerYear")
};

/* ------------------------------------------------------------
   4. SUPABASE CLIENT
   ------------------------------------------------------------ */
let supabaseClient = null;

/** Creates the Supabase client once, if the SDK and config are ready. */
function initSupabase() {
  const isConfigured =
    SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

  if (!isConfigured || !window.supabase) {
    console.error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in script.js."
    );
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ------------------------------------------------------------
   5. SMALL HELPERS
   ------------------------------------------------------------ */

/** Returns the trimmed value of an input by id. */
function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

/** Returns the checked value of a radio group, or "". */
function checkedValueOf(name) {
  const checked = dom.form.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

/** Shows an inline error message under a field. */
function showError(fieldKey, message) {
  const errorEl = dom.form.querySelector(`[data-error-for="${fieldKey}"]`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add("is-visible");
  }

  const input = document.getElementById(fieldKey);
  if (input) {
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
  }
}

/** Clears the inline error of a single field. */
function clearError(fieldKey) {
  const errorEl = dom.form.querySelector(`[data-error-for="${fieldKey}"]`);
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("is-visible");
  }

  const input = document.getElementById(fieldKey);
  if (input) {
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
  }
}

/** Clears every inline error plus the form level message. */
function clearAllErrors() {
  dom.form.querySelectorAll(".error-text").forEach((el) => {
    el.textContent = "";
    el.classList.remove("is-visible");
  });
  dom.form.querySelectorAll(".is-invalid").forEach((el) => {
    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
  });
  setFormStatus("");
}

/** Shows (or hides, when message is empty) the form level error banner. */
function setFormStatus(message) {
  dom.formStatus.textContent = message;
  dom.formStatus.classList.toggle("is-visible", Boolean(message));
}

/** Default label of the submit button. */
const SUBMIT_IDLE_LABEL = "Submit Feedback & Get Certificate";

/**
 * Toggles the submit button between idle and loading states.
 * @param {boolean} isLoading
 * @param {string} [label] stage text shown while loading
 */
function setSubmitting(isLoading, label) {
  state.isSubmitting = isLoading;
  dom.submitBtn.disabled = isLoading;
  dom.submitBtn.classList.toggle("is-loading", isLoading);
  dom.submitBtn.querySelector(".btn-label").textContent = isLoading
    ? label || "Submitting..."
    : SUBMIT_IDLE_LABEL;
}

/** Updates only the submit button label (used for the stage messages). */
function setSubmitLabel(label) {
  dom.submitBtn.querySelector(".btn-label").textContent = label;
}

/** Updates the certificate status line on the success screen. */
function setCertificateStatus(message, variant) {
  dom.certificateStatus.textContent = message;
  dom.certificateStatus.classList.toggle("is-done", variant === "done");
  dom.certificateStatus.classList.toggle("is-error", variant === "error");
}

/**
 * Builds a unique certificate number, e.g. AIM-2026-5F8D9A2C.
 * Uses crypto random bytes when available.
 */
function generateCertificateNumber() {
  const bytes = new Uint8Array(4);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return `AIM-${new Date().getFullYear()}-${hex.toUpperCase()}`;
}

/** Today as "12 August 2026". */
function formatDisplayDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/** Today as "2026-08-12" for the database (no timezone shift). */
function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Replaces a broken logo image with a lettered placeholder tile. */
function useLogoFallback(img, label) {
  const fallback = document.createElement("span");
  fallback.className = "tool-logo-fallback";
  fallback.textContent = label.charAt(0).toUpperCase();
  img.replaceWith(fallback);
}

/** Resolves once every image inside the element is loaded (or failed). */
function waitForImages(element) {
  const images = Array.from(element.querySelectorAll("img"));
  return Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    })
  );
}

/* ------------------------------------------------------------
   6. DYNAMIC UI — AI TOOL CARDS
   ------------------------------------------------------------ */
function renderToolCards() {
  const fragment = document.createDocumentFragment();

  AI_TOOLS.forEach((tool) => {
    const card = document.createElement("label");
    card.className = "tool-card";
    card.dataset.toolId = tool.id;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "favoriteAiTool";
    radio.value = tool.name;

    const logo = document.createElement("img");
    logo.className = "tool-logo";
    logo.src = tool.logo;
    logo.alt = "";
    logo.addEventListener("error", () => useLogoFallback(logo, tool.name), {
      once: true
    });

    const name = document.createElement("span");
    name.className = "tool-name";
    name.textContent = tool.name;

    // Tick badge, shown by CSS only when the card is selected.
    const check = document.createElement("span");
    check.className = "tool-check";
    check.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>';

    card.append(radio, check, logo, name);
    fragment.appendChild(card);
  });

  dom.toolGrid.appendChild(fragment);

  // One delegated listener keeps selection logic in a single place.
  dom.toolGrid.addEventListener("change", (event) => {
    if (event.target.name !== "favoriteAiTool") return;
    state.selectedTool = event.target.value;
    highlightSelectedTool();
    clearError("favoriteAiTool");
  });
}

/** Applies the selected style to the active tool card only. */
function highlightSelectedTool() {
  dom.toolGrid.querySelectorAll(".tool-card").forEach((card) => {
    const radio = card.querySelector("input[type='radio']");
    card.classList.toggle("is-selected", radio.checked);
  });
}

/* ------------------------------------------------------------
   7. DYNAMIC UI — STAR RATING
   ------------------------------------------------------------ */
const STAR_PATH =
  "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4 6.2 20.4l1.1-6.4L2.6 9.4l6.5-.9L12 2.6z";

function renderStars() {
  for (let value = 1; value <= 5; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "star-btn";
    button.dataset.value = String(value);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.setAttribute(
      "aria-label",
      `${value} star${value > 1 ? "s" : ""} — ${RATING_LABELS[value - 1]}`
    );
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;

    button.addEventListener("click", () => setRating(value));
    dom.ratingStars.appendChild(button);
  }

  // Left/right arrow keys move the rating for keyboard users.
  dom.ratingStars.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = Math.min(5, Math.max(1, state.rating + step));
    setRating(next);
    dom.ratingStars.querySelector(`[data-value="${next}"]`).focus();
  });
}

/** Stores the rating and repaints the stars. */
function setRating(value) {
  state.rating = value;

  dom.ratingStars.querySelectorAll(".star-btn").forEach((button) => {
    const isActive = Number(button.dataset.value) <= value;
    button.classList.toggle("is-active", isActive);
    button.setAttribute(
      "aria-checked",
      Number(button.dataset.value) === value ? "true" : "false"
    );
  });

  dom.ratingCaption.textContent = `${value}/5 — ${RATING_LABELS[value - 1]}`;
  clearError("rating");
}

/* ------------------------------------------------------------
   8. VALIDATION
   ------------------------------------------------------------ */
const TEN_DIGITS = /^\d{10}$/;

/**
 * Validates every field.
 * @returns {boolean} true when the form can be submitted.
 */
function validateForm() {
  clearAllErrors();

  const errors = [];
  const studentName = valueOf("studentName");
  const studentContact = valueOf("studentContact");
  const parentContact = valueOf("parentContact");
  const schoolName = valueOf("schoolName");
  const standard = valueOf("standard");
  const feedback = valueOf("feedback");

  if (studentName.length < 2) {
    errors.push(["studentName", "Please enter your full name."]);
  }

  if (!TEN_DIGITS.test(studentContact)) {
    errors.push(["studentContact", "Enter exactly 10 digits."]);
  }

  if (!TEN_DIGITS.test(parentContact)) {
    errors.push(["parentContact", "Enter exactly 10 digits."]);
  }

  if (schoolName.length < 2) {
    errors.push(["schoolName", "Please enter your school name."]);
  }

  if (!standard) {
    errors.push(["standard", "Please select your standard."]);
  }

  if (!checkedValueOf("favoriteAiTool")) {
    errors.push(["favoriteAiTool", "Please select one AI tool."]);
  }

  if (state.rating < 1) {
    errors.push(["rating", "Please rate the session."]);
  }

  if (!checkedValueOf("aiUnderstood")) {
    errors.push(["aiUnderstood", "Please select an option."]);
  }

  if (!checkedValueOf("reuseAi")) {
    errors.push(["reuseAi", "Please select an option."]);
  }

  if (feedback.length < 3) {
    errors.push(["feedback", "Please share your feedback."]);
  }

  errors.forEach(([field, message]) => showError(field, message));

  if (errors.length > 0) {
    setFormStatus("Please complete all fields before submitting.");
    scrollToFirstError();
    return false;
  }

  return true;
}

/** Brings the first invalid field into view and focuses it. */
function scrollToFirstError() {
  const firstError = dom.form.querySelector(".error-text.is-visible");
  if (!firstError) return;

  const field = firstError.closest(".field");
  field.scrollIntoView({ behavior: "smooth", block: "center" });

  // Focus the first control inside that field, without a second scroll jump.
  const control = field.querySelector(
    "input:not([type='hidden']), select, textarea, .star-btn"
  );
  if (control) control.focus({ preventScroll: true });
}

/* ------------------------------------------------------------
   9. SUBMISSION
   ------------------------------------------------------------ */

/**
 * Columns added after the first release. If the table has not been
 * migrated yet, the insert is retried without them so a student is
 * never blocked by a missing column.
 */
const OPTIONAL_COLUMNS = ["certificate_number", "submission_date"];

/** Builds the row that is inserted into Supabase. */
function collectFormData() {
  const now = new Date();

  return {
    certificate_number: state.certificateNumber,
    submission_date: toIsoDate(now),
    student_name: valueOf("studentName").replace(/\s+/g, " "),
    student_contact: valueOf("studentContact"),
    parent_contact: valueOf("parentContact"),
    school_name: valueOf("schoolName").replace(/\s+/g, " "),
    standard: valueOf("standard"),
    favorite_ai_tool: checkedValueOf("favoriteAiTool"),
    rating: state.rating,
    ai_understood: checkedValueOf("aiUnderstood"),
    reuse_ai: checkedValueOf("reuseAi"),
    feedback: valueOf("feedback")
  };
}

/** Inserts one feedback row and waits for Supabase to confirm it. */
async function saveFeedback(payload) {
  if (!supabaseClient) {
    throw new Error(
      "Submission is not available right now. Please inform the session coordinator."
    );
  }

  let { error } = await supabaseClient.from(FEEDBACK_TABLE).insert([payload]);
  if (!error) return;

  // Certificate numbers are unique — on the rare collision, mint a new one.
  if (error.code === "23505") {
    state.certificateNumber = generateCertificateNumber();
    payload.certificate_number = state.certificateNumber;
    ({ error } = await supabaseClient.from(FEEDBACK_TABLE).insert([payload]));
    if (!error) return;
  }

  // The table may predate the certificate_number / submission_date columns.
  if (isUnknownColumnError(error)) {
    console.warn(
      "Supabase table is missing newer columns — run supabase-setup.sql. Retrying without them."
    );

    const reduced = { ...payload };
    OPTIONAL_COLUMNS.forEach((column) => delete reduced[column]);

    const retry = await supabaseClient.from(FEEDBACK_TABLE).insert([reduced]);
    if (!retry.error) return;

    console.error("Supabase insert failed:", retry.error);
  } else {
    console.error("Supabase insert failed:", error);
  }

  throw new Error("We could not save your feedback. Please try again.");
}

/** True when Supabase rejected the insert because a column does not exist. */
function isUnknownColumnError(error) {
  const code = error.code || "";
  const message = (error.message || "").toLowerCase();
  return (
    code === "PGRST204" ||
    code === "42703" ||
    OPTIONAL_COLUMNS.some((column) => message.includes(column))
  );
}

/** Handles the submit event end to end. */
async function handleSubmit(event) {
  event.preventDefault();

  // Guard against double clicks and re-submission after success.
  if (state.isSubmitting || state.hasSubmitted) return;

  if (!validateForm()) return;

  setSubmitting(true, "Saving Feedback...");

  try {
    state.certificateNumber = generateCertificateNumber();

    const payload = collectFormData();
    await saveFeedback(payload);

    state.hasSubmitted = true;
    state.studentName = payload.student_name;

    // Stage 2 — feedback is stored, now build the certificate.
    setSubmitLabel("Generating Certificate...");
    showSuccessScreen();

    await prepareCertificate(state.studentName);

    setSubmitLabel("Certificate Ready");
  } catch (error) {
    setFormStatus(error.message || "Something went wrong. Please try again.");
    setSubmitting(false);
  }
}

/* ------------------------------------------------------------
   10. SUCCESS SCREEN
   ------------------------------------------------------------ */
function showSuccessScreen() {
  dom.formSection.classList.add("is-hidden");
  dom.successSection.classList.remove("is-hidden");
  dom.successSection.classList.add("fade-in");

  // Smoothly bring the certificate section into view.
  dom.successSection.scrollIntoView({ behavior: "smooth", block: "start" });

  playConfetti();
}

/* ------------------------------------------------------------
   11. CERTIFICATE + PDF
   ------------------------------------------------------------ */

/** Turns a student name into a safe file name fragment. */
function toFileNameSafe(name) {
  return (
    name
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 60) || "Student"
  );
}

/** Largest and smallest font size used for the student name. */
const NAME_MAX_FONT_PX = 72;
const NAME_MIN_FONT_PX = 30;

/**
 * Shrinks the name until it fits on a single line inside the frame.
 * Measured from the live element, so it is exact for any name length.
 */
function fitStudentName() {
  const nameEl = dom.certName;
  const available = nameEl.clientWidth;

  let fontSize = NAME_MAX_FONT_PX;
  nameEl.style.fontSize = `${fontSize}px`;

  while (nameEl.scrollWidth > available && fontSize > NAME_MIN_FONT_PX) {
    fontSize -= 2;
    nameEl.style.fontSize = `${fontSize}px`;
  }
}

/** Writes the student name and date onto the hidden certificate. */
function fillCertificate(studentName) {
  dom.certName.textContent = studentName;
  fitStudentName();

  // e.g. "12 AUGUST 2026"
  dom.certDate.textContent = formatDisplayDate(new Date()).toUpperCase();
}

/**
 * Renders the hidden certificate markup to a PNG data URL.
 * This is the single source of truth for both the preview and the PDF.
 */
async function renderCertificateImage(studentName) {
  if (!window.html2canvas) {
    throw new Error("Certificate renderer failed to load.");
  }

  // Web fonts must be ready before measuring the name or capturing.
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  fillCertificate(studentName);
  await waitForImages(dom.certificate);

  const canvas = await window.html2canvas(dom.certificate, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: CERT_WIDTH_PX,
    height: CERT_HEIGHT_PX,
    scrollX: 0,
    scrollY: 0
  });

  return canvas.toDataURL("image/png");
}

/**
 * Builds the certificate and shows it on the success screen.
 * Never throws — failures are reported in the status line.
 */
async function prepareCertificate(studentName) {
  setCertificateStatus("Generating your certificate...", "");
  dom.downloadBtn.disabled = true;

  try {
    state.certificateDataUrl = await renderCertificateImage(studentName);

    dom.certPreviewImg.src = state.certificateDataUrl;
    dom.certPreviewImg.classList.remove("is-hidden");
    dom.certPreviewSkeleton.classList.add("is-hidden");

    setCertificateStatus(
      "Your certificate is ready. Tap the button below to download it.",
      "done"
    );
    dom.downloadBtn.disabled = false;
  } catch (error) {
    console.error("Certificate generation failed:", error);
    dom.certPreviewSkeleton.classList.add("is-hidden");
    setCertificateStatus(
      "Your feedback is saved, but the certificate preview could not be created. Tap the button below to try again.",
      "error"
    );
    dom.downloadBtn.disabled = false;
  }
}

/**
 * Downloads the certificate as a landscape A4 PDF.
 * Re-renders the image first if it is not available yet.
 */
async function downloadCertificate(event) {
  // Works for both the primary and the "Download Again" button.
  const button = (event && event.currentTarget) || dom.downloadBtn;
  const label = button.querySelector(".btn-label") || button;
  const originalLabel = label.textContent;

  button.disabled = true;
  button.classList.add("is-loading");
  label.textContent = "Preparing PDF...";

  try {
    if (!window.jspdf) {
      throw new Error("PDF library failed to load.");
    }

    if (!state.certificateDataUrl) {
      state.certificateDataUrl = await renderCertificateImage(
        state.studentName
      );
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    pdf.addImage(
      state.certificateDataUrl,
      "PNG",
      0,
      0,
      A4_LANDSCAPE_MM.width,
      A4_LANDSCAPE_MM.height
    );
    pdf.save(`Certificate_${toFileNameSafe(state.studentName)}.pdf`);

    state.hasDownloaded = true;
    dom.downloadAgainBtn.classList.remove("is-hidden");
    setCertificateStatus(
      "Certificate downloaded. Check your downloads folder.",
      "done"
    );
  } catch (error) {
    console.error("Certificate download failed:", error);
    setCertificateStatus(
      "The download did not start. Please try once more.",
      "error"
    );
  } finally {
    button.classList.remove("is-loading");
    label.textContent = originalLabel;
    button.disabled = false;
  }
}

/* ------------------------------------------------------------
   11b. CONFETTI — small canvas burst, ~2 seconds
   ------------------------------------------------------------ */
const CONFETTI_COLORS = ["#1e40af", "#3b82f6", "#dbeafe", "#16a34a", "#f59e0b"];
const CONFETTI_COUNT = 90;
const CONFETTI_DURATION = 2000;

function playConfetti() {
  const canvas = dom.confettiCanvas;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (!canvas || !canvas.getContext || prefersReducedMotion) return;

  const context = canvas.getContext("2d");
  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const pieces = Array.from({ length: CONFETTI_COUNT }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.5,
    size: 5 + Math.random() * 6,
    speedY: 2.5 + Math.random() * 3,
    drift: -1 + Math.random() * 2,
    rotation: Math.random() * Math.PI,
    spin: -0.15 + Math.random() * 0.3,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
  }));

  canvas.classList.remove("is-hidden");
  const startedAt = performance.now();

  function frame(now) {
    const elapsed = now - startedAt;
    const fade = Math.max(0, 1 - elapsed / CONFETTI_DURATION);

    context.clearRect(0, 0, width, height);
    context.globalAlpha = fade;

    pieces.forEach((piece) => {
      piece.y += piece.speedY;
      piece.x += piece.drift;
      piece.rotation += piece.spin;

      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
      context.restore();
    });

    if (elapsed < CONFETTI_DURATION) {
      window.requestAnimationFrame(frame);
    } else {
      context.clearRect(0, 0, width, height);
      canvas.classList.add("is-hidden");
    }
  }

  window.requestAnimationFrame(frame);
}

/* ------------------------------------------------------------
   12. INPUT BEHAVIOUR
   ------------------------------------------------------------ */
function bindFieldListeners() {
  // Contact fields accept digits only.
  dom.form.querySelectorAll("[data-digits-only]").forEach((input) => {
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "").slice(0, 10);
      if (input.value !== digits) input.value = digits;
      clearError(input.id);
    });
  });

  // Typing or choosing clears the matching error message.
  dom.form.querySelectorAll("input, select, textarea").forEach((field) => {
    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, () => {
      if (field.id) clearError(field.id);
      if (field.name) clearError(field.name);
    });
  });
}

/* ------------------------------------------------------------
   13. INITIALISATION
   ------------------------------------------------------------ */
function init() {
  dom.footerYear.textContent = String(new Date().getFullYear());

  initSupabase();
  renderToolCards();
  renderStars();
  bindFieldListeners();

  dom.form.addEventListener("submit", handleSubmit);
  dom.downloadBtn.addEventListener("click", downloadCertificate);
  dom.downloadAgainBtn.addEventListener("click", downloadCertificate);

  // Hide logo images that are missing so the layout stays clean.
  // The error may already have fired before this script ran, so the
  // loaded state is checked as well.
  ["siteLogo", "certLogo", "certSignature"].forEach((id) => {
    const img = document.getElementById(id);
    if (!img) return;

    const hide = () => {
      img.style.display = "none";
    };

    if (img.complete && img.naturalWidth === 0) hide();
    img.addEventListener("error", hide, { once: true });
  });
}

document.addEventListener("DOMContentLoaded", init);
