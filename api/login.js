import crypto from "crypto";

function parseUsers(rawUsers = "") {
  const usersMap = {};

  rawUsers
    .split(",")
    .map(pair => pair.trim())
    .filter(Boolean)
    .forEach(pair => {
      const separatorIndex = pair.indexOf(":");
      if (separatorIndex === -1) return;

      const user = pair.slice(0, separatorIndex).trim();
      const pass = pair.slice(separatorIndex + 1).trim();
      if (user && pass) usersMap[user] = pass;
    });

  return usersMap;
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método não permitido" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Usuário e senha são obrigatórios" });
  }

  const usersMap = parseUsers(process.env.LOGIN_USERS || "");
  const storedPassword = usersMap[username];

  if (storedPassword && storedPassword === password) {
    return res.status(200).json({
      success: true,
      token: crypto.randomBytes(32).toString("hex"),
      user: username
    });
  }

  return res.status(401).json({ success: false, message: "Usuário ou senha inválidos" });
}
