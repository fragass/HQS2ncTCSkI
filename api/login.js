export default function handler(req, res) {
 if (req.method !== "POST") {
 return res.status(405).json({ success: false, message: "Método não permitido" });
 }

 const { username, password } = req.body;

 // Recupera variável de ambiente
  const usersEnv = process.env.LOGIN_USERS || "";
 const usersArray = usersEnv.split(",");

 // Cria um mapa de {usuario:senha}
  const usersMap = {};
 usersArray.forEach(pair => {
 const [user, pass] = pair.split(":");
 usersMap[user] = pass;
 });

 // Valida login
  if (usersMap[username] && usersMap[username] === password) {
 return res.status(200).json({ success: true });
 } else {
 return res.status(401).json({ success: false });
 }
}