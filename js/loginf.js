const output = document.getElementById("output");
const form = document.getElementById("loginForm");

function startBoot() {
  output.textContent = "Initializing";
  let dots = 0;

  const loading = setInterval(() => {
    dots = (dots + 1) % 4;
    output.textContent = "Initializing" + ".".repeat(dots);
  }, 400);

  setTimeout(() => {
    clearInterval(loading);

    // Limpa o terminal antes de mostrar autenticação
    output.textContent = "Authentication required.\n";

    form.classList.remove("hidden");
    document.getElementById("username").focus();
  }, 2500);
}

startBoot();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("errorMsg").textContent = "Access denied";
});
