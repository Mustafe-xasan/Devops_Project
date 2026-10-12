document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Elements ---------- */
  const navbar = document.getElementById("navbar");
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");
  const links = navLinks.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section[id]");
  const yearEl = document.getElementById("year");

  /* ---------- 1. Mobile menu toggle ---------- */
  const closeMenu = () => {
    navLinks.classList.remove("open");
    hamburger.classList.remove("active");
    hamburger.setAttribute("aria-expanded", "false");
  };

  hamburger.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    hamburger.classList.toggle("active", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", (e) => {
    if (
      navLinks.classList.contains("open") &&
      !navLinks.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  /* ---------- 2. Navbar background on scroll ---------- */
  const handleScroll = () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
  };
  handleScroll();
  window.addEventListener("scroll", handleScroll, { passive: true });

  /* ---------- 3. Active nav link based on scroll position ---------- */
  const setActiveLink = (id) => {
    links.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    });
  };

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveLink(entry.target.id);
      });
    },
    {
      rootMargin: "-45% 0px -50% 0px",
      threshold: 0,
    }
  );

  sections.forEach((section) => sectionObserver.observe(section));

  /* ---------- 4. Reveal-on-scroll animation ---------- */
  const revealEls = document.querySelectorAll(".reveal");

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add("visible"), i * 90);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
  );

  revealEls.forEach((el) => revealObserver.observe(el));

  /* ---------- 5. Current year in footer ---------- */
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- 5b. Prevent selecting past dates ---------- */
  const dateInput = document.getElementById("res-date");
  if (dateInput) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    dateInput.min = today;
    dateInput.addEventListener("change", () => {
      if (dateInput.value && dateInput.value < today) {
        dateInput.value = "";
        dateInput.setCustomValidity("Please choose today or a future date");
      } else {
        dateInput.setCustomValidity("");
      }
    });
  }

  /* ---------- 6. Newsletter form ---------- */
  const newsletterForm = document.getElementById("newsletterForm");
  const newsletterMsg = document.getElementById("newsletterMsg");

  if (newsletterForm) {
    const newsletterBtn = newsletterForm.querySelector("button[type='submit']");

    newsletterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector("input[name='email']");
      const email = emailInput.value.trim();

      if (!email || newsletterBtn.disabled) return;

      newsletterBtn.disabled = true;
      newsletterMsg.textContent = "Sending...";

      try {
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();

        if (res.ok) {
          newsletterMsg.textContent = data.message || "Thanks for subscribing!";
          newsletterForm.reset();
        } else {
          newsletterMsg.textContent = data.error || "Something went wrong.";
        }
      } catch (err) {
        console.error(err);
        newsletterMsg.textContent = "Network error. Please try again.";
      } finally {
        newsletterBtn.disabled = false;
      }

      setTimeout(() => {
        newsletterMsg.textContent = "";
      }, 5000);
    });
  }

  /* ---------- 7. Reservation form ---------- */
  const reservationForm = document.getElementById("reservationForm");
  const reservationMsg = document.getElementById("reservationMsg");

  if (reservationForm) {
    const submitBtn = reservationForm.querySelector("button[type='submit']");

    reservationForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (submitBtn.disabled) return;

      const formData = new FormData(reservationForm);
      const payload = Object.fromEntries(formData.entries());

      if (!payload.name || !payload.email || !payload.date || !payload.time || !payload.guests) {
        reservationMsg.textContent = "Please fill in all required fields.";
        return;
      }

      submitBtn.disabled = true;
      reservationMsg.textContent = "Sending...";

      try {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, guests: Number(payload.guests) }),
        });

        const data = await res.json();

        if (res.ok) {
          reservationMsg.textContent = data.message || "Reservation confirmed!";
          reservationForm.reset();
        } else {
          reservationMsg.textContent = data.error || "Something went wrong.";
        }
      } catch (err) {
        console.error(err);
        reservationMsg.textContent = "Network error. Please try again.";
      } finally {
        submitBtn.disabled = false;
      }

      setTimeout(() => {
        reservationMsg.textContent = "";
      }, 6000);
    });
  }
});