// /home/deploy/empresa01/ecosystem.config.js
const path = require("path");

// Deriva um nome seguro a partir do diretório da instância (ex.: empresa01)
const INSTANCE = (process.env.INSTANCE_NAME || path.basename(path.resolve(__dirname)))
  .toLowerCase()
  .replace(/[^a-z0-9-_]/g, "-");

// Portas FIXAS (ajuste aqui se no seu Nginx for diferente)
const BACKEND_PORT  = Number(process.env.BACKEND_PORT)  || 4001;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 3001;

// Usa caminhos com base no diretório deste arquivo (portável entre instâncias)
const BACKEND_CWD   = path.join(__dirname, "backend");
const BACKEND_FILE  = path.join(__dirname, "backend", "dist", "server.js");
const FRONTEND_CWD  = path.join(__dirname, "frontend");
const FRONTEND_FILE = path.join(__dirname, "frontend", "server.js");

module.exports = {
  apps: [
    {
      // --- BACKEND ---
      name: `${INSTANCE}-backend`,
      script: BACKEND_FILE,
      cwd: BACKEND_CWD,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      exp_backoff_restart_delay: 200, // evita restart loop agressivo
      merge_logs: true,
      time: true,
      // Reinicia todo dia às 04:00
      cron_restart: "0 4 * * *",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: String(BACKEND_PORT)
      }
    },
    {
      // --- FRONTEND ---
      name: `${INSTANCE}-frontend`,
      script: FRONTEND_FILE,
      cwd: FRONTEND_CWD,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      exp_backoff_restart_delay: 200,
      merge_logs: true,
      time: true,
      // Reinicia todo dia às 04:05
      cron_restart: "5 4 * * *",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: String(FRONTEND_PORT)
      }
    }
  ]
};
