document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const result = await response.json();

  if (result.success) {
    sessionStorage.setItem("token", result.token);
    sessionStorage.setItem("loggedUser", result.user);
    sessionStorage.setItem("isAdmin", result.isAdmin ? "true" : "false");
    window.location.href = "e7a0d0c0c5f25d4a4e7f8e1b5e4e3d1c5cfe2a65.html";
  } else {
    document.getElementById("errorMsg").textContent = "Usuário ou senha inválidos!";
  }
});
