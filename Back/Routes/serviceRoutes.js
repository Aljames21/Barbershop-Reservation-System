
const express = require("express");
const router = express.Router();

const Service = require("../Models/Service");
const verifyAdmin = require("../Middleware/authMiddleware");

// GET SERVICES
// Customers see active services; admins can see all services.
router.get("/", async (req, res) => {
    try {
        const filter = req.query.admin === "true"
            ? {}
            : {
                $or: [
                    { status: "Active" },
                    { status: { $exists: false } },
                    { status: null }
                ]
            };

        const services = await Service.find(filter).sort({ name: 1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ADD SERVICE
router.post("/", verifyAdmin, async (req, res) => {
    try {
        const { name, description, price, duration, status } = req.body;

        if (!name || price === undefined || duration === undefined) {
            return res.status(400).json({
                message: "Name, price, and duration are required."
            });
        }

        if (
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            !Number.isFinite(Number(duration)) ||
            Number(duration) < 1
        ) {
            return res.status(400).json({
                message: "Price must be at least 0 and duration must be at least 1 minute."
            });
        }

        const service = await Service.create({
            name: name.trim(),
            description: description || "",
            price: Number(price),
            duration: Number(duration),
            status: status === "Inactive" ? "Inactive" : "Active"
        });

        res.status(201).json(service);
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 500).json({
            message: error.code === 11000
                ? "A service with this name already exists."
                : error.message
        });
    }
});

// EDIT SERVICE
router.put("/:id", verifyAdmin, async (req, res) => {
    try {
        const { name, description, price, duration, status } = req.body;

        if (
            !name?.trim() ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            !Number.isFinite(Number(duration)) ||
            Number(duration) < 1 ||
            !["Active", "Inactive"].includes(status)
        ) {
            return res.status(400).json({
                message: "Please provide valid service details."
            });
        }

        const service = await Service.findByIdAndUpdate(
            req.params.id,
            {
                name: name.trim(),
                description: description || "",
                price: Number(price),
                duration: Number(duration),
                status
            },
            { new: true, runValidators: true }
        );

        if (!service) {
            return res.status(404).json({ message: "Service not found." });
        }

        res.json(service);
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 500).json({
            message: error.code === 11000
                ? "A service with this name already exists."
                : error.message
        });
    }
});

// DELETE SERVICE
router.delete("/:id", verifyAdmin, async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);

        if (!service) {
            return res.status(404).json({ message: "Service not found." });
        }

        res.json({ message: "Service deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
    