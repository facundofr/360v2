// Comportamiento compartido del set de concepto Cober360.
// Nada de esto importa de src/: el set es autónomo a propósito.

(function () {
  "use strict";

  /* ── Modales ─────────────────────────────────────────────────────────── */

  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) {
      var dlg = document.getElementById(open.getAttribute("data-open"));
      if (dlg && typeof dlg.showModal === "function") {
        e.preventDefault();
        dlg.showModal();
      }
      return;
    }
    var close = e.target.closest("[data-close]");
    if (close) {
      e.preventDefault();
      var owner = close.closest("dialog");
      if (owner) owner.close();
    }
  });

  // Click en el backdrop cierra. dialog no lo hace solo.
  document.querySelectorAll("dialog.modal").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });
  });

  /* ── Selección del registro ──────────────────────────────────────────── */

  var bar = document.querySelector("[data-marked]");
  var count = document.querySelector("[data-marked-count]");
  var all = document.querySelector("[data-mark-all]");

  function boxes() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-mark]"));
  }

  function sync() {
    if (!bar) return;
    var on = boxes().filter(function (b) { return b.checked; });
    on.forEach(function (b) {
      var row = b.closest(".reg-row");
      if (row) row.setAttribute("aria-selected", "true");
    });
    boxes().filter(function (b) { return !b.checked; }).forEach(function (b) {
      var row = b.closest(".reg-row");
      if (row) row.removeAttribute("aria-selected");
    });
    bar.hidden = on.length === 0;
    if (count) count.textContent = String(on.length);
    if (all) {
      all.checked = on.length > 0 && on.length === boxes().length;
      all.indeterminate = on.length > 0 && on.length < boxes().length;
    }
  }

  document.addEventListener("change", function (e) {
    if (e.target.matches("[data-mark]")) sync();
    if (e.target.matches("[data-mark-all]")) {
      var on = e.target.checked;
      boxes().forEach(function (b) { b.checked = on; });
      sync();
    }
  });

  var clear = document.querySelector("[data-mark-clear]");
  if (clear) {
    clear.addEventListener("click", function () {
      boxes().forEach(function (b) { b.checked = false; });
      sync();
    });
  }

  sync();

  /* ── Teclado: el turno completo se trabaja sin mouse ─────────────────── */

  var search = document.querySelector("[data-search]");

  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

    if (e.key === "/" && !typing && search) {
      e.preventDefault();
      search.focus();
      search.select();
      return;
    }
    if (e.key === "Escape" && document.activeElement === search) {
      search.blur();
      return;
    }
    if (typing) return;

    if (e.key === "j" || e.key === "k") {
      var rows = Array.prototype.slice.call(document.querySelectorAll(".reg-row.entry"));
      if (!rows.length) return;
      e.preventDefault();
      var here = document.activeElement.closest ? document.activeElement.closest(".reg-row.entry") : null;
      var at = here ? rows.indexOf(here) : -1;
      var next = e.key === "j" ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0);
      var box = rows[next].querySelector("[data-mark]");
      if (box) box.focus();
      rows[next].scrollIntoView({ block: "nearest" });
    }
  });

  /* ── Confirmación destructiva ────────────────────────────────────────── */
  /* El botón se habilita sólo cuando el texto coincide. Sin esto la guarda que
     el índice anuncia sería decorativa.                                       */

  document.querySelectorAll("[data-confirm-word]").forEach(function (input) {
    var form = input.closest("form") || document;
    var submit = form.querySelector("[data-confirm-submit]");
    if (!submit) return;
    var want = input.getAttribute("data-confirm-word");
    var check = function () {
      submit.disabled = input.value.trim().toUpperCase() !== want.toUpperCase();
    };
    input.addEventListener("input", check);
    var dlg = input.closest("dialog");
    if (dlg) dlg.addEventListener("close", function () { input.value = ""; check(); });
    check();
  });

  /* ── Tema ────────────────────────────────────────────────────────────── */

  var toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var root = document.documentElement;
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("cober-concept-theme", next); } catch (err) { /* modo privado */ }
    });
  }
  try {
    var saved = localStorage.getItem("cober-concept-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  } catch (err) { /* modo privado: se queda en claro */ }
})();
