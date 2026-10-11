const API_BASE = "https://barbershop-reservation-system.onrender.com/api/appointments";
const SERVICE_API = "https://barbershop-reservation-system.onrender.com/api/services";


const statusMessage = document.getElementById("status-message");
const statusBadge = document.getElementById("booking-status");

const customerName = document.getElementById("customer-name");
const serviceName = document.getElementById("service-name");
const bookingDate = document.getElementById("booking-date");
const bookingTime = document.getElementById("booking-time");
const barberName = document.getElementById("barber-name");
const contactDetails = document.getElementById("contact-details");
const bookingMessage = document.getElementById("booking-message");


const changeTimeBtn = document.getElementById("change-time-btn");
const cancelBookingBtn = document.getElementById("cancel-booking-btn");

const actionPanel = document.getElementById("action-panel");
const cancelledMessage = document.getElementById("cancelled-message");

const changeTimeSection = document.getElementById("change-time-section");
const cancelConfirmation = document.getElementById("cancel-confirmation");

const changeTimeForm = document.getElementById("change-time-form");

const editService = document.getElementById("edit-service");
const editDate = document.getElementById("edit-date");
const editTime = document.getElementById("edit-time");


let currentAppointment = null;


// ===============================
// MESSAGE
// ===============================

function showMessage(text, type="success") {

    statusMessage.textContent = text;
    statusMessage.className = "status-message show " + type;

}


function hideMessage(){

    statusMessage.textContent="";
    statusMessage.className="status-message";

}



// ===============================
// STATUS
// ===============================

function setStatusBadge(status){

    statusBadge.textContent = status;

    statusBadge.classList.toggle(
        "cancelled",
        status.toLowerCase() === "cancelled"
    );

}



// ===============================
// LOAD SERVICES FROM DATABASE
// ===============================

async function loadServices(){

    try{

        const response = await fetch(SERVICE_API);

        const services = await response.json();


        editService.innerHTML = `
            <option value="">
                Select a service
            </option>
        `;


        services.forEach(service=>{

            editService.innerHTML += `
                <option value="${service.name}">
                    ${service.name} - ₱${service.price}
                </option>
            `;

        });


    }catch(error){

        console.log(
            "Service loading error:",
            error
        );

    }

}



// ===============================
// DISPLAY APPOINTMENT
// ===============================

function renderAppointment(appointment){

    currentAppointment = appointment;


    customerName.textContent =
        appointment.customerName || "Unknown customer";


    serviceName.textContent =
        appointment.service || "-";


    bookingDate.textContent =
        appointment.date || "-";


    bookingTime.textContent =
        appointment.time || "-";


    barberName.textContent =
        appointment.barber || "Not assigned";


    contactDetails.textContent =
        appointment.contactNumber || "-";


    bookingMessage.textContent =
        appointment.message || "None";



    const status =
        appointment.status || "Pending";


    setStatusBadge(status);



    if(status.toLowerCase() === "cancelled"){


        actionPanel.style.display="none";

        changeTimeSection.classList.add("hidden");

        cancelConfirmation.classList.add("hidden");


        cancelledMessage.textContent =
        `This appointment was cancelled. You are welcome to book again any time.`;


        cancelledMessage.classList.add("show");


        changeTimeBtn.disabled=true;
        cancelBookingBtn.disabled=true;



    }else{


        actionPanel.style.display="grid";

        cancelledMessage.classList.remove("show");

        cancelledMessage.textContent="";


        changeTimeBtn.disabled=false;

        cancelBookingBtn.disabled=false;


    }



    editService.value =
        appointment.service || "";


    editDate.value =
        appointment.date || "";


    editTime.value =
        appointment.time || "";



    localStorage.setItem(
        "reservation",
        JSON.stringify(appointment)
    );

}



// ===============================
// GET APPOINTMENT ID
// ===============================

