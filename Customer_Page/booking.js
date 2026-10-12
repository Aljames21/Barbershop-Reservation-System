
const serviceCatalog = new Map();
const serviceSelect = document.getElementById("service");

const API_URL = "https://barbershop-reservation-system.onrender.com/api";


let barbers = [];
let selectedBarber = "";


const form = document.getElementById("booking-form");

const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const availableTimeSlots = new Set();

function populateTimeOptions() {
    timeInput.replaceChildren(new Option("Select a time", ""));

    for (let minutes = 8 * 60; minutes < 20 * 60; minutes += 30) {
        const hours24 = Math.floor(minutes / 60);
        const minutesInHour = minutes % 60;
        const hours12 = hours24 % 12 || 12;
        const period = hours24 < 12 ? "AM" : "PM";
        const value =
            `${String(hours24).padStart(2, "0")}:${String(minutesInHour).padStart(2, "0")}`;
        const label =
            `${String(hours12).padStart(2, "0")}:${String(minutesInHour).padStart(2, "0")} ${period}`;

        availableTimeSlots.add(value);
        timeInput.add(new Option(label, value));
    }
}

populateTimeOptions();
timeInput.addEventListener("change", () => timeInput.setCustomValidity(""));

function setDateMin() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    dateInput.min = today.toISOString().slice(0, 10);
}

setDateMin();
dateInput.addEventListener("focus", setDateMin);

const summaryMessage = document.getElementById("summary-message");
const summaryDetails = document.getElementById("summary-details");

const barberDisplay = document.getElementById("barber-selection");
const barberName = document.getElementById("selected-barber");


 // GET BARBER FROM URL
const requestedBarber = new URLSearchParams(window.location.search)
    .get("barber");

async function loadBarbers() {
    try {
        const response = await fetch(`${API_URL}/barbers`);

        if (!response.ok) {
            throw new Error(`Barber request failed (${response.status})`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("The barber API returned an invalid response.");
        }

        // Kunin ang mga pangalan mula sa backend
        barbers = data
            .map((barber) => barber?.name?.trim())
            .filter(Boolean);

        // Tanggapin lamang ang barber name na nasa database
        selectedBarber = barbers.find(
            (name) =>
                name.toLocaleLowerCase() ===
                (requestedBarber || "").trim().toLocaleLowerCase()
        ) || "";

        // Ipakita ang barber kung may valid na preselection
        if (selectedBarber) {
            barberName.textContent = selectedBarber;
            barberDisplay.hidden = false;
        } else {
            barberDisplay.hidden = true;
        }

    } catch (error) {
        console.error("Barber loading error:", error);
        selectedBarber = "";
        barberDisplay.hidden = true;
    }
}


function updateReservationSummary(){

    const selectedService = serviceSelect.value;

    const details = serviceCatalog.get(selectedService);


    if(!selectedService || !details){   

        summaryMessage.hidden = false;
        summaryDetails.hidden = true;

        return null;
    }


    document.getElementById("summary-service")
    .textContent = selectedService;


    document.getElementById("summary-price")
    .textContent = `₱${details.price}`;


    summaryMessage.hidden = true;
    summaryDetails.hidden = false;


    return details;

}



serviceSelect.addEventListener(
"change",
updateReservationSummary
);

async function loadServices() {
    try {
        const response = await fetch(`${API_URL}/services`);

        if (!response.ok) {
            throw new Error(`Service request failed (${response.status})`);
        }

        const services = await response.json();

        if (!Array.isArray(services)) {
            throw new Error("The service API returned an invalid response.");
        }

        serviceSelect.replaceChildren(new Option("Select a service", ""));
        serviceCatalog.clear();

        services.forEach((service) => {
            if (!service || typeof service.name !== "string" || !service.name.trim()) {
                return;
            }

            const name = service.name.trim();
            const price = Number(service.price);

            serviceCatalog.set(name, {
                price: Number.isFinite(price) ? price : 0
            });

            serviceSelect.add(new Option(
                `${name} - ₱${Number.isFinite(price) ? price : 0}`,
                name
            ));
        });

        if (serviceCatalog.size === 0) {
            serviceSelect.replaceChildren(new Option("No services available", ""));
            summaryMessage.textContent = "There are no services available to book right now.";
            summaryMessage.hidden = false;
            summaryDetails.hidden = true;
            return;
        }

        const requestedService = new URLSearchParams(window.location.search)
            .get("service");
        const matchingService = [...serviceSelect.options].find((option) =>
            option.value.trim().toLocaleLowerCase() ===
            (requestedService || "").trim().toLocaleLowerCase()
        );

        if (matchingService) {
            serviceSelect.value = matchingService.value;
        }

        updateReservationSummary();
    } catch (error) {
        console.error("Service loading error:", error);
        serviceSelect.replaceChildren(
            new Option("Services unavailable — check server and refresh", "")
        );
        summaryMessage.textContent =
            "Unable to load services. Make sure the backend server and database are running, then refresh this page.";
        summaryMessage.hidden = false;
        summaryDetails.hidden = true;
    }
}

updateReservationSummary();
loadServices();
loadBarbers();




// SUBMIT BOOKING

form.addEventListener("submit", function(event){

    event.preventDefault();

    setDateMin();
    if (!form.reportValidity()) {
        return;
    }

    if (!availableTimeSlots.has(timeInput.value)) {
        timeInput.setCustomValidity("Please select a time between 8:00 AM and 8:00 PM.");
        timeInput.reportValidity();
        return;
    }

    timeInput.setCustomValidity("");

    const serviceDetails = updateReservationSummary();


    if(!serviceDetails){

        serviceSelect.focus();

        return;

    }



   const reservation = {
    customerName: document.getElementById("name").value.trim(),
    email: document.getElementById("contact").value.trim(),
    service: serviceSelect.value,
    price: serviceDetails.price,
    barber: selectedBarber,
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    message: document.getElementById("message").value,
    status: "Pending"
};


    console.log("Sending:", reservation);
    // SEND TO MONGODB

    fetch(`${API_URL}/appointments`,{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify(reservation)
    })
    .then(async (res) => {
    const data = await res.json();

    if (!res.ok || !data._id) {
        throw new Error(
            data.message || "Unable to save appointment."
        );
    }

    return data;
})
    .then(data=>{

    console.log("Saved:", data);

    const savedReservation = {
        ...reservation,
        _id: data._id || data.id
    };

    // Save for receipt display
    localStorage.setItem(
        "reservation",
        JSON.stringify(savedReservation)
    );
    localStorage.setItem("lastBookingId", savedReservation._id || "");

    alert("Appointment Saved!");

    window.location.href =
    "display_info.html";


})

    .catch(error=>{
        console.error("Booking error:", error);
        alert("Unable to save your appointment. Please try again.");
    });

});