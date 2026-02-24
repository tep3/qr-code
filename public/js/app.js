// ==========================================
// Global Functions: Download QR & Save to History
// (Called from onclick handlers in server-rendered preview HTML)
// ==========================================

/**
 * Collect all form data from #qr-form as flat key=value pairs
 * e.g. { type: "url", "content.url": "https://...", "style.fgColor": "#000" }
 */
function collectFormData() {
  const form = document.getElementById("qr-form");
  if (!form) return {};
  const fd = new FormData(form);
  const data = {};
  for (const [key, value] of fd.entries()) {
    data[key] = value;
  }
  return data;
}

/**
 * Download QR code as PNG or SVG via /api/qr/download
 */
function downloadQR(format) {
  const data = collectFormData();
  data.format = format || "png";

  // Build query string from form data
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  // Open download URL (browser will handle Content-Disposition: attachment)
  const url = "/api/qr/download?" + params.toString();
  const link = document.createElement("a");
  link.href = url;
  link.download =
    "qr-forge-" + Date.now() + "." + (format === "svg" ? "svg" : "png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Save current QR code to localStorage history
 */
function saveToHistory() {
  const STORAGE_KEY = "qrforge_history";
  const MAX_HISTORY = 50;

  try {
    const data = collectFormData();
    const type = data.type || "text";

    // Extract content fields (strip "content." prefix)
    const content = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("content.") && value) {
        content[key.replace("content.", "")] = value;
      }
    }

    // Extract style fields (strip "style." prefix)
    const style = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("style.") && value) {
        style[key.replace("style.", "")] = value;
      }
    }

    // Build a human-readable label from the content
    let label = "";
    if (type === "url") label = content.url || "URL";
    else if (type === "text") label = content.text || "Text";
    else if (type === "wifi") label = content.ssid || "WiFi";
    else if (type === "vcard")
      label =
        [content.firstName, content.lastName].filter(Boolean).join(" ") ||
        "Contact";
    else if (type === "email") label = content.to || "Email";
    else if (type === "phone") label = content.phone || "Phone";
    else if (type === "sms") label = content.phone || "SMS";
    else if (type === "line") label = content.lineId || "LINE";
    else if (type === "facebook") label = content.facebookUrl || "Facebook";
    else if (type === "promptpay") label = content.promptpayId || "PromptPay";
    // Truncate
    if (label.length > 50) label = label.substring(0, 50) + "...";

    // Get thumbnail from current preview image (keep original configured size)
    let thumbnail = "";
    const previewImg = document.querySelector("#qr-preview img");
    if (previewImg && previewImg.src.startsWith("data:")) {
      thumbnail = previewImg.src;
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      type: type,
      content: content,
      style: style,
      label: label,
      starred: false,
      createdAt: new Date().toISOString(),
      source: "generated",
      thumbnail: thumbnail,
    };

    // Save
    var history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // Update history badges
    updateHistoryBadges(history.length);

    // Visual feedback on the save button
    var saveBtn = document.getElementById("save-to-history-btn");
    if (saveBtn) {
      var originalHTML = saveBtn.innerHTML;
      saveBtn.innerHTML = "✅ " + (window.t ? window.t("saved") : "Saved!");
      saveBtn.classList.add("btn-success", "text-white");
      saveBtn.classList.remove("btn-ghost", "text-base-content/50");
      saveBtn.disabled = true;
      setTimeout(function () {
        saveBtn.innerHTML = originalHTML;
        saveBtn.classList.remove("btn-success", "text-white");
        saveBtn.classList.add("btn-ghost", "text-base-content/50");
        saveBtn.disabled = false;
      }, 2000);
    }
  } catch (e) {
    console.error("Failed to save to history", e);
    alert("Failed to save to history.");
  }
}

function updateHistoryBadges(count) {
  ["history-badge", "history-badge-mobile"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = count;
      if (count > 0) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
  });
}

