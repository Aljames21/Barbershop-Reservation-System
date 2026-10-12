
const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client
});

function encodeSubject(subject = "") {
    return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function encodeMessage(message) {
    return Buffer.from(message, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

const transporter = {
    async sendMail(options) {
       
    const rawFrom = options.from || process.env.EMAIL_USER;

        const match = rawFrom.match(/^(.*?)\s*<([^<>]+)>$/);

        const from = match
        ? `${encodeDisplayName(match[1].replace(/^["']|["']$/g, ""))} <${match[2]}>`
        : rawFrom;

        const to = options.to;

        if (!from || !to) {
            throw new Error("Missing sender or recipient email.");
        }

        const subject = encodeSubject(options.subject || "");
        
        function encodeDisplayName(name = "") {
         return `=?UTF-8?B?${Buffer.from(name, "utf8").toString("base64")}?=`;
        }

        const html = options.html || "";
        const text = options.text || "";

const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: multipart/alternative; boundary=\"barbershop_boundary\"",
    "",
    "--barbershop_boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
    "",
    "--barbershop_boundary",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64"),
    "",
    "--barbershop_boundary--",
    ""
].join("\r\n");

        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodeMessage(message)
            }
        });

        console.log("Gmail API email sent:", response.data.id);

        return {
            messageId: response.data.id,
            response: "Email accepted by Gmail API"
        };
    }
};

module.exports = transporter;

