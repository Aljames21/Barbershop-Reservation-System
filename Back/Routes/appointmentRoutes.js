const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const juice = require("juice");
const transporter = require("../email");
const Appointment = require("../Models/Appointment");
const verifyAdmin = require("../Middleware/authMiddleware");

function validateAppointmentDateTime(dateValue, timeValue) {
    // Require a valid YYYY-MM-DD date
    if (
        typeof dateValue !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
        return "Please provide a valid appointment date.";
    }

    const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== dateValue
    ) {
        return "Please provide a valid appointment date.";
    }

    // Use Philippine local date, not the Render server's timezone
    const todayInPH = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

    if (dateValue < todayInPH) {
        return "Past dates are not allowed.";
    }

    // Accept either 24-hour time (13:00) or 12-hour time (01:00 PM)
    if (typeof timeValue !== "string") {
        return "Please select a time between 8:00 AM and 8:00 PM.";
    }

    const match = timeValue.trim().match(
        /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i
    );

    if (!match) {
        return "Please select a valid appointment time.";
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3]?.toUpperCase();

    if (minutes > 59) {
        return "Please select a valid appointment time.";
    }

    if (period) {
        if (hours < 1 || hours > 12) {
            return "Please select a valid appointment time.";
        }

        if (period === "AM" && hours === 12) {
            hours = 0;
        } else if (period === "PM" && hours !== 12) {
            hours += 12;
        }
    } else if (hours > 23) {
        return "Please select a valid appointment time.";
    }

    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes < 480 || totalMinutes > 1200) {
        return "Appointments are only allowed between 8:00 AM and 8:00 PM.";
    }

    return null;
}

const appointmentEmailTemplate = fs.readFileSync(
    path.join(__dirname, "../Templates/appointment-confirmation.html"),
    "utf8"
);
const appointmentEmailCss = fs.readFileSync(
    path.join(__dirname, "../Templates/appointment-confirmation.css"),
    "utf8"
);

const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);

const renderAppointmentEmail = (values) =>
    appointmentEmailTemplate.replace(/{{(\w+)}}/g, (placeholder, key) => {
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
            throw new Error(`Unknown appointment email placeholder: ${key}`);
        }

        return values[key];
    });


// GET APPOINTMENTS

router.get("/", verifyAdmin, async(req,res)=>{

try{

const appointments = await Appointment.find();

res.json(appointments);


}catch(error){

res.status(500).json({
message:error.message
});

}

});


// GET APPOINTMENT BY ID
router.get("/:id", async(req,res)=>{    
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// CREATE APPOINTMENT

router.post("/", async(req,res)=>{

    console.log("POST APPOINTMENT RECEIVED");
    console.log(req.body);


try{

const customerAppUrl = process.env.CUSTOMER_APP_URL?.trim();
let appBaseUrl = null;

if (customerAppUrl) {
    appBaseUrl = new URL(`${customerAppUrl.replace(/\/+$/, "")}/`);
    const isLocalHttp = appBaseUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(appBaseUrl.hostname);

    if (appBaseUrl.protocol !== "https:" && !isLocalHttp) {
        throw new Error("CUSTOMER_APP_URL must use HTTPS, except for localhost development.");
    }
}

const dateTimeError = validateAppointmentDateTime(
    req.body.date,
    req.body.time
);

if (dateTimeError) {
    return res.status(400).json({
        message: dateTimeError
    });
}

const appointment = new Appointment(req.body);


const saved = await appointment.save();

const customerName = escapeHtml(saved.customerName || "there");
const service = escapeHtml(saved.service || "Appointment");
const barber = escapeHtml(saved.barber || "To be assigned");
const date = escapeHtml(saved.date || "To be determined");
const time = escapeHtml(saved.time || "To be determined");
const price = `₱${Number(saved.price || 0).toLocaleString("en-PH")}`;
let manageBookingUrl = "";

if (appBaseUrl) {
    manageBookingUrl = new URL(
        `Customer_Page/manage_booking.html?id=${encodeURIComponent(saved._id)}`,
        appBaseUrl
    ).toString();
} else {
    console.warn("CUSTOMER_APP_URL is not configured; the manage-booking button will be omitted.");
}

const manageBookingButton = manageBookingUrl
    ? `<h2 class="email-manage-heading">
        Need to make changes?
    </h2>
    <p class="email-manage-copy">
        Manage or cancel your appointment using the link below
    </p>
    <a class="email-manage-button" href="${escapeHtml(manageBookingUrl)}">
        Manage this booking
    </a>`
    : `<p class="email-manage-unavailable">
        Online booking management will be available when our website is live.
    </p>`;

console.log("Sending booking email to:", saved.email);
try {
    
    

const info = await transporter.sendMail({
    from: `"Sañado's Barbershop" <${process.env.EMAIL_USER}>`,
    to: saved.email,
    subject: "Sañado's Barbershop — Appointment Received",

    text:
        `Hi ${saved.customerName || "there"},\n\n` +
        "We have received your appointment request at Sañado's Barbershop.\n\n" +
        `Service: ${saved.service || "Appointment"}\n` +
        `Date: ${saved.date || "To be determined"}\n` +
        `Time: ${saved.time || "To be determined"}\n` +
        `Barber: ${saved.barber || "To be assigned"}\n` +
        `Price: ${price}\n\n` +
        (manageBookingUrl
            ? `Manage this booking: ${manageBookingUrl}\n\n`
            : "") +
        "Thank you for choosing Sañado's Barbershop.",

    html: juice(
        renderAppointmentEmail({
            customerName,
            service,
            barber,
            date,
            time,
            price: escapeHtml(price),   
            manageBookingButton
        }).replace(
            '<link rel="stylesheet" href="appointment-confirmation.css">',
            ""
        ),
        { extraCss: appointmentEmailCss }
    )
});

console.log("Booking confirmation sent:", info.messageId);


} catch (emailError) {
    console.error("BOOKING EMAIL FAILED");
    console.error("Error code:", emailError.code);
    console.error("Error response:", emailError.response);
    console.error("Error message:", emailError.message);
}



res.json(saved);


} catch (error) {
    console.error("Appointment creation error:", error);

    res.status(500).json({
        message: error.message
    });
}

});


// UPDATE APPOINTMENT
router.put("/:id", async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.patch("/:id", verifyAdmin, async(req,res)=>{
    try {
        
        const existingAppointment = await Appointment.findById(req.params.id);

if (!existingAppointment) {
    return res.status(404).json({
        message: "Appointment not found"
    });
}

const nextDate = req.body.date ?? existingAppointment.date;
const nextTime = req.body.time ?? existingAppointment.time;

const dateTimeError = validateAppointmentDateTime(
    nextDate,
    nextTime
);

if (dateTimeError) {
    return res.status(400).json({
        message: dateTimeError
    });
}

        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// DELETE APPOINTMENT
router.delete("/:id", verifyAdmin, async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndDelete(req.params.id);

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        res.json({ message: "Appointment deleted", id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;