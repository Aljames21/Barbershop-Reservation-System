
const serviceCatalog = new Map();
const serviceSelect = document.getElementById("service");

const barbers = [
    "Mia Jose Silva",
    "Leo Ramos Cruz",
    "Ian Dizon"
];


const form = document.getElementById("booking-form");

const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

const summaryMessage = document.getElementById("summary-message");
const summaryDetails = document.getElementById("summary-details");

const barberDisplay = document.getElementById("barber-selection");
const barberName = document.getElementById("selected-barber");


// GET BARBER FROM URL
const requestedBarber = new URLSearchParams(window.location.search)
.get("barber");


const selectedBarber = barbers.includes(requestedBarber)
    ? requestedBarber
    : "";


const today = new Date();

today.setMinutes(
    today.getMinutes() - today.getTimezoneOffset()
);

dateInput.min = today.toISOString().slice(0,10);



if(selectedBarber){

    barberName.textContent = selectedBarber;
    barberDisplay.hidden = false;

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
        const response = await fetch("http://localhost:5000/api/services");

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





// SUBMIT BOOKING

form.addEventListener("submit", function(event){

    event.preventDefault();


    const serviceDetails = updateReservationSummary();


    if(!serviceDetails){

        serviceSelect.focus();

        return;

    }



    const reservation = {


        customerName:
        document.getElementById("name").value,


        contactNumber:
        document.getElementById("contact").value,


        service:
        serviceSelect.value,

        price:
        serviceDetails.price,

        barber:
        selectedBarber,


        date:
        document.getElementById("date").value,


        time:
        document.getElementById("time").value,


        message:
        document.getElementById("message").value,
        status:"Pending"
    };



    console.log("Sending:", reservation);
    // SEND TO MONGODB

    fetch("http://localhost:5000/api/appointments",{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify(reservation)
    })
    .then(res=>res.json())
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
        console.log("Error:",error);
        
    });

});