
const express = require("express");
const router = express.Router();

const Barber = require("../Models/Barber");
const verifyAdmin = require("../Middleware/authMiddleware");

// PUBLIC: customer homepage
router.get("/", async (req, res) => {
    try {
        const barbers = await Barber.find({
            isArchived: { $ne: true },
            status: { $in: ["Available", "Active"] }
        }).select("name specialization status");
                res.json(barbers);

    } catch (error) {
        console.error("Error loading barbers:", error.message);
        res.status(500).json({ message: "Unable to load barbers." });
    }
});

// ADMIN: get all staff

router.get("/admin", verifyAdmin, async (req, res) => {
    try {
        const barbers = await Barber.find({isArchived: { $ne: true }}).sort({ name: 1 });
        res.json(barbers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// ADMIN: add staff
router.post("/", verifyAdmin, async (req, res) => {
    try {
        const { name, role, specialization, status } = req.body;

        const barberName = String(name || "").trim();
        const barberSpecialization = String(
            specialization || role || ""
        ).trim();

        const allowedStatuses = [
            "Available",
            "Unavailable",
            "On Leave"
        ];

        if (!barberName || !barberSpecialization) {
            return res.status(400).json({
                message: "Name and specialization are required."
            });
        }

        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid barber status."
            });
        }

        const barber = await Barber.create({
            name: barberName,
            specialization: barberSpecialization,
            status: status || "Available"
        });

        res.status(201).json(barber);
    } catch (error) {
        console.error("Add staff error:", error.message);
        res.status(500).json({
            message: "Unable to add staff."
        });
    }
});


// ADMIN: List archived barbers
router.get("/archive/list", verifyAdmin, async (req, res) => {
    try {
        const barbers = await Barber.find({
            isArchived: true
        }).sort({ archivedAt: -1 });

        res.json(barbers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ADMIN: Retrieve archived barber
router.patch("/archive/:id/restore", verifyAdmin, async (req, res) => {
    try {
        const barber = await Barber.findOneAndUpdate(
            { _id: req.params.id, isArchived: true },
            {
                $set: {
                    isArchived: false,
                    archivedAt: null
                }
            },
            { new: true }
        );

        if (!barber) {
            return res.status(404).json({
                message: "Archived staff not found."
            });
        }

        res.json({
            message: "Staff retrieved successfully.",
            barber
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ADMIN: Permanently delete archived barber
router.delete("/archive/:id/permanent", verifyAdmin, async (req, res) => {
    try {
        const barber = await Barber.findOneAndDelete({
            _id: req.params.id,
            isArchived: true
        });

        if (!barber) {
            return res.status(404).json({
                message: "Archived staff not found."
            });
        }

        res.json({
            message: "Staff permanently deleted."
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// ADMIN: update staff
router.put("/:id", verifyAdmin, async (req, res) => {
    try {
        const { name, role, specialization, status } = req.body;
        const update = {};

        if (name !== undefined) {
            update.name = String(name).trim();

            if (!update.name) {
                return res.status(400).json({
                    message: "Name is required."
                });
            }
        }

        if (role !== undefined || specialization !== undefined) {
            update.specialization = String(
                specialization ?? role ?? ""
            ).trim();

            if (!update.specialization) {
                return res.status(400).json({
                    message: "Specialization is required."
                });
            }
        }

        if (status !== undefined) {
            const allowedStatuses = [
                "Available",
                "Unavailable",
                "On Leave"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message: "Invalid barber status."
                });
            }

            update.status = status;
        }

        const updated = await Barber.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({
                message: "Staff not found."
            });
        }

        res.json(updated);
    } catch (error) {
        console.error("Update staff error:", error.message);
        res.status(500).json({
            message: "Unable to update staff."
        });
    }
});


// ADMIN: delete staff

router.delete("/:id", verifyAdmin, async (req, res) => {
    try {
        const barber = await Barber.findOneAndUpdate(
            {
                _id: req.params.id,
                isArchived: { $ne: true }
            },
            {
                $set: {
                    isArchived: true,
                    archivedAt: new Date()
                }
            },
            { new: true }
        );

        if (!barber) {
            return res.status(404).json({
                message: "Active staff not found."
            });
        }

        res.json({
            message: "Staff moved to Archives.",
            barber
        });
    } catch (error) {
        res.status(500).json({
            message: "Unable to archive staff."
        });
    }
});


module.exports = router;
