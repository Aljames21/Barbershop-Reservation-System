const fs = require("fs");
const path = require("path");

const sourceDirectory = path.resolve(__dirname, "..");
const outputDirectory = path.join(__dirname, "dist");
const productionSiteUrl = "https://barbershop-reservation-system-five.vercel.app";

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(path.join(outputDirectory, "images"), { recursive: true });

let html = fs.readFileSync(
    path.join(sourceDirectory, "customer_feedback.html"),
    "utf8"
);

html = html.replaceAll('href="index.html"', `href="${productionSiteUrl}/"`);

fs.writeFileSync(
    path.join(outputDirectory, "customer_feedback.html"),
    html
);

for (const fileName of ["customer_feedback.css", "customer_feedback.js"]) {
    fs.copyFileSync(
        path.join(sourceDirectory, fileName),
        path.join(outputDirectory, fileName)
    );
}

fs.copyFileSync(
    path.join(sourceDirectory, "images", "logo.jpg"),
    path.join(outputDirectory, "images", "logo.jpg")
);

console.log("Built isolated customer feedback page in dist/.");
