/**
 * QR Forge — App JavaScript
 *
 * Handles form submission by converting flat form-encoded data
 * (content.url, style.fgColor, etc.) into the nested JSON structure
 * the server expects ({ content: { url: "..." }, style: { fgColor: "..." } }).
 */

(function () {
  "use strict";

  /**
   * Download QR code — re-requests from server at specified format
   */
  window.downloadQR = function (format) {
    var f = document.getElementById("qr-form");
    if (!f) return;
    var formData = new FormData(f);
    var params = new URLSearchParams();

    params.set("type", formData.get("type") || "url");
    params.set("format", format);
    params.set("width", formData.get("style.width") || "512");

    for (var pair of formData.entries()) {
      var key = pair[0];
      if (key.startsWith("content.") || key.startsWith("style.")) {
        params.set(key, pair[1]);
      }
    }

    window.location.href = "/api/qr/download?" + params.toString();
  };

  var form = document.getElementById("qr-form");
  if (!form) return;

  // Remove hx-post so HTMX doesn't handle submission
  form.removeAttribute("hx-post");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var formData = new FormData(form);
    var body = {
      type: formData.get("type") || "url",
      content: {},
      style: {},
      format: formData.get("format") || "png",
    };

    // Build nested content.* and style.* objects
    for (var pair of formData.entries()) {
      var key = pair[0];
      var value = pair[1];
      if (key.startsWith("content.")) {
        body.content[key.replace("content.", "")] = value;
      } else if (key.startsWith("style.")) {
        body.style[key.replace("style.", "")] = value;
      }
    }

    var preview = document.getElementById("qr-preview");
    var spinner = document.getElementById("loading-spinner");

    // Show loading state
    if (spinner) spinner.style.display = "inline-flex";

    fetch("/api/qr/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "HX-Request": "true",
      },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.text().then(function (html) {
          return { ok: res.ok, html: html };
        });
      })
      .then(function (result) {
        if (preview) {
          preview.innerHTML = result.html;

          // Trigger thumbnail generation (same logic as the htmx:afterSwap handler)
          var img = preview.querySelector("img");
          if (img) {
            var canvas = document.createElement("canvas");
            canvas.width = 128;
            canvas.height = 128;
            var tempImg = new Image();
            tempImg.onload = function () {
              canvas.getContext("2d").drawImage(tempImg, 0, 0, 128, 128);
              var thumbnail = canvas.toDataURL("image/png", 0.7);
              var saveBtn = document.getElementById("save-to-history-btn");
              if (saveBtn) saveBtn.dataset.thumbnail = thumbnail;
            };
            tempImg.src = img.src;
          }
        }
      })
      .catch(function (err) {
        console.error("QR generation failed:", err);
        if (preview) {
          // Use window.t if available for error message, otherwise fallback
          const errorMsg = window.t
            ? window.t("err_network")
            : "Network error — please try again";
          preview.innerHTML =
            '<div class="flex flex-col items-center justify-center py-8 text-center">' +
            '<div class="text-4xl mb-3">⚠️</div>' +
            '<p class="text-red-400 text-sm font-medium">' +
            errorMsg +
            "</p>" +
            "</div>";
        }
      })
      .finally(function () {
        if (spinner) spinner.style.display = "none";
      });
  });
})();
