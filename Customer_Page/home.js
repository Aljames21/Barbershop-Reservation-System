
// ===== SMOOTH SCROLL FOR NAVIGATION =====
const primaryNav = document.querySelector(".navlink");
const navMenuToggle = document.querySelector(".nav-menu-toggle");

function setNavigationOpen(isOpen) {
    if (!primaryNav || !navMenuToggle) return;

    primaryNav.classList.toggle("menu-open", isOpen);
    navMenuToggle.setAttribute("aria-expanded", String(isOpen));
    navMenuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation menu" : "Open navigation menu"
    );
}

if (primaryNav && navMenuToggle) {
    navMenuToggle.addEventListener("click", () => {
        const isOpen = navMenuToggle.getAttribute("aria-expanded") === "true";
        setNavigationOpen(!isOpen);
    });

    primaryNav.querySelectorAll(".links a").forEach((link) => {
        link.addEventListener("click", () => setNavigationOpen(false));
    });

    document.addEventListener("click", (event) => {
        if (!primaryNav.contains(event.target)) {
            setNavigationOpen(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            navMenuToggle.getAttribute("aria-expanded") === "true"
        ) {
            setNavigationOpen(false);
            navMenuToggle.focus();
        }
    });

    const desktopViewport = window.matchMedia("(min-width: 901px)");
    const closeNavigationOnDesktop = () => {
        setNavigationOpen(false);
    };

    if (desktopViewport.addEventListener) {
        desktopViewport.addEventListener("change", closeNavigationOnDesktop);
    } else {
        desktopViewport.addListener(closeNavigationOnDesktop);
    }
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
        const target = document.querySelector(link.getAttribute("href"));

        if (!target) {
            return;
        }

        event.preventDefault();

        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        history.pushState(null, "", link.getAttribute("href"));
    });
});


// ===== API URL =====
const API_URL =
    "https://barbershop-reservation-system.onrender.com/api";


// ==================================================
// LOAD SERVICES FROM MONGODB
// ==================================================
async function loadServices() {
    const container = document.getElementById("service-container");

    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/services`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const services = await response.json();

        if (!Array.isArray(services) || services.length === 0) {
            container.innerHTML =
                "<p>No services available right now.</p>";
            return;
        }

        container.innerHTML = services.map((service, index) => {
            const cardClass = `haircut-${(index % 8) + 1}`;

            return `
                <div class="card">
                    <article class="${cardClass}">
                        <div>
                            <h3>${service.name}</h3>
                            <p>${service.description || ""}</p>
                        </div>

                        <div>
                            <p class="price">
                                Starting at
                                <span>₱${service.price}</span>
                            </p>

                            <a href="booking.html?service=${encodeURIComponent(service.name)}">
                                Book <span>Now</span>
                            </a>
                        </div>
                    </article>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Error loading services:", error);

        container.innerHTML =
            "<p>Unable to load services. Please refresh the page.</p>";
    }
}


