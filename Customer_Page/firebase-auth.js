
const API_URL = "https://barbershop-reservation-system.onrender.com/api";

const phoneInput = document.getElementById("phoneNumber");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const otpInput = document.getElementById("otpCode");
const otpSection = document.getElementById("otpSection");
const otpStatus = document.getElementById("otpStatus");

let verifiedPhone = null;
let verificationToken = null;
let pendingPhone = null;

function setOtpStatus(message) {
    otpStatus.textContent = message;
}

function formatPhilippineNumber(value) {
    const phone = String(value || "").replace(/[\s-]/g, "");

    if (/^09\d{9}$/.test(phone)) {
        return "+63" + phone.substring(1);
    }

    if (/^\+639\d{9}$/.test(phone)) {
        return phone;
    }

    throw new Error("Enter a valid Philippine mobile number.");
}

async function requestOtp(endpoint, data) {
    const response = await fetch(`${API_URL}/otp/${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "OTP request failed.");
    }

    return result;
}

// SEND OTP
sendOtpBtn.addEventListener("click", async () => {
    sendOtpBtn.disabled = true;

    try {
        const phone = formatPhilippineNumber(phoneInput.value);

        verifiedPhone = null;
        verificationToken = null;
        pendingPhone = null;
        otpSection.hidden = true;
        otpInput.value = "";

        setOtpStatus("Sending verification code...");

        const result = await requestOtp("send", {
            phoneNumber: phone
        });

        pendingPhone = phone;
        otpSection.hidden = false;

        setOtpStatus(
            result.message ||
            "Enter the 6-digit OTP sent to your phone."
        );

    } catch (error) {
        console.error("Send OTP error:", error);
        setOtpStatus(error.message);
    } finally {
        if (!verifiedPhone) {
            sendOtpBtn.disabled = false;
        }
    }
});

// VERIFY OTP
verifyOtpBtn.addEventListener("click", async () => {
    verifyOtpBtn.disabled = true;

    try {
        if (!pendingPhone) {
            throw new Error("Please send an OTP first.");
        }

        if (formatPhilippineNumber(phoneInput.value) !== pendingPhone) {
            throw new Error(
                "Phone number changed. Please request a new OTP."
            );
        }

        const code = otpInput.value.trim();

        if (!/^\d{6}$/.test(code)) {
            throw new Error("Enter the 6-digit verification code.");
        }

        const result = await requestOtp("verify", {
            phoneNumber: pendingPhone,
            code: code
        });

        if (!result.verificationToken ||
            result.phoneNumber !== pendingPhone) {
            throw new Error("Invalid verification response.");
        }

        verifiedPhone = result.phoneNumber;
        verificationToken = result.verificationToken;

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

// Keep compatibility with existing booking.js
window.getVerifiedPhoneAuth = async function () {
    if (!verifiedPhone || !verificationToken) {
        throw new Error("Please verify your mobile number first.");
    }

    if (formatPhilippineNumber(phoneInput.value) !== verifiedPhone) {
        throw new Error("Verified phone number does not match.");
    }

    return {
        phoneNumber: verifiedPhone,
        idToken: verificationToken
    };
};
