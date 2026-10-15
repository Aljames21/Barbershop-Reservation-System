

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const app = express();


// Middleware
app.use(cors());

app.use(express.json());

app.use((req,res,next)=>{
    console.log("REQUEST:", req.method, req.url);
     console.log("BODY FIELDS:", Object.keys(req.body || {}));
    next();
});

// Routes
const serviceRoutes = require("./Routes/serviceRoutes");
const barberRoutes = require("./Routes/barberoute");
const appointmentRoutes = require("./Routes/appointmentRoutes");
const adminRoutes = require("./Routes/adminRoutes");
const feedbackRoutes = require("./Routes/feedbackRoutes");

app.use("/api/services", serviceRoutes);
app.use("/api/barbers", barberRoutes);  
app.use("/api/appointments", appointmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);


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


// Start Server
app.listen(process.env.PORT,()=>{
    console.log(`Server running on port ${process.env.PORT}`);
});
