#!/bin/bash
# 
# functions for setting up app frontend

#######################################
# installed node packages
# Arguments:
#   None
#######################################
frontend_node_dependencies() {
  print_banner
  printf "${WHITE} 💻 Instalando dependências do frontend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/frontend
  
  # Limpa cache e node_modules para instalação limpa
  rm -rf node_modules package-lock.json npm-debug.log*
  npm cache clean --force
  
  # Instala react-scripts primeiro (versão compatível)
  echo "📦 Instalando React Scripts..."
  npm install react-scripts@5 --save --force
  
  # Verifica se usa CRACO e instala se necessário
  if [ -f "craco.config.js" ]; then
    echo "🔧 Detectado CRACO, instalando dependências..."
    npm install @craco/craco --save --force
  fi
  
  # Instala todas as dependências
  echo "📦 Instalando todas as dependências..."
  npm install --force --legacy-peer-deps
  
  # Verificação final de dependências críticas
  if [ ! -d "node_modules/react" ]; then
    echo "⚠️  React não instalado, tentando instalação alternativa..."
    npm install react react-dom --save --force
  fi
EOF

  sleep 2
}

#######################################
# compiles frontend code
# Arguments:
#   None
#######################################
frontend_node_build() {
  print_banner
  printf "${WHITE} 💻 Compilando o código do frontend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/frontend
  
  # Verifica se o projeto usa CRACO ou React Scripts padrão
  if [ -f "craco.config.js" ]; then
    echo "🔧 Compilando com CRACO..."
    npx craco build || {
      echo "⚠️  Build com CRACO falhou, tentando com react-scripts..."
      npm run build
    }
  else
    echo "⚛️  Compilando com React Scripts padrão..."
    npm run build || {
      echo "⚠️  Build padrão falhou, tentando alternativas..."
      # Tenta com variáveis de ambiente para build
      CI=false npm run build
    }
  fi
  
  # Verifica se o build foi bem-sucedido
  if [ -d "build" ] && [ -f "build/index.html" ]; then
    echo "✅ Build frontend realizado com sucesso!"
  else
    echo "❌ Falha no build frontend. Verifique os logs acima."
    exit 1
  fi
EOF

  sleep 2
}

#######################################
# updates frontend code
# Arguments:
#   None
#######################################
frontend_update() {
  print_banner
  printf "${WHITE} 💻 Atualizando o frontend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${empresa_atualizar}
  pm2 stop ${empresa_atualizar}-frontend
  
  # Atualiza o código (git pull ou outro método)
  if [ -d ".git" ]; then
    git pull
  else
    echo "⚠️  Não é um repositório git, pulando atualização de código..."
  fi
  
  cd /home/deploy/${empresa_atualizar}/frontend
  
  # Limpeza para instalação limpa
  rm -rf node_modules package-lock.json build
  
  # Reinstala dependências
  npm install react-scripts@5 --save --force
  
  # Verifica CRACO
  if [ -f "craco.config.js" ]; then
    npm install @craco/craco --save --force
  fi
  
  npm install --force --legacy-peer-deps
  
  # Rebuild
  if [ -f "craco.config.js" ]; then
    npx craco build
  else
    npm run build
  fi
  
  # Reinicia o frontend
  pm2 start ${empresa_atualizar}-frontend
  pm2 save
EOF

  sleep 2
}

