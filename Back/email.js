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

function encodeMimeBody(value) {
    return Buffer.from(value, "utf8")
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n") || "";
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

        const headers = [
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            "MIME-Version: 1.0"
        ];

        let body;
        if (html) {
            const boundary = `barbershop-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

            const parts = [];
            if (text) {
                parts.push(
                    `--${boundary}`,
                    "Content-Type: text/plain; charset=UTF-8",
                    "Content-Transfer-Encoding: base64",
                    "",
                    encodeMimeBody(text)
                );
            }

            parts.push(
                `--${boundary}`,
                "Content-Type: text/html; charset=UTF-8",
                "Content-Transfer-Encoding: base64",
                "",
                encodeMimeBody(html),
                `--${boundary}--`,
                ""
            );
            body = parts.join("\r\n");
        } else {
            headers.push(
                "Content-Type: text/plain; charset=UTF-8",
                "Content-Transfer-Encoding: base64"
            );
            body = `${encodeMimeBody(text)}\r\n`;
        }

        const message = `${headers.join("\r\n")}\r\n\r\n${body}`;


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
