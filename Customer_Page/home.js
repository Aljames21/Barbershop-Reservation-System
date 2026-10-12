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


const API_URL = "https://barbershop-reservation-system.onrender.com/api";

// GET SERVICES FROM MONGODB
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
            container.innerHTML = "<p>No services available right now.</p>";
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
                                Starting at <span>₱${service.price}</span>
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

loadServices();



/* ===== LOAD BARBERS FROM MONGODB ===== */

async function loadBarbers() {
    const container = document.getElementById("team-container");


    if (!container) return;


    // Panatilihin ang existing barber photos.
    const barberImages = [
        "images/staff1.jpg",
        "images/staff2.jpg",
        "images/staff3.jpg"
    ];

    try {
        const response = await fetch(
            "https://barbershop-reservation-system.onrender.com/api/barbers"
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const barbers = await response.json();

        if (!Array.isArray(barbers) || barbers.length === 0) {
            container.innerHTML = "<p>No barbers available right now.</p>";
            return;
        }

        const visibleBarbers = barbers.filter((barber) => {
            const name =
                barber.name ||
                barber.fullName ||
                [barber.firstName, barber.lastName].filter(Boolean).join(" ") ||
                "";

            return !["test", "janry", "neil feliciano", "janr"].includes(
                name.trim().toLocaleLowerCase()
            );
        });

        if (visibleBarbers.length === 0) {
            container.innerHTML = "<p>No barbers available right now.</p>";
            return;
        }

        container.innerHTML = visibleBarbers.map((barber, index) => {
            const barberName =
                barber.name ||
                barber.fullName ||
                [barber.firstName, barber.lastName].filter(Boolean).join(" ") ||
                "Barber";

            
            const position = barber.position || "Barber Specialist";
            const description =
                barber.specialization || barber.description ||
                barber.specialty || "Professional haircut services.";


            const image = barber.image || barberImages[index % barberImages.length];
            const cardClass = `barber-${(index % 3) + 1}`;

            return `
                <div class="${cardClass}">
                    <div class="barber-pic">
                        <img src="${image}" alt="${barberName}"
                             onerror="this.onerror=null;this.src='images/staff1.jpg';">
                    </div>

                    <div class="barber-info">
                        <h3>${barberName}</h3>
                        <p class="position">${position}</p>
                        <p class="details">${description}</p>
                    </div>

                    <a href="booking.html?barber=${encodeURIComponent(barberName)}"
                       class="btn-1">Book Now</a>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Error loading barbers:", error);
        container.innerHTML =
            "<p>Unable to load barbers. Please refresh the page.</p>";
    }
}


loadBarbers();