#######################################
# sets frontend environment variables
# Arguments:
#   None
#######################################
frontend_set_env() {
  print_banner
  printf "${WHITE} 💻 Configurando variáveis de ambiente (frontend)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  # ensure idempotency
  backend_url=$(echo "${backend_url/https:\/\/}")
  backend_url=${backend_url%%/*}
  backend_url=https://$backend_url

sudo su - deploy << EOF
  cat <<[-]EOF > /home/deploy/${instancia_add}/frontend/.env
REACT_APP_BACKEND_URL=${backend_url}
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24

REACT_APP_BACKEND_PROTOCOL=https
REACT_APP_BACKEND_HOST=URL_BACKEND
REACT_APP_BACKEND_PORT=443
REACT_APP_LOCALE=pt-br
REACT_APP_TIMEZONE=America/Sao_Paulo
REACT_APP_NUMBER_SUPPORT=55XXXXXXXXXXX

CERTIFICADOS=false
HTTPS=false
SSL_CRT_FILE=F:\\bkpidx\\workflow\\backend\\certs\\localhost.pem
SSL_KEY_FILE=F:\\bkpidx\\workflow\\backend\\certs\\localhost-key.pem

REACT_APP_FACEBOOK_APP_ID=2813216208828642
REACT_APP_REQUIRE_BUSINESS_MANAGEMENT=TRUE

# Variáveis para build
GENERATE_SOURCEMAP=false
DISABLE_ESLINT_PLUGIN=false
[-]EOF
EOF

  sleep 2

sudo su - deploy << EOF
  cat <<[-]EOF > /home/deploy/${instancia_add}/frontend/server.js
//simple express server to run frontend production build;
const express = require("express");
const path = require("path");
const app = express();
app.use(express.static(path.join(__dirname, "build")));
app.get("/*", function (req, res) {
	res.sendFile(path.join(__dirname, "build", "index.html"));
});
app.listen(${frontend_port});

[-]EOF
EOF

  sleep 2
}

#######################################
# starts pm2 for frontend
# Arguments:
#   None
#######################################
frontend_start_pm2() {
  print_banner
  printf "${WHITE} 💻 Iniciando pm2 (frontend)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/frontend
  
  # Para o processo se já estiver rodando
  pm2 stop ${instancia_add}-frontend 2>/dev/null || true
  pm2 delete ${instancia_add}-frontend 2>/dev/null || true
  
  # Inicia o frontend
  pm2 start server.js --name ${instancia_add}-frontend
  pm2 save
  
  # Verifica se iniciou corretamente
  if pm2 list | grep -q "${instancia_add}-frontend"; then
    echo "✅ Frontend PM2 iniciado com sucesso"
  else
    echo "❌ Falha ao iniciar frontend no PM2"
    exit 1
  fi
EOF

  sleep 2
  
  # Configura startup do PM2 apenas uma vez
  if ! grep -q "pm2 startup" /etc/rc.local 2>/dev/null; then
    sudo su - root <<EOF
    pm2 startup systemd -u deploy --hp /home/deploy
    sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
EOF
  fi
  
  sleep 2
}

#######################################
# sets up nginx for frontend
# Arguments:
#   None
#######################################
frontend_nginx_setup() {
  print_banner
  printf "${WHITE} 💻 Configurando nginx (frontend)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  frontend_hostname=$(echo "${frontend_url/https:\/\/}")

sudo su - root << EOF
# Remove configuração existente se houver
rm -f /etc/nginx/sites-enabled/${instancia_add}-frontend
rm -f /etc/nginx/sites-available/${instancia_add}-frontend

cat > /etc/nginx/sites-available/${instancia_add}-frontend << 'END'
server {
  server_name $frontend_hostname;

  location / {
    proxy_pass http://127.0.0.1:${frontend_port};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_cache_bypass \$http_upgrade;
    proxy_read_timeout 3600;
    proxy_connect_timeout 3600;
    proxy_send_timeout 3600;
  }
}
END

# Cria link simbólico se não existir
if [ ! -f "/etc/nginx/sites-enabled/${instancia_add}-frontend" ]; then
  ln -s /etc/nginx/sites-available/${instancia_add}-frontend /etc/nginx/sites-enabled
fi
EOF

  sleep 2
}

#######################################
# verifies frontend installation
# Arguments:
#   None
#######################################
frontend_verify_installation() {
  print_banner
  printf "${WHITE} 💻 Verificando instalação do frontend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/frontend
  
  echo "🔍 Verificando se build existe..."
  if [ -d "build" ] && [ -f "build/index.html" ]; then
    echo "✅ Build frontend: OK"
  else
    echo "❌ Build frontend: FALHA"
    exit 1
  fi
  
  echo "🔍 Verificando se PM2 está rodando..."
  if pm2 list | grep -q "${instancia_add}-frontend"; then
    echo "✅ PM2 frontend: OK"
  else
    echo "❌ PM2 frontend: FALHA"
    exit 1
  fi
  
  echo "🔍 Testando resposta na porta ${frontend_port}..."
  if curl -f http://localhost:${frontend_port} >/dev/null 2>&1; then
    echo "✅ Servidor frontend: OK"
  else
    echo "❌ Servidor frontend: FALHA"
    exit 1
  fi
EOF

  sleep 2
}
