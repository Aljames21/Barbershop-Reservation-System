document.getElementById("logout-btn")
.addEventListener("click", ()=>{

    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("admin");

    window.location.href = "index.html";

});