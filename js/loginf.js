const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");
const loginButton = document.getElementById("loginButton");

function setLoadingState(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading ? "Entrando..." : "Entrar";
}

function showError(message = "") {
  errorMsg.textContent = message;
}

[usernameInput, passwordInput].forEach(input => {
  input.addEventListener("input", () => showError(""));
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError("Preencha usuário e senha.");
    return;
  }

  setLoadingState(true);
  showError("");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (response.ok && result?.success) {
      sessionStorage.setItem("token", result.token);
      sessionStorage.setItem("loggedUser", result.user);
      window.location.href = "ksmklewumf.html";
      return;
    }

    showError(result?.message || "Usuário ou senha inválidos!");
  } catch {
    showError("Não foi possível conectar agora. Tente novamente.");
  } finally {
    setLoadingState(false);
  }
});
