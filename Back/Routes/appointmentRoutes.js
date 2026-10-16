const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const juice = require("juice");
const transporter = require("../email");
const BookingSlot = require("../Models/BookingSlot");
const Barber = require("../Models/Barber");
const Appointment = require("../Models/Appointment");
const Feedback = require("../Models/Feedback");
const { classifyFeedbackComment } = require("../Utils/feedbackModeration");
const { validateFeedbackInput } = require("../Utils/feedbackValidation");
const {
    createReviewToken,
    hashReviewToken,
    matchesReviewToken
} = require("../Utils/reviewToken");
const feedbackRateLimit = require("../Middleware/feedbackRateLimit");
const verifyAdmin = require("../Middleware/authMiddleware");
const mongoose = require("mongoose");
const { getAuth } = require("../Config/firebaseAdmin");
const Service = require("../Models/Service");   


function normalizeCustomerEmail(email) {
    return typeof email === "string"
        ? email.trim().toLowerCase()
        : "";
}


async function findCustomerBookingConflict({
    email,
    phoneNumber = null,
    date,
    time,
    excludeAppointmentId = null,
    session = null
}) {
    const normalizedEmail = normalizeCustomerEmail(email);

    const customerIdentifiers = [];

    if (normalizedEmail) {
        customerIdentifiers.push({ email: normalizedEmail });
    }

    if (typeof phoneNumber === "string" && phoneNumber.trim()) {
        customerIdentifiers.push({
            phoneNumber: phoneNumber.trim()
        });
    }

    if (customerIdentifiers.length === 0) {
        return null;
    }

    const query = {
        $or: customerIdentifiers,
        date,
        time,
        status: {
            $nin: ["Cancelled", "Declined", "Completed"]
        }
    };

    if (excludeAppointmentId) {
        query._id = { $ne: excludeAppointmentId };
    }

    let search = Appointment.findOne(query)
        .select("_id date time");

    if (session) {
        search = search.session(session);
    }

    return search;
}

    const normalizedEmail = normalizeCustomerEmail(email);

    if (!normalizedEmail) {
        return null;
    }

    const query = {
        email: normalizedEmail,
        date,
        time,
        status: {
            $nin: ["Cancelled", "Declined", "Completed"]
        }
    };

    if (excludeAppointmentId) {
        query._id = { $ne: excludeAppointmentId };
    }

    let search = Appointment.findOne(query)
        .select("_id date time");

    if (session) {
        search = search.session(session);
    }

    return search;



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

    
async function verifyManageToken(appointmentId, token) {
    if (
        typeof appointmentId !== "string" ||
        !/^[a-f\d]{24}$/i.test(appointmentId) ||
        typeof token !== "string" ||
        !/^[a-f\d]{64}$/i.test(token)
    ) {
        return null;
    }

    const appointment = await Appointment.findById(appointmentId)
        .select("+manageTokenHash");

    if (!appointment || !appointment.manageTokenHash) {
        return null;
    }

    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    const storedHash = appointment.manageTokenHash;

    const suppliedBuffer = Buffer.from(tokenHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (
        suppliedBuffer.length !== storedBuffer.length ||
        !crypto.timingSafeEqual(suppliedBuffer, storedBuffer)
    ) {
        return null;
    }

    return appointment;
}

async function findReviewAppointment(token) {
    if (typeof token !== "string" || !/^[a-f\d]{64}$/i.test(token)) {
        return null;
    }

    const appointment = await Appointment.findOne({
        reviewTokenHash: hashReviewToken(token),
        reviewTokenExpiresAt: { $gt: new Date() }
    }).select("+reviewTokenHash");

    if (
        !appointment ||
        !matchesReviewToken(token, appointment.reviewTokenHash)
    ) {
        return null;
    }

    return appointment;
}

router.get("/review/:token", async (req, res) => {
    try {
        const appointment = await findReviewAppointment(req.params.token);

        if (!appointment || appointment.status !== "Completed") {
            return res.status(404).json({
                message: "This review link is invalid, expired, or already used."
            });
        }

        if (await Feedback.exists({ appointment: appointment._id })) {
            return res.status(409).json({
                message: "Feedback has already been submitted for this appointment."
            });
        }

        return res.json({
            service: appointment.service || "Appointment",
            date: appointment.date
        });
    } catch (error) {
        console.error("Review link validation error:", error);
        return res.status(500).json({
            message: "Unable to validate this review link."
        });
    }
});

router.post("/review/:token", feedbackRateLimit, async (req, res) => {
    try {
        const appointment = await findReviewAppointment(req.params.token);

        if (!appointment || appointment.status !== "Completed") {
            return res.status(404).json({
                message: "This review link is invalid, expired, or already used."
            });
        }

        const validation = validateFeedbackInput(req.body);
        if (validation.error) {
            return res.status(400).json({
                message: validation.error
            });
        }

        const { rating, comment } = validation.value;
        const moderation = classifyFeedbackComment(comment);
        if (moderation === "prohibited") {
            return res.status(400).json({
                message: "Please revise your comment to remove prohibited language."
            });
        }

        const status = moderation === "flagged" ? "Flagged" : "Approved";
        const feedback = await Feedback.create({
            appointment: appointment._id,
            rating,
            comment,
            status
        });

        appointment.reviewTokenHash = undefined;
        appointment.reviewTokenExpiresAt = undefined;
        await appointment.save();

        return res.status(status === "Flagged" ? 202 : 201).json({
            message: status === "Flagged"
                ? "Your feedback was received and is awaiting review."
                : "Thank you. Your feedback has been published.",
            feedback: {
                _id: feedback._id,
                rating: feedback.rating,
                comment: feedback.comment,
                status: feedback.status,
                createdAt: feedback.createdAt
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Feedback has already been submitted for this appointment."
            });
        }

        console.error("Review link feedback submission error:", error);
        return res.status(500).json({
            message: "Unable to submit feedback."
        });
    }
});

router.get("/:id/feedback", async (req, res) => {
    try {
        const appointment = await verifyManageToken(
            req.params.id,
            req.get("X-Manage-Token")
        );

        if (!appointment) {
            return res.status(403).json({
                message: "Invalid or missing booking management token."
            });
        }

        if (appointment.status !== "Completed") {
            return res.status(409).json({
                message: "Feedback is available after the appointment is completed."
            });
        }

        const feedback = await Feedback.findOne({
            appointment: appointment._id
        }).select("rating comment status createdAt");

        return res.json(feedback);
    } catch (error) {
        console.error("Fetch appointment feedback error:", error);
        return res.status(500).json({
            message: "Unable to load feedback status."
        });
    }
});

router.post("/:id/feedback", feedbackRateLimit, async (req, res) => {
    try {
        const appointment = await verifyManageToken(
            req.params.id,
            req.get("X-Manage-Token")
        );

        if (!appointment) {
            return res.status(403).json({
                message: "Invalid or missing booking management token."
            });
        }

        if (appointment.status !== "Completed") {
            return res.status(409).json({
                message: "Feedback can only be submitted for completed appointments."
            });
        }

        const validation = validateFeedbackInput(req.body);
        if (validation.error) {
            return res.status(400).json({
                message: validation.error
            });
        }

        const { rating, comment } = validation.value;
        const moderation = classifyFeedbackComment(comment);
        if (moderation === "prohibited") {
            return res.status(400).json({
                message: "Please revise your comment to remove prohibited language."
            });
        }

        const status = moderation === "flagged" ? "Flagged" : "Approved";
        const feedback = await Feedback.create({
            appointment: appointment._id,
            rating,
            comment,
            status
        });

        return res.status(status === "Flagged" ? 202 : 201).json({
            message: status === "Flagged"
                ? "Your feedback was received and is awaiting review."
                : "Thank you. Your feedback has been published.",
            feedback: {
                _id: feedback._id,
                rating: feedback.rating,
                comment: feedback.comment,
                status: feedback.status,
                createdAt: feedback.createdAt
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Feedback has already been submitted for this appointment."
            });
        }

        console.error("Feedback submission error:", error);
        return res.status(500).json({
            message: "Unable to submit feedback."
        });
    }
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
           status: { $nin: ["Cancelled", "Declined", "Completed"] }
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

router.get("/:id", async (req, res) => {
    try {
        const appointment = await verifyManageToken(
            req.params.id,
            req.get("X-Manage-Token")
        );

        if (!appointment) {
            return res.status(403).json({
                message: "Invalid or missing booking management token."
            });
        }

        const safeAppointment = appointment.toObject();
        delete safeAppointment.manageTokenHash;

        return res.json(safeAppointment);

    } catch (error) {
        console.error("Fetch appointment error:", error);

        return res.status(500).json({
            message: "Unable to load appointment."
        });
    }
});



// CREATE APPOINTMENT


router.post("/", async (req, res) => {
    console.log("POST APPOINTMENT RECEIVED");

    try {
        // Verify Firebase Phone OTP token
const authHeader = req.get("Authorization") || "";

if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
        message: "Please verify your mobile number before booking."
    });
}

const idToken = authHeader.slice(7).trim();

let decodedToken;

try {
    decodedToken = await getAuth().verifyIdToken(idToken);
} catch (error) {
    return res.status(401).json({
        message: "Phone verification expired or invalid. Please verify again."
    });
}

if (
    decodedToken.firebase?.sign_in_provider !== "phone" ||
    !decodedToken.phone_number
) {
    return res.status(403).json({
        message: "A verified mobile number is required."
    });
}

const verifiedPhone = decodedToken.phone_number;
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

        
        const customerEmail = normalizeCustomerEmail(req.body.email);

        if (
            !customerEmail ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
        ) {
    return res.status(400).json({
        message: "Please provide a valid email address."
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
            status: {
                $nin: ["Cancelled", "Declined", "Completed"]
            }
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
      
       
        // Assign a barber and reserve the slot atomically
        let saved;

        const manageToken = crypto.randomBytes(32).toString("hex");
        const manageTokenHash = crypto
        .createHash("sha256")
        .update(manageToken)
        .digest("hex");

        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // Get active barbers
                const barbers = await Barber.find({
                    status: { $in: ["Active", "Available"] }
                })
                    .sort({ name: 1 })
                    .session(session);

                if (!barbers.length) {
                    const error = new Error(
                        "No barbers are currently available."
                    );
                    error.statusCode = 409;
                    throw error;
                }

                // Find appointments occupying this date and time
                const occupiedAppointments = await Appointment.find({
                    date,
                    time,
                    status: {
                        $nin: ["Cancelled", "Declined", "Completed"]
                    }
                })
                    .select("barber")
                    .session(session);

                const occupiedNames = new Set(
                    occupiedAppointments.map((appointment) =>
                        String(appointment.barber || "")
                            .trim()
                            .toLowerCase()
                    )
                );

                
            const customerConflict = await findCustomerBookingConflict({
                email: customerEmail,
                phoneNumber: verifiedPhone,
                 date,
                 time,
                session
        });

        if (customerConflict) {
        const error = new Error(
        "You already have an appointment at this date and time. Please choose another schedule."
        );

        error.statusCode = 409;
        throw error;
        }


                let assignedBarber;

                const requestedName =
                    typeof requestedBarber === "string"
                        ? requestedBarber.trim()
                        : "";

                if (
                    requestedName &&
                    requestedName.toLowerCase() !== "no preference"
                ) {
                    // Customer selected a specific barber
                    assignedBarber = barbers.find(
                        (barber) =>
                            barber.name.trim().toLowerCase() ===
                            requestedName.toLowerCase()
                    );

                    if (!assignedBarber) {
                        const error = new Error(
                            "The selected barber does not exist or is inactive."
                        );
                        error.statusCode = 400;
                        throw error;
                    }

                    if (
                        occupiedNames.has(
                            assignedBarber.name.trim().toLowerCase()
                        )
                    ) {
                        const error = new Error(
                            "This barber is already booked for that date and time. Please choose another barber or time."
                        );
                        error.statusCode = 409;
                        throw error;
                    }
                } else {
                    // No preference: choose an available barber
                    assignedBarber = barbers.find(
                        (barber) =>
                            !occupiedNames.has(
                                barber.name.trim().toLowerCase()
                            )
                    );

                    if (!assignedBarber) {
                        const error = new Error(
                            "All barbers are booked for that date and time. Please choose another time."
                        );
                        error.statusCode = 409;
                        throw error;
                    }
                }

                // Create the appointment
                const appointment = new Appointment({
                ...req.body,
                customerName,
                email: customerEmail,
                phoneNumber: verifiedPhone,
                barber: assignedBarber.name,
                manageTokenHash
});

                await appointment.save({ session });

                // Reserve the unique barber/date/time slot
                await BookingSlot.create(
                    [
                        {
                            date: appointment.date,
                            time: appointment.time,
                            barber: assignedBarber.name
                                .trim()
                                .toLowerCase(),
                            appointmentId: appointment._id
                        }
                    ],
                    { session }
                );

                saved = appointment;
            });
        } finally {
            await session.endSession();
        }


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
            `manage_booking.html?id=${encodeURIComponent(saved._id)}&token=${encodeURIComponent(manageToken)}`,
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

        
        return res.status(201).json({
            ...saved.toObject(),
            manageToken
        });


    
    } catch (error) {
        console.error("Appointment creation error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "This barber is already booked for that date and time. Please choose another barber or time."
            });
        }

        if (error.statusCode) {
    return res.status(error.statusCode).json({
        message: error.message
    });
    }

        return res.status(500).json({
            message: "Unable to save appointment. Please try again."
        });
    }

});



