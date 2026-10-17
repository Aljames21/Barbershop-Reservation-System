
const { initializeApp, getApps, cert, applicationDefault } =
    require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

if (getApps().length === 0) {
    initializeApp({
        credential: applicationDefault(),
        projectId: "sanados-barbershop"
    });
}

module.exports = {
    getAuth
};
