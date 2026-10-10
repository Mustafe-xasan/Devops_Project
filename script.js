/* =========================================================
   Saffron & Co. — Main Script
   ========================================================= */

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

  // Close menu when any nav link is clicked
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Close menu when clicking outside of it
  document.addEventListener("click", (e) => {
    if (
      navLinks.classList.contains("open") &&
      !navLinks.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      closeMenu();
    }
  });

  // Close menu on Escape key
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
          // small stagger for grouped items
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

  /* ---------- 6. Newsletter form (demo only) ---------- */
  const form = document.getElementById("newsletterForm");
  const formMsg = document.getElementById("formMsg");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector("input").value.trim();

      if (!email) return;

      formMsg.textContent = `Thanks! ${email} is on the list. 🍽️`;
      form.reset();

      setTimeout(() => {
        formMsg.textContent = "";
      }, 4000);
    });
  }
});