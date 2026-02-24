document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. แก้ไขปัญหา Dropdown ค้างบน iOS (WKWebView/Safari)
  // ==========================================
  const setupDropdowns = () => {
    // --- ส่วนที่ 1: จัดการ Dropdown แบบ <details> (DaisyUI) ---
    const detailsDropdowns = document.querySelectorAll("details.dropdown");

    detailsDropdowns.forEach((details) => {
      const menuItems = details.querySelectorAll(".menu li a, .menu li button");
      menuItems.forEach((item) => {
        item.addEventListener("click", () => {
          details.removeAttribute("open");
        });
      });
    });

    // --- ส่วนที่ 1.5: จัดการ DaisyUI tabindex Dropdown (ปิดเมื่อกดเลือก) ---
    document.querySelectorAll(".dropdown .dropdown-content").forEach((menu) => {
      menu.querySelectorAll("li a, li button").forEach((item) => {
        item.addEventListener("click", () => {
          // Blur ทั้ง menu และ trigger เพื่อบังคับปิด
          menu.blur();
          const trigger = menu
            .closest(".dropdown")
            ?.querySelector("[tabindex]");
          if (trigger) trigger.blur();
          if (document.activeElement) document.activeElement.blur();
        });
      });
    });

    // --- ส่วนที่ 2: จัดการ Dropdown แบบใช้คลาส .hidden (แบบดั้งเดิม) ---
    const dropdownToggles = document.querySelectorAll(
      "[data-dropdown-toggle], .dropdown-btn",
    );

    dropdownToggles.forEach((toggleBtn) => {
      const targetId = toggleBtn.getAttribute("data-dropdown-toggle");
      const dropdownMenu = targetId
        ? document.getElementById(targetId)
        : toggleBtn.nextElementSibling;

      if (!dropdownMenu) return;

      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdownMenu.classList.toggle("hidden");
      });

      const menuItems = dropdownMenu.querySelectorAll("a, button, li");
      menuItems.forEach((item) => {
        item.addEventListener("click", () => {
          dropdownMenu.classList.add("hidden");
        });
      });
    });

    // --- ส่วนที่ 3: ฟังก์ชันปิดเมนูเมื่อคลิกพื้นที่ว่าง (Click Outside) รองรับ iOS ---
    const closeAllDropdowns = (e) => {
      // ปิด <details>
      detailsDropdowns.forEach((details) => {
        if (details.hasAttribute("open") && !details.contains(e.target)) {
          details.removeAttribute("open");
        }
      });

      // ปิด DaisyUI tabindex dropdown เมื่อคลิกข้างนอก
      document.querySelectorAll(".dropdown").forEach((dropdown) => {
        if (!dropdown.contains(e.target)) {
          const trigger = dropdown.querySelector("[tabindex]");
          if (trigger) trigger.blur();
        }
      });

      // ปิด .hidden dropdown
      dropdownToggles.forEach((toggleBtn) => {
        const targetId = toggleBtn.getAttribute("data-dropdown-toggle");
        const dropdownMenu = targetId
          ? document.getElementById(targetId)
          : toggleBtn.nextElementSibling;

        if (dropdownMenu && !dropdownMenu.classList.contains("hidden")) {
          if (
            !toggleBtn.contains(e.target) &&
            !dropdownMenu.contains(e.target)
          ) {
            dropdownMenu.classList.add("hidden");
          }
        }
      });
    };

    // ใช้ทั้ง click และ touchstart เพื่อแก้ปัญหาบนอุปกรณ์จอสัมผัส
    document.addEventListener("click", closeAllDropdowns);
    document.addEventListener("touchstart", closeAllDropdowns, {
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

      // ปิดเมนูมือถือเมื่อคลิกพื้นที่ว่าง
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
        // ลบสถานะ active จากปุ่มทั้งหมด
        tabBtns.forEach((b) => {
          b.classList.remove("active", "border-blue-500", "text-blue-600");
          b.classList.add("border-transparent", "text-gray-500");
        });

        // ซ่อนเนื้อหาทั้งหมด
        tabContents.forEach((content) => content.classList.add("hidden"));

        // เปิดใช้งานปุ่มและเนื้อหาที่เลือก
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
  // 4. การจัดการ Form Submit เพื่อสร้าง QR Code (ตัวอย่าง)
  // ==========================================
  const setupForms = () => {
    const forms = document.querySelectorAll("form[data-qr-form]");
    const qrResultContainer = document.getElementById("qr-result-container");
    const qrImage = document.getElementById("qr-image");

    forms.forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // ดึงข้อมูลจากฟอร์ม
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // เพิ่มประเภทของฟอร์มเข้าไปด้วย (เช่น url, text, wifi)
        data.type = form.getAttribute("data-qr-type");

        try {
          // ปรับ URL API ให้ตรงกับ Route ใน src/route/api.ts ของคุณ
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            const result = await response.json();
            // สมมติว่า API ส่งกลับมาเป็น { qrImageUrl: 'data:image/png;base64,...' }
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

  // เรียกใช้งานฟังก์ชันทั้งหมดเมื่อโหลดหน้าเว็บเสร็จ
  setupDropdowns();
  setupMobileMenu();
  setupTabs();
  setupForms();
});