// ==========================================
// Main DOMContentLoaded Setup
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. จัดการ Dropdown ด้วย Toggle Element (เปลี่ยนจาก <details> เป็น Div ธรรมดา)
  // ==========================================
  const setupDropdowns = () => {
    const toggleBtns = document.querySelectorAll("[data-dropdown-toggle]");

    // เมื่อกดปุ่ม Toggle
    toggleBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // หยุด Event ไม่ให้ทะลุไปถึง Document ทันที

        const targetId = btn.getAttribute("data-dropdown-toggle");
        const targetMenu = document.getElementById(targetId);

        if (targetMenu) {
          // ออปชันเสริม: ปิดเมนูอื่นๆ ที่เปิดอยู่ก่อน (ถ้ามี dropdown หลายอัน)
          document
            .querySelectorAll(".dropdown-menu-content")
            .forEach((menu) => {
              if (menu.id !== targetId && !menu.classList.contains("hidden")) {
                menu.classList.add("hidden");
              }
            });

          // สลับสถานะซ่อน/แสดง ของเมนูที่ต้องการ
          targetMenu.classList.toggle("hidden");
        }
      });
    });

    // ฟังก์ชันดักจับการคลิกทั้งหน้าจอ (Click Outside & Click Inside)
    const handleGlobalClick = (e) => {
      // หาเมนูทั้งหมดที่กำลังเปิดอยู่ (ไม่มีคลาส hidden)
      const openMenus = document.querySelectorAll(
        ".dropdown-menu-content:not(.hidden)",
      );

      openMenus.forEach((menu) => {
        const toggleBtn = document.querySelector(
          `[data-dropdown-toggle="${menu.id}"]`,
        );

        // กรณีที่ 1: ผู้ใช้คลิก "ข้างใน" เมนู (เช่น กดเลือกภาษา Item 1, Item 2)
        const isClickOnMenuItem = e.target.closest("li, a, button");
        if (menu.contains(e.target) && isClickOnMenuItem) {
          menu.classList.add("hidden"); // ปิดเมนูทันทีเมื่อเลือกเสร็จ
          return;
        }

        // กรณีที่ 2: ผู้ใช้คลิก "พื้นที่ว่างข้างนอก" (Click Outside)
        if (
          !menu.contains(e.target) &&
          toggleBtn &&
          !toggleBtn.contains(e.target)
        ) {
          menu.classList.add("hidden"); // ปิดเมนู
        }
      });
    };

    // รองรับทั้งคลิกเมาส์ (คอมฯ) และทัชสกรีน (iPad/มือถือ)
    document.addEventListener("click", handleGlobalClick);
    document.addEventListener("touchstart", handleGlobalClick, {
      passive: true,
    });
  };

  // ==========================================
  // 2. การจัดการ Mobile Menu (Hamburger Menu)
  // ==========================================
  const setupMobileMenu = () => {
    const mobileBtn = document.getElementById("mobile-menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle("hidden");
      });

      ["click", "touchstart"].forEach((eventType) => {
        document.addEventListener(eventType, (e) => {
          if (
            !mobileMenu.classList.contains("hidden") &&
            !mobileBtn.contains(e.target) &&
            !mobileMenu.contains(e.target)
          ) {
            mobileMenu.classList.add("hidden");
          }
        });
      });
    }
  };

  // ==========================================
  // 3. การจัดการ Tabs (เปลี่ยนประเภท QR Code)
  // ==========================================
  const setupTabs = () => {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach((b) => {
          b.classList.remove("active", "border-blue-500", "text-blue-600");
          b.classList.add("border-transparent", "text-gray-500");
        });

        tabContents.forEach((content) => content.classList.add("hidden"));

        const targetId = btn.getAttribute("data-tab-target");
        const targetContent = document.getElementById(targetId);

        btn.classList.add("active", "border-blue-500", "text-blue-600");
        btn.classList.remove("border-transparent", "text-gray-500");

        if (targetContent) {
          targetContent.classList.remove("hidden");
        }
      });
    });
  };

  // ==========================================
  // 4. การจัดการ Form Submit เพื่อสร้าง QR Code
  // ==========================================
  const setupForms = () => {
    const forms = document.querySelectorAll("form[data-qr-form]");
    const qrResultContainer = document.getElementById("qr-result-container");
    const qrImage = document.getElementById("qr-image");

    forms.forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.type = form.getAttribute("data-qr-type");

        try {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            const result = await response.json();
            if (qrImage && result.qrImageUrl) {
              qrImage.src = result.qrImageUrl;
              if (qrResultContainer)
                qrResultContainer.classList.remove("hidden");
            }
          } else {
            console.error("Failed to generate QR Code");
            alert("เกิดข้อผิดพลาดในการสร้าง QR Code");
          }
        } catch (error) {
          console.error("Error:", error);
        }
      });
    });
  };

  // เรียกใช้งานฟังก์ชัน
  setupDropdowns();
  setupMobileMenu();
  setupTabs();
  setupForms();
});
