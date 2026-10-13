const reservationData = localStorage.getItem("reservation");
let reservation = null;

try {
    reservation = reservationData ? JSON.parse(reservationData) : null;
} catch (error) {
    console.error("Failed to parse reservation from localStorage:", error);
}

console.log(reservation);

if (reservation) {

    document.getElementById("display-name").textContent = 
        reservation.customerName;

   document.getElementById("display-contact").textContent =
    reservation.email || reservation.contactNumber || "";

    document.getElementById("display-service").textContent =
        reservation.service;

    if (reservation.barber) {
        document.getElementById("display-barber").textContent =
            reservation.barber;
        document.getElementById("display-barber-row").hidden = false;
    }

    document.getElementById("display-date").textContent =
        reservation.date;

    document.getElementById("display-time").textContent =
        reservation.time;

    document.getElementById("display-message").textContent =
        reservation.message || "None";

    
    const manageLink = document.getElementById("manage-booking-link");

    const appointmentId =
        reservation._id || localStorage.getItem("lastBookingId");

    const manageToken = reservation.manageToken || "";

    if (manageLink) {
        if (appointmentId && manageToken) {
            manageLink.href =
                `manage_booking.html?id=${encodeURIComponent(appointmentId)}&token=${encodeURIComponent(manageToken)}`;
        } else {
            manageLink.href = "#";
            manageLink.addEventListener("click", (event) => {
                event.preventDefault();
                alert("Please use the Manage Booking link from your confirmation email.");
            });
        }
    }


}