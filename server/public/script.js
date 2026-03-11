const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    siteNav.classList.toggle("open");
  });
}

const filterButtons = document.querySelectorAll(".filter-btn");
const productCards = document.querySelectorAll(".product-card");

if (filterButtons.length > 0 && productCards.length > 0) {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.filter;

      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      productCards.forEach((card) => {
        if (category === "all" || card.dataset.category === category) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
}

const contactForm = document.getElementById("contactForm");
const contactNotice = document.getElementById("contactNotice");

if (contactForm && contactNotice) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    contactNotice.textContent =
      "Thanks! Your message is saved on this page version. We can connect this to email next.";
    contactForm.reset();
  });
}
