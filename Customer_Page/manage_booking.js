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


function normalizeTime(value) {
    if (!value) return "";

    const time = value.trim().toUpperCase();
    const match = time.match(
        /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/
    );

    if (!match) return "";

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3];

    if (minutes > 59 || hours > 23) return "";

    if (period) {
        if (hours < 1 || hours > 12) return "";
        if (period === "AM" && hours === 12) hours = 0;
        else if (period === "PM" && hours !== 12) hours += 12;
    }

    if (hours < 8 || hours > 20) return "";
    if (hours === 20 && minutes > 0) return "";

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDisplayTime(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return value || "";

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return value;

    const period = hours < 12 ? "AM" : "PM";
    const hours12 = hours % 12 || 12;

    return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}


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
        formatDisplayTime(appointment.time) || "-";


    barberName.textContent =
        appointment.barber || "Not assigned";

    if (contactDetails) {
    contactDetails.textContent =
        appointment.contactNumber || "-";
    }


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


    editTime.value = normalizeTime(appointment.time);



    localStorage.setItem(
        "reservation",
        JSON.stringify(appointment)
    );

}





function getAppointmentId() {
    const params = new URLSearchParams(window.location.search);

    return (
        params.get("id") ||
        localStorage.getItem("lastBookingId")
    );

}

function getManageToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
}

// ===============================
// FETCH APPOINTMENT
// ===============================

async function fetchAppointment() {
    const appointmentId = getAppointmentId();
    const token = getManageToken();

    if (!appointmentId || !token) {
        showMessage(
            "Invalid or missing booking management link. Please use the link from your booking confirmation email.",
            "error"
        );

        return;

    }

    try {
        const response = await fetch(
            `${API_BASE}/${encodeURIComponent(appointmentId)}`,
            {
                method: "GET",
                headers: {
                    "X-Manage-Token": token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to verify booking access.");
        }

        const data = await response.json();
        renderAppointment(data);

    } catch (error) {
        console.error("Fetch appointment error:", error);

        showMessage(
            "Unable to load this booking. Please check your management link and try again.",
            "error"
        );

    }

}





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
                    "Content-Type":"application/json",
                     "X-Manage-Token": getManageToken()
                },


                body: JSON.stringify({
                date: updatePayload.date,
                time: updatePayload.time,
                service: updatePayload.service,
                barber: updatePayload.barber
})

            }
        );



        if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
        errorData.message || `Unable to update appointment (${response.status})`
    );
}



        const result =
        await response.json();



        localStorage.setItem(
            "reservation",
            JSON.stringify(result)
        );


        renderAppointment(result);

         return true;



    }catch(error){


        showMessage(
            error.message,
            "error"
        );

          return false;

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

    
const today = new Date();
today.setMinutes(
    today.getMinutes() - today.getTimezoneOffset()
);
const todayString = today.toISOString().slice(0, 10);

if (!editDate.value || editDate.value < todayString) {
    showMessage("Past dates are not allowed.", "error");
    return;
}

const selectedTime = normalizeTime(editTime.value);

if (!selectedTime) {
    showMessage(
        "Please select a time between 8:00 AM and 8:00 PM.",
        "error"
    );
    return;
}

editTime.value = selectedTime;




   const payload = {
    service: editService.value,
    date: editDate.value,
    time: editTime.value
};


    const success = await saveAppointment(payload);

if (!success) {
    return;
}

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



document.getElementById("confirm-cancel-btn")
  .addEventListener("click", async () => {
    const appointmentId = getAppointmentId();

    if (!appointmentId) {
      showMessage("Unable to find this booking.", "error");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel this appointment? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_BASE}/${encodeURIComponent(appointmentId)}`,
        { method: "DELETE", headers: { "X-Manage-Token": getManageToken() } }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to cancel appointment.");
      }


    localStorage.removeItem("reservation");
    localStorage.removeItem("lastBookingId");

    cancelConfirmation.classList.add("hidden");
    actionPanel.style.display = "none";
    changeTimeSection.classList.add("hidden");

    // Update the displayed status
    setStatusBadge("Cancelled");

    cancelledMessage.textContent =
    "Your appointment has been cancelled and removed. You may book again.";
    cancelledMessage.classList.add("show");

    showMessage("Appointment cancelled successfully.", "success");

    } catch (error) {
      console.error("Cancellation error:", error);
      showMessage(error.message, "error");
    }
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