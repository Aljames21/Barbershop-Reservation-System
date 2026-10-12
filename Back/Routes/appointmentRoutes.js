const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const juice = require("juice");
const transporter = require("../email");
const Barber = require("../Models/Barber");
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


/* GET BOOKING AVAILABILITY FOR A DATE */
router.get("/availability/:date", async (req, res) => {
    try {
        const { date } = req.params;

        // Validate the date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Please provide a valid date."
            });
        }

        // Get active barbers
        const barbers = await Barber.find({
            status: { $in: ["Active", "Available"] }
        }).select("name status").sort({ name: 1 });

        // Get appointments for the selected date
        const appointments = await Appointment.find({
            date,
            status: { $nin: ["Cancelled", "Declined"] }
        }).select("barber time status");

        // Return each barber's booked times
        const availability = barbers.map((barber) => ({
            name: barber.name,
            bookedTimes: appointments
                .filter((appointment) =>
                    appointment.barber?.trim().toLowerCase() ===
                    barber.name.trim().toLowerCase()
                )
                .map((appointment) => appointment.time)
        }));

        return res.json({
            date,
            barbers: availability
        });

    } catch (error) {
        console.error("Availability error:", error);

        return res.status(500).json({
            message: "Unable to load booking availability."
        });
    }
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


router.post("/", async (req, res) => {
    console.log("POST APPOINTMENT RECEIVED");

    try {
        const customerAppUrl = process.env.CUSTOMER_APP_URL?.trim();
        let appBaseUrl = null;

        if (customerAppUrl) {
            appBaseUrl = new URL(
                `${customerAppUrl.replace(/\/+$/, "")}/`
            );

            const isLocalHttp =
                appBaseUrl.protocol === "http:" &&
                ["localhost", "127.0.0.1"].includes(appBaseUrl.hostname);

            if (appBaseUrl.protocol !== "https:" && !isLocalHttp) {
                throw new Error(
                    "CUSTOMER_APP_URL must use HTTPS, except for localhost development."
                );
            }
        }

        const {
            date,
            time,
            customerName: submittedCustomerName,
            barber: requestedBarber
        } = req.body;

        const customerName =
            typeof submittedCustomerName === "string"
                ? submittedCustomerName.trim()
                : "";

        if (!customerName) {
            return res.status(400).json({
                message: "Please provide your name."
            });
        }

        // Validate appointment date and time
        const dateTimeError = validateAppointmentDateTime(date, time);

        if (dateTimeError) {
            return res.status(400).json({
                message: dateTimeError
            });
        }

        // Get active barbers from the Barber collection
        const barbers = await Barber.find({
            status: { $in: ["Active", "Available"] }
        }).sort({ name: 1 });

        if (!barbers.length) {
            return res.status(409).json({
                message: "No barbers are currently available."
            });
        }

        // Find barbers already booked at this date and time
        const occupiedAppointments = await Appointment.find({
            date,
            time,
            status: { $nin: ["Cancelled", "Declined"] }
        }).select("barber");

        const occupiedNames = new Set(
            occupiedAppointments.map(a =>
                String(a.barber || "").trim().toLowerCase()
            )
        );

        let assignedBarber;

        if (
            requestedBarber &&
            requestedBarber.trim() &&
            requestedBarber.trim().toLowerCase() !== "no preference"
        ) {
            // Customer requested a specific barber
            assignedBarber = barbers.find(
                b => b.name.trim().toLowerCase() ===
                    requestedBarber.trim().toLowerCase()
            );

            if (!assignedBarber) {
                return res.status(400).json({
                    message: "The selected barber does not exist or is inactive."
                });
            }

            if (
                occupiedNames.has(
                    assignedBarber.name.trim().toLowerCase()
                )
            ) {
                return res.status(409).json({
                    message: "This barber is already booked for that date and time. Please choose another barber or time."
                });
            }
        } else {
            // No preference: assign the first available barber
            assignedBarber = barbers.find(
                b => !occupiedNames.has(
                    b.name.trim().toLowerCase()
                )
            );

            if (!assignedBarber) {
                return res.status(409).json({
                    message: "All barbers are booked for that date and time. Please choose another time."
                });
            }
        }

        // Save the appointment with the assigned barber
        const appointment = new Appointment({
            ...req.body,
            customerName,
            barber: assignedBarber.name
        });

        const saved = await appointment.save();

        // Prepare confirmation email
        const emailCustomerName = escapeHtml(saved.customerName);
        const service = escapeHtml(saved.service || "Appointment");
        const barber = escapeHtml(saved.barber);
        const emailDate = escapeHtml(saved.date);
        const emailTime = escapeHtml(saved.time);
        const price = `₱${Number(saved.price || 0).toLocaleString("en-PH")}`;

        let manageBookingUrl = "";

        if (appBaseUrl) {
            manageBookingUrl = new URL(
                `Customer_Page/manage_booking.html?id=${encodeURIComponent(saved._id)}`,
                appBaseUrl
            ).toString();
        } else {
            console.warn(
                "CUSTOMER_APP_URL is not configured; manage-booking link omitted."
            );
        }

        const manageBookingButton = manageBookingUrl
            ? `<h2 class="email-manage-heading">Need to make changes?</h2>
               <p class="email-manage-copy">Manage or cancel your appointment using the link below</p>
               <a class="email-manage-button" href="${escapeHtml(manageBookingUrl)}">Manage this booking</a>`
            : `<p class="email-manage-unavailable">Online booking management will be available when our website is live.</p>`;

        // Email failure must not undo the saved appointment
        try {
            const info = await transporter.sendMail({
                from: `"Sañado's Barbershop" <${process.env.EMAIL_USER}>`,
                to: saved.email,
                subject: "Sañado's Barbershop — Appointment Received",
                text:
                    `Hi ${saved.customerName},\n\n` +
                    "We have received your appointment request at Sañado's Barbershop.\n\n" +
                    `Service: ${saved.service}\n` +
                    `Date: ${saved.date}\n` +
                    `Time: ${saved.time}\n` +
                    `Barber: ${saved.barber}\n` +
                    `Price: ${price}\n\n` +
                    (manageBookingUrl
                        ? `Manage this booking: ${manageBookingUrl}\n\n`
                        : "") +
                    "Thank you for choosing Sañado's Barbershop.",
                html: juice(
                    renderAppointmentEmail({
                        customerName: emailCustomerName,
                        service,
                        barber,
                        date: emailDate,
                        time: emailTime,
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
            console.error("BOOKING EMAIL FAILED:", emailError.message);
        }

        return res.status(201).json(saved);

    } catch (error) {
        console.error("Appointment creation error:", error);

        return res.status(500).json({
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