// UPDATE APPOINTMENT

router.put("/:id", async (req, res) => {
    const session = await mongoose.startSession();
    let updatedAppointment = null;

    try {
        const appointment = await verifyManageToken(
    req.params.id,
    req.get("X-Manage-Token")
);

if (!appointment) {
    return res.status(403).json({
        message: "Invalid or missing booking management token."
    });
}

        await session.withTransaction(async () => {
            const existing = await Appointment.findById(req.params.id)
                .session(session);

            if (!existing) {
                const error = new Error("Appointment not found");
                error.statusCode = 404;
                throw error;
            }

            
const allowedFields = ["date", "time", "service", "barber"];

const invalidFields = Object.keys(req.body).filter(
    (field) => !allowedFields.includes(field)
);

if (invalidFields.length > 0) {
    const error = new Error(
        "Only date, time, service, and barber can be changed."
    );
    error.statusCode = 400;
    throw error;
}


           
const nextDate = req.body.date ?? existing.date;
const nextTime = req.body.time ?? existing.time;
const nextBarber = req.body.barber ?? existing.barber;
const nextService = req.body.service ?? existing.service;

const service = await Service.findOne({
    name: nextService
}).session(session);

if (!service) {
    const error = new Error(
        "The selected service does not exist."
    );
    error.statusCode = 400;
    throw error;
}

            const dateTimeError = validateAppointmentDateTime(

                nextDate,
                nextTime
            );

            if (dateTimeError) {
                const error = new Error(dateTimeError);
                error.statusCode = 400;
                throw error;
            }

            
        const customerConflict = await findCustomerBookingConflict({
        email: existing.email,
        phoneNumber: existing.phoneNumber,
        date: nextDate,
        time: nextTime,
        excludeAppointmentId: existing._id,
        session
    });

    if (customerConflict) {
        const error = new Error(
            "You already have another appointment at this date and time."
        );

        error.statusCode = 409;
        throw error;
    }


            const barber = await Barber.findOne({
                name: {
                    $regex: `^${String(nextBarber).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                    $options: "i"
                },
                status: { $in: ["Active", "Available"] }
            }).session(session);

            if (!barber) {
                const error = new Error(
                    "The selected barber does not exist or is inactive."
                );
                error.statusCode = 400;
                throw error;
            }

            const normalizedBarber = barber.name.trim().toLowerCase();

            // Reserve the new slot first. The unique index prevents
            // another appointment from taking the same barber/date/time.
            const sameSlot =
                existing.date === nextDate &&
                existing.time === nextTime &&
                existing.barber.trim().toLowerCase() === normalizedBarber;

            if (!sameSlot) {
                await BookingSlot.create(
                    [{
                        date: nextDate,
                        time: nextTime,
                        barber: normalizedBarber,
                        appointmentId: existing._id
                    }],
                    { session }
                );

                await BookingSlot.deleteOne({
                    appointmentId: existing._id,
                    date: existing.date,
                    time: existing.time,
                    barber: existing.barber.trim().toLowerCase()
                }).session(session);
            }

        existing.date = nextDate;
        existing.time = nextTime;
        existing.barber = barber.name;

        existing.service = service.name;
        existing.price = service.price;

            await existing.save({ session });
            updatedAppointment = existing;
        });

        return res.json(updatedAppointment);
    } catch (error) {
        console.error("Appointment update error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "This barber is already booked for that date and time."
            });
        }

        return res.status(error.statusCode || 500).json({
            message: error.statusCode
                ? error.message
                : "Unable to update appointment."
        });
    } finally {
        await session.endSession();
    }
});





router.patch("/:id", verifyAdmin, async (req, res) => {
    const session = await mongoose.startSession();
    let statusChangedFrom = null;
    let reviewToken = null;


    try {
        let updatedAppointment = null;

        await session.withTransaction(async () => {

            const existing = await Appointment.findById(req.params.id)
                .session(session);

            if (!existing) {
                const error = new Error("Appointment not found");
                error.statusCode = 404;
                throw error;
            }

            // ADMIN STATUS ACTIONS
            if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
                // Status-only requests are allowed here.
                const extraFields = Object.keys(req.body).filter(
                    field => field !== "status"
                );

                if (extraFields.length > 0) {
                    const error = new Error(
                        "Send only the status when changing appointment status."
                    );
                    error.statusCode = 400;
                    throw error;
                }

                const nextStatus = req.body.status;

                const allowedTransitions = {
                    Pending: ["Confirmed", "Cancelled"],
                    Confirmed: ["Completed", "Cancelled"]
                };

                if (
                    !allowedTransitions[existing.status] ||
                    !allowedTransitions[existing.status].includes(nextStatus)
                ) {
                    const error = new Error(
                        `Cannot change appointment status from ${existing.status} to ${nextStatus}.`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                statusChangedFrom = existing.status;
                existing.status = nextStatus;

                if (nextStatus === "Completed") {
                    reviewToken = createReviewToken();
                    existing.reviewTokenHash = hashReviewToken(reviewToken);
                    existing.reviewTokenExpiresAt = new Date(
                        Date.now() + 30 * 24 * 60 * 60 * 1000
                    );
                }

                // Release the reserved slot when the appointment
                // is cancelled or completed.
                if (["Cancelled", "Completed"].includes(nextStatus)) {
                    await BookingSlot.deleteOne({
                        appointmentId: existing._id
                    }).session(session);
                }

                await existing.save({ session });
                updatedAppointment = existing;
                return;
            }

            // ADMIN RESCHEDULING
            const nextDate = req.body.date ?? existing.date;
            const nextTime = req.body.time ?? existing.time;
            const nextBarber = req.body.barber ?? existing.barber;

            const allowedFields = ["date", "time", "barber"];
            const invalidFields = Object.keys(req.body).filter(
                field => !allowedFields.includes(field)
            );

            if (invalidFields.length > 0) {
                const error = new Error(
                    "Only date, time, and barber can be changed when rescheduling."
                );
                error.statusCode = 400;
                throw error;
            }

            const dateTimeError = validateAppointmentDateTime(
                nextDate,
                nextTime
            );

            if (dateTimeError) {
                const error = new Error(dateTimeError);
                error.statusCode = 400;
                throw error;
            }

            
             const customerConflict = await findCustomerBookingConflict({
                 email: existing.email,
                  phoneNumber: existing.phoneNumber,
                 date: nextDate,
                time: nextTime,
                excludeAppointmentId: existing._id,
                session
        });

    if (customerConflict) {
        const error = new Error(
            "This customer already has another appointment at this date and time."
        );

        error.statusCode = 409;
        throw error;
    }


            const barber = await Barber.findOne({
                name: nextBarber,
                status: { $in: ["Active", "Available"] }
            }).session(session);

            if (!barber) {
                const error = new Error(
                    "The selected barber does not exist or is inactive."
                );
                error.statusCode = 400;
                throw error;
            }

            const normalizedBarber = barber.name.trim().toLowerCase();

            const sameSlot =
                existing.date === nextDate &&
                existing.time === nextTime &&
                existing.barber.trim().toLowerCase() === normalizedBarber;

            if (!sameSlot) {
                await BookingSlot.create(
                    [{
                        date: nextDate,
                        time: nextTime,
                        barber: normalizedBarber,
                        appointmentId: existing._id
                    }],
                    { session }
                );

                await BookingSlot.deleteOne({
                    appointmentId: existing._id,
                    date: existing.date,
                    time: existing.time,
                    barber: existing.barber.trim().toLowerCase()
                }).session(session);
            }

            existing.date = nextDate;
            existing.time = nextTime;
            existing.barber = barber.name;

            await existing.save({ session });
            updatedAppointment = existing;
        });

       
        // SEND EMAIL WHEN ADMIN CONFIRMS OR CANCELS
        if (
            statusChangedFrom &&
            updatedAppointment?.email &&
            statusChangedFrom !== updatedAppointment.status
        ) {
            const appointment = updatedAppointment;
            const isConfirmed = appointment.status === "Confirmed";
            const isCancelled = appointment.status === "Cancelled";

            if (isConfirmed || isCancelled) {
                const subject = isConfirmed
                    ? "Sañado's Barbershop — Appointment Confirmed"
                    : "Sañado's Barbershop — Appointment Cancelled";

                const message = isConfirmed
                    ? "Your appointment has been confirmed. We look forward to seeing you at Sañado's Barbershop."
                    : "Your appointment has been cancelled. If you have questions, please contact Sañado's Barbershop.";

                const details =
                    `Service: ${appointment.service || "Appointment"}\n` +
                    `Date: ${appointment.date}\n` +
                    `Time: ${appointment.time}\n` +
                    `Barber: ${appointment.barber}\n` +
                    `Price: ₱${Number(appointment.price || 0).toLocaleString("en-PH")}`;

                try {
                    await transporter.sendMail({
                        from: `"Sañado's Barbershop" <${process.env.EMAIL_USER}>`,
                        to: appointment.email,
                        subject,
                        text:
                            `Hi ${appointment.customerName},\n\n` +
                            `${message}\n\n${details}\n\n` +
                            "Thank you for choosing Sañado's Barbershop.",
                        html: `
                            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#171717;color:#fff;border-radius:12px">
                                <h2 style="color:#c99443">Sañado's Barbershop</h2>
                                <h3>${isConfirmed ? "APPOINTMENT CONFIRMED" : "APPOINTMENT CANCELLED"}</h3>
                                <p>Hi ${escapeHtml(appointment.customerName)},</p>
                                <p>${message}</p>
                                <hr>
                                <p><strong>Service:</strong> ${escapeHtml(appointment.service || "Appointment")}</p>
                                <p><strong>Date:</strong> ${escapeHtml(appointment.date)}</p>
                                <p><strong>Time:</strong> ${escapeHtml(appointment.time)}</p>
                                <p><strong>Barber:</strong> ${escapeHtml(appointment.barber)}</p>
                                <p><strong>Price:</strong> ₱${Number(appointment.price || 0).toLocaleString("en-PH")}</p>
                                <hr>
                                <p>Thank you for choosing Sañado's Barbershop.</p>
                            </div>
                        `
                    });

                    console.log(
                        `${appointment.status} email sent:`,
                        appointment.email
                    );
                } catch (emailError) {
                    console.error(
                        `${appointment.status} email failed:`,
                        emailError.message
                    );
                }
            }
        }

        let feedbackInvitation = null;

        if (
            statusChangedFrom &&
            statusChangedFrom !== updatedAppointment?.status &&
            updatedAppointment?.status === "Completed"
        ) {
            try {
                const customerAppUrl = process.env.CUSTOMER_APP_URL?.trim();
                if (!customerAppUrl) {
                    throw new Error("CUSTOMER_APP_URL is not configured.");
                }

                const appBaseUrl = new URL(
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

                const feedbackUrl = new URL(
                    `customer_feedback.html?token=${encodeURIComponent(reviewToken)}`,
                    appBaseUrl
                ).toString();
                const appointment = updatedAppointment;
                const details =
                    `Service: ${appointment.service || "Appointment"}\n` +
                    `Date: ${appointment.date}\n` +
                    `Time: ${appointment.time}\n`;

                await transporter.sendMail({
                    from: `"Sañado's Barbershop" <${process.env.EMAIL_USER}>`,
                    to: appointment.email,
                    subject: "Thank You for Visiting Sañado's Barbershop!",
                    text:
                        `Hello ${appointment.customerName},\n\n` +
                        "Thank you for choosing our barbershop! We hope you enjoyed your service.\n\n" +
                        "We would appreciate it if you could share your experience with us. Your feedback helps us improve our services and provide a better experience for our customers.\n\n" +
                        `${details}\n` +
                        `Add Review: ${feedbackUrl}\n\n` +
                        "Thank you for your support!\n\n" +
                        "Best regards,\nSañado's Barbershop",
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#171717;color:#fff;border-radius:12px">
                            <h2 style="color:#c99443">Sañado's Barbershop</h2>
                            <p>Hello ${escapeHtml(appointment.customerName)},</p>
                            <p>Thank you for choosing our barbershop! We hope you enjoyed your service.</p>
                            <p>We would appreciate it if you could share your experience with us. Your feedback helps us improve our services and provide a better experience for our customers.</p>
                            <p><strong>Service:</strong> ${escapeHtml(appointment.service || "Appointment")}<br>
                            <strong>Date:</strong> ${escapeHtml(appointment.date)}<br>
                            <strong>Time:</strong> ${escapeHtml(appointment.time)}</p>
                            <p style="margin:28px 0">
                                <a href="${escapeHtml(feedbackUrl)}" style="display:inline-block;padding:14px 24px;background:#c99443;color:#171717;text-decoration:none;font-weight:bold;border-radius:6px">Add Review</a>
                            </p>
                            <p>Thank you for your support!</p>
                            <p>Best regards,<br>Sañado's Barbershop</p>
                        </div>
                    `
                });

                feedbackInvitation = { sent: true };
                console.log(
                    "Feedback invitation sent:",
                    appointment.email
                );
            } catch (emailError) {
                console.error(
                    "Feedback invitation email failed:",
                    emailError.message
                );
                feedbackInvitation = {
                    sent: false,
                    message: "The appointment is completed, but the feedback invitation could not be sent. Check the email configuration and CUSTOMER_APP_URL."
                };
            }
        }

        const response = updatedAppointment.toObject();
        if (feedbackInvitation) {
            response.feedbackInvitation = feedbackInvitation;
        }

        return res.json(response);


    } catch (error) {
        console.error("Admin appointment update error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "This barber is already booked for that date and time."
            });
        }

        return res.status(error.statusCode || 500).json({
            message: error.statusCode
                ? error.message
                : "Unable to update appointment."
        });

    } finally {
        await session.endSession();
    }
});



// DELETE APPOINTMENT


router.delete("/:id", async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const appointment = await verifyManageToken(
            req.params.id,
            req.get("X-Manage-Token")
        );

        if (!appointment) {
            return res.status(403).json({
                message: "Invalid or missing booking management token."
            });
        }

        if (await Feedback.exists({ appointment: appointment._id })) {
            return res.status(409).json({
                message: "This appointment has feedback and cannot be deleted."
            });
        }

        let deletedAppointment = null;

        await session.withTransaction(async () => {
            deletedAppointment = await Appointment.findByIdAndDelete(
                req.params.id,
                { session }
            );

            if (!deletedAppointment) {
                const error = new Error("Appointment not found");
                error.statusCode = 404;
                throw error;
            }

            await BookingSlot.deleteOne(
                { appointmentId: deletedAppointment._id },
                { session }
            );
        });

        return res.json({
            message: "Appointment deleted successfully",
            id: req.params.id
        });

    } catch (error) {
        console.error("Appointment deletion error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Unable to complete the requested operation."
            });
        }

        return res.status(error.statusCode || 500).json({
            message: error.statusCode
                ? error.message
                : "Unable to delete appointment."
        });

    } finally {
        await session.endSession();
    }
});




module.exports = router;