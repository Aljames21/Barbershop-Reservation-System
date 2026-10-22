document.querySelectorAll(".logout").forEach((logoutButton) => {
    logoutButton.addEventListener("click", (event) => {
        if (!window.confirm("Are you sure you want to log out?")) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        sessionStorage.removeItem("adminToken");
        sessionStorage.removeItem("admin");
        window.location.href = "index.html";
    });
});