// ==================================================
// LOAD BARBERS FROM MONGODB
// ==================================================
async function loadBarbers() {
    const container = document.getElementById("team-container");

    if (!container) return;

    // Existing photos used only as fallbacks.
    const barberImageMap = {
        "ian dizon": "images/staff3.jpg",
        "leo ramos cruz": "images/staff2.jpg",
        "mia jose silva": "images/staff1.jpg"
    };

    const fallbackImage = "images/staff1.jpg";

    // Escape text inserted into HTML.
    const escapeHTML = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char]));

    try {
        const response = await fetch(`${API_URL}/barbers`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const barbers = await response.json();

        if (!Array.isArray(barbers) || barbers.length === 0) {
            container.textContent = "No barbers available right now.";
            return;
        }

        const visibleBarbers = barbers.filter((barber) => {
            const status = String(barber.status || "Active")
                .trim()
                .toLowerCase();

            return ["available", "active"].includes(status);
        });

        if (visibleBarbers.length === 0) {
            container.textContent = "No barbers available right now.";
            return;
        }

        container.innerHTML = visibleBarbers.map((barber, index) => {
            const barberName =
                barber.name ||
                barber.fullName ||
                [barber.firstName, barber.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                "Barber";

            const normalizedName = barberName
                .trim()
                .toLowerCase();

            const position =
                barber.position || "Barber Specialist";

            const description =
                barber.specialization ||
                barber.description ||
                barber.specialty ||
                "Professional haircut services.";

            // Cloudinary picture takes priority.
            // Existing local photos remain as fallbacks.
            const candidateImage =
                barber.imageUrl ||
                barberImageMap[normalizedName] ||
                fallbackImage;

            const image = /^(https:\/\/|images\/)[^\s"'<>]+$/i.test(candidateImage)
                ? candidateImage
                : fallbackImage;

            const cardClass = `barber-${(index % 3) + 1}`;

            return `
                <div class="${cardClass}">
                    <div class="barber-pic">
                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(barberName)}"
                            loading="lazy"
                        >
                    </div>

                    <div class="barber-info">
                        <h3>${escapeHTML(barberName)}</h3>
                        <p class="position">${escapeHTML(position)}</p>
                        <p class="details">${escapeHTML(description)}</p>
                    </div>

                    <a
                        href="booking.html?barber=${encodeURIComponent(barberName)}"
                        class="btn-1"
                    >
                        Book Now
                    </a>
                </div>
            `;
        }).join("");

        // Use a fallback if an uploaded picture cannot load.
        container.querySelectorAll(".barber-pic img").forEach((img) => {
            img.addEventListener("error", () => {
                if (!img.src.endsWith(fallbackImage)) {
                    img.src = fallbackImage;
                }
            });
        });

    } catch (error) {
        console.error("Error loading barbers:", error);

        container.textContent =
            "Unable to load barbers. Please refresh the page.";
    }
}   


// ==================================================
// INITIALIZE HOMEPAGE
// ==================================================
loadServices();
loadBarbers();




const feedbackTrack = document.getElementById("feedbackTrack");
const prevButton = document.querySelector(".feedback-arrow.prev");
const nextButton = document.querySelector(".feedback-arrow.next");

function customerInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

function formatFeedbackDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function renderFeedbackCard(feedback) {
  const appointment = feedback.appointment || {};
  const name = appointment.customerName || "Customer";
  const rating = Math.round(
    Math.min(5, Math.max(1, Number(feedback.rating) || 1))
  );

  const card = document.createElement("article");
  card.className = "feedback-card";

  const customer = document.createElement("div");
  customer.className = "feedback-customer";

  const initials = document.createElement("div");
  initials.className = "customer-initials";
  initials.textContent = customerInitials(name);

  const customerDetails = document.createElement("div");
  const customerName = document.createElement("h3");
  customerName.textContent = name;
  const submitted = document.createElement("span");
  submitted.textContent = formatFeedbackDate(feedback.createdAt);
  customerDetails.append(customerName, submitted);
  customer.append(initials, customerDetails);

  const stars = document.createElement("div");
  stars.className = "feedback-stars";
  stars.setAttribute("aria-label", `${rating} out of 5 stars`);
  stars.textContent = `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;

  const comment = document.createElement("p");
  comment.className = "feedback-comment";
  comment.textContent = feedback.comment || "";

  const service = document.createElement("span");
  service.className = "service-tag";
  service.textContent = appointment.service || "Service";

  card.append(customer, stars, comment, service);
  return card;
}

async function loadFeedback() {
  if (!feedbackTrack) return;

  try {
    const response = await fetch(`${API_URL}/feedback`);

    if (!response.ok) {
      throw new Error(`Feedback API error: ${response.status}`);
    }

    const feedback = await response.json();
    feedbackTrack.replaceChildren();

    if (!Array.isArray(feedback) || feedback.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "feedback-empty";
      emptyMessage.textContent = "No customer feedback yet.";
      feedbackTrack.append(emptyMessage);
      return;
    }

    feedback.forEach((item) => {
      feedbackTrack.append(renderFeedbackCard(item));
    });
  } catch (error) {
    console.error("Error loading customer feedback:", error);
    feedbackTrack.replaceChildren();

    const errorMessage = document.createElement("p");
    errorMessage.className = "feedback-empty";
    errorMessage.textContent =
      "Unable to load customer feedback right now.";
    feedbackTrack.append(errorMessage);
  }
}

if (feedbackTrack && prevButton && nextButton) {
  const scrollAmount = () => {
    const card = feedbackTrack.querySelector(".feedback-card");
    return card ? card.getBoundingClientRect().width + 20 : 300;
  };

  nextButton.addEventListener("click", () => {
    feedbackTrack.scrollBy({
      left: scrollAmount(),
      behavior: "smooth"
    });
  });

  prevButton.addEventListener("click", () => {
    feedbackTrack.scrollBy({
      left: -scrollAmount(),
      behavior: "smooth"
    });
  });
}

loadFeedback();


/* AUTOMATIC SERVICE IMAGE GALLERY */

/* AUTOMATIC SERVICE IMAGE GALLERY — NO DUPLICATES */


/* AUTOMATIC GALLERY — ACTIVE SERVICES ONLY */

async function loadServiceGallery() {
    const gallery = document.querySelector(".gallery");
    if (!gallery) return;

    // Match the original HTML cards with their service names.
    const originalHaircuts = [
        { name: "Mullet", className: "card-1" },
        { name: "Classic Haircut", className: "card-2" },
        { name: "Fade", className: "card-3" },
        { name: "Mid Fade", className: "card-4" },
        { name: "Low Fade", className: "card-5" },
        { name: "High Fade", className: "card-6" },
        { name: "Burst Fade", className: "card-7" },
        { name: "Semi-Kalbo", className: "card-8" },
        { name: "Buzz Cut", className: "card-9" }
    ];

    const normalizeName = name =>
        String(name || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");

    try {
        const response = await fetch(`${API_URL}/services`);

        if (!response.ok) {
            throw new Error("Unable to load gallery services.");
        }

        const services = await response.json();

        if (!Array.isArray(services)) {
            throw new Error("Invalid services data.");
        }

        // The public API returns only active,
        // non-archived services.
        const activeNames = new Set(
            services.map(service => normalizeName(service.name))
        );

        // Show or hide original gallery cards.
        originalHaircuts.forEach(haircut => {
            const card = gallery.querySelector(
                "." + haircut.className
            );

            if (!card) return;

            const isActive = activeNames.has(
                normalizeName(haircut.name)
            );

            card.style.display = isActive ? "flex" : "none";
        });

        // Remove previously generated dynamic cards.
        gallery.querySelectorAll(".dynamic-gallery-card")
            .forEach(card => card.remove());

        // Avoid duplicate haircut names.
        const originalNames = new Set(
            originalHaircuts.map(haircut =>
                normalizeName(haircut.name)
            )
        );

        const addedNames = new Set(originalNames);

        services.forEach(service => {
            if (!service.name || !service.imageUrl) return;

            if (
                typeof service.imageUrl !== "string" ||
                !/^https:\/\//i.test(service.imageUrl)
            ) return;

            const normalized = normalizeName(service.name);

            if (addedNames.has(normalized)) return;

            const card = document.createElement("div");
            card.className = "dynamic-gallery-card";

            card.style.backgroundImage =
                `url("${service.imageUrl}")`;

            const title = document.createElement("h4");
            title.textContent = service.name;

            card.appendChild(title);
            gallery.appendChild(card);

            addedNames.add(normalized);
        });

    } catch (error) {
        console.error("Gallery loading error:", error);
    }
}


document.addEventListener("DOMContentLoaded", loadServiceGallery);
