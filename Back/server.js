

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
app.use(cors());

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
})
.catch((error) => {
    console.log("MongoDB Error:", error);
});


// Test API
app.get("/", (req,res)=>{
    res.send("Barbershop API Running");
});

app.use((error, req, res, next) => {
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
