const API_URL = "https://barbershop-reservation-system.onrender.com/api";
const card = document.getElementById("card");

const signinPanel = card.querySelector(".panel-signin");
const signupPanel = card.querySelector(".panel-signup");
const overlayLeft = card.querySelector(".overlay-left");
const overlayRight = card.querySelector(".overlay-right");


function setMode(mode) {
  const signup = mode === "signup";

  card.classList.toggle("is-signup", signup);

  signinPanel.inert = signup;
  signupPanel.inert = !signup;
  overlayRight.inert = signup;
  overlayLeft.inert = !signup;
}


document.querySelectorAll("[data-switch]").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.switch));
});


document.querySelectorAll('.pw-check input[type="checkbox"]').forEach((box) => {
  box.addEventListener("change", () => {
    const input = document.getElementById(box.dataset.target);
    if (input) {
      input.type = box.checked ? "text" : "password";
    }
  });
});


const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("login-error");
    const submitButton = loginForm.querySelector('button[type="submit"]');

    errorMessage.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";

    try {
      const response = await fetch(
        `${API_URL}/admin/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email: email, password: password })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        errorMessage.textContent =
          data.message || "Invalid email or password.";
        return;
      }

      if (!data.token) {
        errorMessage.textContent = "Login token was not returned.";
        return;
      }

      sessionStorage.setItem("adminToken", data.token);
      sessionStorage.setItem("admin", "yes");

      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Login error:", error);
      errorMessage.textContent =
        "Cannot connect to the server. Check your backend.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Sign in";
    }
  });
}


const signupForm = document.getElementById("signup-form");

if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("signup-username").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;
        const errorMessage = document.getElementById("signup-error");
        const submitButton = signupForm.querySelector('button[type="submit"]');

        errorMessage.textContent = "";
        submitButton.disabled = true;
        submitButton.textContent = "Creating account...";

        try {
            const response = await fetch(
                `${API_URL}/admin/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: username,
                        email: email,
                        password: password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                errorMessage.textContent =
                    data.message || "Registration failed.";
                return;
            }

            alert("Account created successfully! You can now sign in.");

            signupForm.reset();
            setMode("signin");

        } catch (error) {
            console.error("Registration error:", error);
            errorMessage.textContent =
                "Cannot connect to the server. Check your backend.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Sign up";
        }
    });
}


const forgotLink = document.getElementById("forgot-password-link");
const forgotPanel = document.querySelector(".panel-forgot");
const backToLogin = document.getElementById("back-to-login");
const forgotForm = document.getElementById("forgot-form");

if (forgotLink && forgotPanel) {
    forgotLink.addEventListener("click", (event) => {
        event.preventDefault();

        setMode("signin");

        signinPanel.inert = true;
        signupPanel.inert = true;
        forgotPanel.inert = false;

        signinPanel.style.display = "none";
        signupPanel.style.display = "none";
        forgotPanel.style.display = "flex";
    });
}

if (backToLogin && forgotPanel) {
    backToLogin.addEventListener("click", () => {
        forgotPanel.style.display = "none";
        forgotPanel.inert = true;

        signinPanel.style.display = "flex";
        signinPanel.inert = false;

        signupPanel.style.display = "flex";
        signupPanel.inert = true;

        setMode("signin");
    });
}

if (forgotForm) {
    forgotForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("reset-email").value.trim();
        const message = document.getElementById("forgot-message");
        const button = forgotForm.querySelector('button[type="submit"]');

        message.textContent = "";
        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const response = await fetch(
                `${API_URL}/admin/forgot-password`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                message.textContent = data.message || "Unable to send code.";
                return;
            }

            message.textContent =
            data.message + " Check your inbox and spam folder.";

             document.getElementById("verify-form").style.display = "block";

        } catch (error) {
            console.error("Forgot password error:", error);
            message.textContent = "Cannot connect to the server.";
        } finally {
            button.disabled = false;
            button.textContent = "Send Code";
        }
    });
}

const verifyForm = document.getElementById("verify-form");

if(verifyForm){

verifyForm.addEventListener("submit", async(e)=>{

e.preventDefault();


const email = document.getElementById("reset-email").value.trim();
const code = document.getElementById("reset-code").value.trim();
const newPassword = document.getElementById("new-password").value;
const confirmPassword = document.getElementById("confirm-password").value;

const message = document.getElementById("reset-message");


if(newPassword !== confirmPassword){

message.textContent="Passwords do not match.";
return;

}


try{

const response = await fetch(
`${API_URL}/admin/reset-password`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({

email:email,
code:code,
newPassword:newPassword

})

});


const data = await response.json();


if(!response.ok){

message.textContent=data.message;
return;

}


message.textContent="Password changed successfully!";


setTimeout(()=>{

window.location.reload();

},2000);


}catch(error){

console.log(error);

message.textContent="Server error.";

}


});


}

