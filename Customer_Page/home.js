
// ===== SMOOTH SCROLL FOR NAVIGATION =====
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

    // Map each barber name to the correct existing photo.
    // Make sure each filename matches the actual photo.
    const barberImageMap = {
        "ian dizon": "images/staff3.jpg",
        "leo ramos cruz": "images/staff2.jpg",
        "mia jose silva": "images/staff1.jpg"
    };

    try {
        const response = await fetch(`${API_URL}/barbers`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const barbers = await response.json();

        if (!Array.isArray(barbers) || barbers.length === 0) {
            container.innerHTML =
                "<p>No barbers available right now.</p>";
            return;
        }

        // Show only barbers who can currently be selected.
        // "Active" is retained for compatibility with older records.
        const visibleBarbers = barbers.filter((barber) => {
            const status = String(barber.status || "Active")
                .trim()
                .toLowerCase();

            return ["available", "active"].includes(status);
        });

        if (visibleBarbers.length === 0) {
            container.innerHTML =
                "<p>No barbers available right now.</p>";
            return;
        }

        container.innerHTML = visibleBarbers.map((barber, index) => {
            const barberName =
                barber.name ||
                barber.fullName ||
                [
                    barber.firstName,
                    barber.lastName
                ].filter(Boolean).join(" ") ||
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

            // Match photos by barber name, not database order.
            const image =
                barberImageMap[normalizedName] ||
                "images/staff1.jpg";

            const cardClass = `barber-${(index % 3) + 1}`;

            return `
                <div class="${cardClass}">
                    <div class="barber-pic">
                        <img
                            src="${image}"
                            alt="${barberName}"
                            onerror="this.onerror=null;this.src='images/staff1.jpg';"
                        >
                    </div>

                    <div class="barber-info">
                        <h3>${barberName}</h3>
                        <p class="position">${position}</p>
                        <p class="details">${description}</p>
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

    } catch (error) {
        console.error("Error loading barbers:", error);

        container.innerHTML =
            "<p>Unable to load barbers. Please refresh the page.</p>";
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
      emptyMessage.textContent = "No approved customer feedback yet.";
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
