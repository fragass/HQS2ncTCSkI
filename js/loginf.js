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
    // cria token temporário de sessão
    sessionStorage.setItem("auth", "true");

    // salva o telefone do usuário logado
    sessionStorage.setItem("loggedUserPhone", username);

    // redireciona para a página do Tetris
    window.location.href = "ksmklewumf.html";
  } else {
    document.getElementById("errorMsg").textContent = "Usuário ou senha inválidos!";
  }
});
