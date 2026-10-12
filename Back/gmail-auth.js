
const fs = require("fs");
const path = require("path");
const http = require("http");
const { google } = require("googleapis");

const credentialsPath = path.join(
    __dirname,
    "gmail-oauth-client.json"
);

if (!fs.existsSync(credentialsPath)) {
    throw new Error(
        "Missing gmail-oauth-client.json in the Back folder."
    );
}

const credentials = JSON.parse(
    fs.readFileSync(credentialsPath, "utf8")
);

const config = credentials.web || credentials.installed;

if (!config) {
    throw new Error(
        "Invalid OAuth JSON. Expected web or installed credentials."
    );
}

const redirectUri = "http://localhost:3000/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri
);

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, redirectUri);

    if (url.pathname !== "/oauth2callback") {
        res.writeHead(404);
        return res.end("Not found");
    }

    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");

    if (error || !code) {
        res.writeHead(400);
        res.end("Authorization failed. Check the terminal.");
        server.close();
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        res.writeHead(200, {
            "Content-Type": "text/plain"
        });

        res.end(
            "Authorization successful. You may close this page."
        );

        if (!tokens.refresh_token) {
            console.error(
                "No refresh token received. Do not continue yet."
            );
            server.close();
            return;
        }

        console.log("\nAuthorization successful!");
        console.log("REFRESH TOKEN (keep private):");
        console.log(tokens.refresh_token);

        server.close();
    } catch (err) {
        console.error("Authorization error:", err.message);
        res.writeHead(500);
        res.end("Authorization failed. Check the terminal.");
        server.close();
    }
});

server.listen(3000, "localhost", () => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/gmail.send"
        ]
    });

    console.log("Open this URL in your browser:\n");
    console.log(authUrl);
    console.log("\nWaiting for Google authorization...");
});