function getAppointmentId(){

    const params =
    new URLSearchParams(
        window.location.search
    );


    return (
        params.get("id") ||
        localStorage.getItem("lastBookingId")
    );

}



// ===============================
// FETCH APPOINTMENT
// ===============================

async function fetchAppointment(){

    const appointmentId =
        getAppointmentId();



    if(!appointmentId){

        const saved =
        JSON.parse(
            localStorage.getItem("reservation") || "null"
        );


        if(saved){

            renderAppointment(saved);

            return;

        }


        showMessage(
            "No booking was found to manage.",
            "error"
        );


        return;

    }



    try{


        const response =
        await fetch(
            `${API_BASE}/${appointmentId}`
        );



        if(!response.ok){

            throw new Error(
                "Appointment not found"
            );

        }



        const data =
        await response.json();


        renderAppointment(data);



    }catch(error){


        showMessage(
            "Unable to load this booking right now.",
            "error"
        );


    }

}



// ===============================
// UPDATE APPOINTMENT
// ===============================

async function saveAppointment(updatePayload){


    const appointmentId =
        getAppointmentId();



    const updated = {

        ...currentAppointment,

        ...updatePayload

    };



    localStorage.setItem(
        "reservation",
        JSON.stringify(updated)
    );



    if(!appointmentId){

        renderAppointment(updated);

        return;

    }



    try{


        const response =
        await fetch(
            `${API_BASE}/${appointmentId}`,
            {

                method:"PUT",

                headers:{
                    "Content-Type":"application/json"
                },


                body:
                JSON.stringify(updated)

            }
        );



        if(!response.ok){

            throw new Error(
                "Unable to update appointment"
            );

        }



        const result =
        await response.json();



        localStorage.setItem(
            "reservation",
            JSON.stringify(result)
        );


        renderAppointment(result);



    }catch(error){


        showMessage(
            error.message,
            "error"
        );

    }

}



// ===============================
// BUTTON EVENTS
// ===============================


changeTimeBtn.addEventListener(
"click",
()=>{

    changeTimeSection.classList.remove(
        "hidden"
    );

    cancelConfirmation.classList.add(
        "hidden"
    );

});



cancelBookingBtn.addEventListener(
"click",
()=>{

    cancelConfirmation.classList.remove(
        "hidden"
    );

    changeTimeSection.classList.add(
        "hidden"
    );

});



document
.getElementById("cancel-edit-btn")
.addEventListener(
"click",
()=>{

    changeTimeSection.classList.add(
        "hidden"
    );

});



document
.getElementById("keep-booking-btn")
.addEventListener(
"click",
()=>{

    cancelConfirmation.classList.add(
        "hidden"
    );

});



// ===============================
// CHANGE TIME SUBMIT
// ===============================


changeTimeForm.addEventListener(
"submit",
async(e)=>{

    e.preventDefault();



    const payload={

        service:
        editService.value,


        date:
        editDate.value,


        time:
        editTime.value,


        status:
        currentAppointment.status || "Pending"

    };



    await saveAppointment(payload);



    showMessage(
        "Appointment updated successfully.",
        "success"
    );



    changeTimeSection.classList.add(
        "hidden"
    );


});


// ===============================
// CANCEL APPOINTMENT
// ===============================


document
.getElementById("confirm-cancel-btn")
.addEventListener(
"click",
async()=>{


    const payload={

        status:"Cancelled",

        cancelledAt:
        new Date().toISOString()

    };


    cancelConfirmation.classList.add(
        "hidden"
    );


    await saveAppointment(payload);



    showMessage(
        "Appointment cancelled successfully.",
        "success"
    );


});



// ===============================
// DATE LIMIT
// ===============================

function setDateMin(){

    const today =
    new Date();


    today.setMinutes(
        today.getMinutes() -
        today.getTimezoneOffset()
    );


    editDate.min =
    today.toISOString()
    .slice(0,10);

}

// ===============================
// INITIALIZE
// ===============================

setDateMin();

loadServices();

fetchAppointment();