
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";

import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// Firebase Web App configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDteaHluYsTMITJOzYLPTYfPUTM_rA9DsU",
  authDomain: "sanados-barbershop.firebaseapp.com",
  projectId: "sanados-barbershop",
  storageBucket: "sanados-barbershop.firebasestorage.app",
  messagingSenderId: "479458312169",
  appId: "1:479458312169:web:d42e8b19632ec85b021578",
  measurementId: "G-BH5V2T0JPW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const phoneInput = document.getElementById("phoneNumber");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const otpInput = document.getElementById("otpCode");
const otpSection = document.getElementById("otpSection");
const otpStatus = document.getElementById("otpStatus");

let confirmationResult = null;
let verifiedPhone = null;
let recaptchaVerifier = null;

function setOtpStatus(message) {
    otpStatus.textContent = message;
}

function formatPhilippineNumber(value) {
    const phone = value.replace(/\s|-/g, "");

    if (!/^09\d{9}$/.test(phone)) {
        throw new Error("Enter a valid 11-digit Philippine mobile number.");
    }

    return "+63" + phone.substring(1);
}

async function setupRecaptcha() {
    if (!recaptchaVerifier) {
        recaptchaVerifier = new RecaptchaVerifier(
            auth,
            "recaptcha-container",
            {
                size: "normal"
            }
        );
    }

    await recaptchaVerifier.render();
}

// SEND OTP
sendOtpBtn.addEventListener("click", async () => {
    sendOtpBtn.disabled = true;

    try {
        const phone = formatPhilippineNumber(phoneInput.value);

        verifiedPhone = null;
        confirmationResult = null;
        otpSection.hidden = true;

        setOtpStatus("Preparing phone verification...");

        await setupRecaptcha();

        confirmationResult = await signInWithPhoneNumber(
            auth,
            phone,
            recaptchaVerifier
        );

        otpSection.hidden = false;
        setOtpStatus(
            "Verification code requested. Enter the 6-digit OTP."
        );
    } catch (error) {
        console.error("Send OTP error:", error);
        setOtpStatus(
            "Unable to send OTP: " + error.message
        );
    } finally {
        sendOtpBtn.disabled = false;
    }
});

// VERIFY OTP
verifyOtpBtn.addEventListener("click", async () => {
    verifyOtpBtn.disabled = true;

    try {
        if (!confirmationResult) {
            throw new Error("Please send an OTP first.");
        }

        const code = otpInput.value.trim();

        if (!/^\d{6}$/.test(code)) {
            throw new Error("Enter the 6-digit verification code.");
        }

        const result = await confirmationResult.confirm(code);

        verifiedPhone = result.user.phoneNumber;

        setOtpStatus("Phone number verified successfully!");
        otpSection.hidden = true;
        phoneInput.readOnly = true;
        sendOtpBtn.disabled = true;

    } catch (error) {
        console.error("Verify OTP error:", error);
        setOtpStatus("Verification failed: " + error.message);
    } finally {
        verifyOtpBtn.disabled = false;
    }
});

// Expose a function for the existing booking.js
window.getVerifiedPhoneAuth = async function () {
    const user = auth.currentUser;

    if (!user || !verifiedPhone ||
        user.phoneNumber !== verifiedPhone) {
        throw new Error("Please verify your mobile number first.");
    }

    return {
        phoneNumber: verifiedPhone,
        idToken: await user.getIdToken()
    };
};
