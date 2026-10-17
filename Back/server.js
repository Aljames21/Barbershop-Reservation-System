

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const app = express();

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
}
app.set("trust proxy", trustProxyHops);

// Middleware
const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    ...(process.env.FRONTEND_URL
        ? [process.env.FRONTEND_URL.trim().replace(/\/$/, "")]
        : [])
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

       const error = new Error("CORS origin not allowed");
        error.status = 403;
        return callback(error);
    }
}));

app.use(express.json());

app.use((req,res,next)=>{
    const safeUrl = req.url.replace(
        /(^|\/appointments\/review\/)[a-f\d]{64}(?=[/?#]|$)/i,
        "$1[REDACTED]"
    );
    console.log("REQUEST:", req.method, safeUrl);
     console.log("BODY FIELDS:", Object.keys(req.body || {}));
    next();
});

// Routes
const serviceRoutes = require("./Routes/serviceRoutes");
const barberRoutes = require("./Routes/barberoute");
const appointmentRoutes = require("./Routes/appointmentRoutes");
const adminRoutes = require("./Routes/adminRoutes");
const feedbackRoutes = require("./Routes/feedbackRoutes");
const otpRoutes = require("./Routes/otpRoutes");

app.use("/api/services", serviceRoutes);
app.use("/api/barbers", barberRoutes);  
app.use("/api/appointments", appointmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/otp", otpRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log("MongoDB Connected");
    console.log("Connected Database:", mongoose.connection.name);
})
.catch((error) => {
    console.log("MongoDB Error:", error);
});


// Test API
app.get("/", (req,res)=>{
    res.send("Barbershop API Running");
});

app.use((error, req, res, next) => {
    if (error.message === "CORS origin not allowed") {
    return res.status(403).json({
        message: "Origin not allowed."
    });
}
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            message: "Request body must be valid JSON."
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            message: "Request is too large."
        });
    }

    return next(error);
});

// Start Server
app.listen(process.env.PORT,()=>{
    console.log(`Server running on port ${process.env.PORT}`);
});
