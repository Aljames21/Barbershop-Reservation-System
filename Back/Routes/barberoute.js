
const express = require("express");
const router = express.Router();

const Barber = require("../Models/Barber");
const verifyAdmin = require("../Middleware/authMiddleware");

// PUBLIC: customer homepage
router.get("/", async (req, res) => {
    try {
        const barbers = await Barber.find()
            .select("name specialization status");

        res.json(barbers);
    } catch (error) {
        console.error("Error loading barbers:", error.message);
        res.status(500).json({ message: "Unable to load barbers." });
    }
});

// ADMIN: get all staff

router.get("/admin", verifyAdmin, async (req, res) => {
    try {
        const barbers = await Barber.find().sort({ name: 1 });
        res.json(barbers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// ADMIN: add staff
router.post("/", verifyAdmin, async (req, res) => {
    try {
        const { name, role, date, time } = req.body;

        if (!name || !role) {
            return res.status(400).json({
                message: "Name and role are required."
            });
        }

        const barber = await Barber.create({
            name: name.trim(),
            specialization: role.trim(),
            status: "Active",
            date: date || "",
            time: time || ""
        });

        res.status(201).json(barber);
    } catch (error) {
        console.error("Add staff error:", error.message);
        res.status(500).json({ message: "Unable to add staff." });
    }
});

// ADMIN: update staff
router.put("/:id", verifyAdmin, async (req, res) => {
    try {
        const { name, role, date, time } = req.body;

        const updated = await Barber.findByIdAndUpdate(
            req.params.id,
            {
                name: name?.trim(),
                specialization: role?.trim(),
                date: date || "",
                time: time || ""
            },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Staff not found." });
        }

        res.json(updated);
    } catch (error) {
        console.error("Update staff error:", error.message);
        res.status(500).json({ message: "Unable to update staff." });
    }
});

// ADMIN: delete staff
router.delete("/:id", verifyAdmin, async (req, res) => {
    try {
        console.log("Deleting barber ID:", req.params.id);
        const deleted = await Barber.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: "Staff not found." });
        }

        res.json({ message: "Staff removed successfully." });
    } catch (error) {
        console.error("Delete staff error:", error.message);
        res.status(500).json({ message: "Unable to remove staff." });
    }
});

module.exports = router;
