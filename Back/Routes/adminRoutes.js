
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Admin = require("../Models/Admin");
const LoginActivity = require("../Models/LoginActivity");
const verifyAdmin = require("../Middleware/authMiddleware");

const transporter = require("../email");

async function recordLoginAttempt(result, admin = null) {
    const authenticated = result === "Success" && admin;

    await LoginActivity.create({
        accountName: authenticated ? admin.username : "Unknown account",
        role: authenticated ? "Admin" : "Unknown",
        result
    });
}

// 1. LOGIN: username OR email + password
router.post("/login", async (req, res) => {
    try {

        console.log("LOGIN ROUTE REACHED");
        console.log("BODY FIELDS:", Object.keys(req.body || {}));

        const { username, email, password } = req.body;
        const identifier = String(username || email || "").trim();

        if (!identifier || !password) {
            await recordLoginAttempt("Failed");

            return res.status(400).json({
                message: "Username/email and password are required."
            });
        }

        const admin = await Admin.findOne({
            $or: [
                { username: identifier },
                { email: identifier.toLowerCase() }
            ]
        });

        if (!admin) {
            await recordLoginAttempt("Failed");

            return res.status(401).json({
                message: "Invalid username/email or password."
            });
        }

        let validPassword = false;

        if (admin.password.startsWith("$2")) {
            validPassword = await bcrypt.compare(
                password,
                admin.password
            );
        } else if (password === admin.password) {
            // Migrate an old plain-text password, if one remains.
            validPassword = true;
            admin.password = await bcrypt.hash(password, 12);
            await admin.save();
        }

        if (!validPassword) {
            await recordLoginAttempt("Failed");

            return res.status(401).json({
                message: "Invalid username/email or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured.");
        }

        const token = jwt.sign(
            {
                adminId: admin._id.toString(),
                username: admin.username
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        await recordLoginAttempt("Success", admin);

        return res.json({
            message: "Login successful.",
            token,
            admin: {
                username: admin.username,
                email: admin.email
            }
        });

    } catch (error) {
        console.error("Admin login error:", error.message);
        return res.status(500).json({
            message: "Server error. Please try again."
        });
    }
});

router.get("/login-activity", verifyAdmin, async (req, res) => {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 25);
        const result = req.query.result;

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 100
        ) {
            return res.status(400).json({
                message: "Invalid page or limit."
            });
        }

        const filter = {};

        if (result !== undefined) {
            if (!["Success", "Failed"].includes(result)) {
                return res.status(400).json({
                    message: "Invalid result filter."
                });
            }

            filter.result = result;
        }

        const [items, total] = await Promise.all([
            LoginActivity.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .select("accountName role result createdAt")
                .lean(),
            LoginActivity.countDocuments(filter)
        ]);

        return res.json({
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error("Login activity error:", error.message);
        return res.status(500).json({
            message: "Unable to load login activity."
        });
    }
});

// 2. FORGOT PASSWORD: send a 6-digit code by email
router.post("/forgot-password", async (req, res) => {
    try {
        console.log("FORGOT PASSWORD BODY:", req.body);
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        if (!email) {
            return res.status(400).json({
                message: "Please enter your registered email."
            });
        }

        const admin = await Admin.findOne({ email });

        const message =
            "If the email is registered, a verification code will be sent.";

        if (!admin) {
            return res.json({ message });
        }

        const code = crypto.randomInt(100000, 1000000).toString();

        admin.resetCodeHash = crypto
            .createHash("sha256")
            .update(code)
            .digest("hex");

        admin.resetCodeExpires = new Date(
            Date.now() + 10 * 60 * 1000
        );

        await admin.save();

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: admin.email,
                subject: "Barbershop Admin Password Reset",
                text:
                    `Your verification code is ${code}. ` +
                    "It expires in 10 minutes. " +
                    "If you did not request this, ignore this email."
            });
        } catch (emailError) {
            admin.resetCodeHash = undefined;
            admin.resetCodeExpires = undefined;
            await admin.save();
            throw emailError;
        }

        return res.json({ message });

    } catch (error) {
        console.error("Forgot password error:", error.message);
        return res.status(500).json({
            message: "Unable to send the code. Please try again."
        });
    }
});

// 3. RESET PASSWORD: verify code and save new password
router.post("/reset-password", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const code = String(req.body.code || "").trim();
        const newPassword = String(req.body.newPassword || "");

        if (
            !email ||
            !/^\d{6}$/.test(code) ||
            newPassword.length < 8
        ) {
            return res.status(400).json({
                message:
                    "Enter your email, 6-digit code, and a new password with at least 8 characters."
            });
        }

        const codeHash = crypto
            .createHash("sha256")
            .update(code)
            .digest("hex");

        const admin = await Admin.findOne({
            email,
            resetCodeHash: codeHash,
            resetCodeExpires: { $gt: new Date() }
        });

        if (!admin) {
            return res.status(400).json({
                message: "Invalid or expired verification code."
            });
        }

        admin.password = await bcrypt.hash(newPassword, 12);
        admin.resetCodeHash = undefined;
        admin.resetCodeExpires = undefined;

        await admin.save();

        return res.json({
            message: "Password reset successful. You can now sign in."
        });

    } catch (error) {
        console.error("Reset password error:", error.message);
        return res.status(500).json({
            message: "Unable to reset password. Please try again."
        });
    }
});


router.post("/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!username || !email || password.length < 8) {
            return res.status(400).json({
                message: "Username, email, and password (at least 8 characters) are required."
            });
        }

        // Check if username or email already exists.
        const existingAdmin = await Admin.findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });

        if (existingAdmin) {
            return res.status(409).json({
                message: "Username or email is already registered."
            });
        }

        // Hash the password before saving.
        const hashedPassword = await bcrypt.hash(password, 12);

        const newAdmin = await Admin.create({
            username: username,
            email: email,
            password: hashedPassword
        });

        return res.status(201).json({
            message: "Registration successful!",
            admin: {
                username: newAdmin.username,
                email: newAdmin.email
            }
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Username or email is already registered."
            });
        }

        return res.status(500).json({
            message: "Registration failed. Please try again."
        });
    }
});

module.exports = router;
