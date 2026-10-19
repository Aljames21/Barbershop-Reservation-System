
const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const verifyAdmin = require("../Middleware/authMiddleware");

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error(
                "Only JPG, PNG, and WebP images are allowed."
            ));
        }

        cb(null, true);
    }
});

router.post(
    "/service-image",
    verifyAdmin,
    (req, res, next) => {
        upload.single("image")(req, res, error => {
            if (error) {
                return res.status(400).json({
                    message: error.message
                });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message: "Please select an image."
                });
            }

            const result = await new Promise(
                (resolve, reject) => {
                    const stream =
                        cloudinary.uploader.upload_stream(
                            {
                                folder: "barbershop/services",
                                resource_type: "image"
                            },
                            (error, result) => {
                                if (error) return reject(error);
                                resolve(result);
                            }
                        );

                    stream.end(req.file.buffer);
                }
            );

            res.json({
                imageUrl: result.secure_url
            });

        } catch (error) {
            console.error("Image upload error:", error);

            res.status(500).json({
                message: "Unable to upload image."
            });
        }
    }
);

module.exports = router;
