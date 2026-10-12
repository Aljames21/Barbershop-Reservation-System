const token = sessionStorage.getItem("adminToken");

if (!token) {
    window.location.href = "index.html";
}