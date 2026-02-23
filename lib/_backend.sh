#!/bin/bash
#
# functions for setting up app backend
#######################################
# creates REDIS db using docker
# Arguments:
#   None
#######################################
backend_redis_create() {
  print_banner
  printf "${WHITE} 💻 Criando Redis & Banco Postgres...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  # Configurações automáticas do Redis
  redis_host="127.0.0.1" # Modificado
  redis_password="${mysql_root_password}"

  sudo su - root <<EOF
  usermod -aG docker deploy
  
  # Verifica se o container Redis já existe e remove se existir
  if docker ps -a | grep -q "redis-${instancia_add}"; then
    echo "🔄 Removendo container Redis existente..."
    docker rm -f redis-${instancia_add}
  fi
  
  echo "🐳 Criando container Redis..."
  # Cria o container Redis com configurações automáticas
  docker run --name redis-${instancia_add} \
    -p ${redis_port}:6379 \
    --restart always \
    --detach \
    redis:alpine \
    redis-server --requirepass ${redis_password}
  
  # Aguarda o Redis inicializar
  echo "⏳ Aguardando Redis inicializar..."
  sleep 5
  
  # Verifica se o Redis está rodando
  if docker ps | grep -q "redis-${instancia_add}"; then
    echo "✅ Redis criado com sucesso!"
    echo "   📍 Porta: ${redis_port}"
    echo "   🔑 Senha: mesma do banco de dados"
    echo "   🏠 Host: ${redis_host}" # Modificado
  else
    echo "❌ Erro ao criar Redis"
    exit 1
  fi
  
  sleep 2
  
  # Configuração do PostgreSQL
  echo "🗄️  Configurando PostgreSQL..."
  sudo su - postgres <<DBEOF
  createdb ${instancia_add};
  psql -c "CREATE USER ${instancia_add} SUPERUSER INHERIT CREATEDB CREATEROLE;"
  psql -c "ALTER USER ${instancia_add} PASSWORD '${mysql_root_password}';"
DBEOF

EOF

  sleep 2
}

#######################################
# sets environment variable for backend.
# Arguments:
#   None
#######################################
backend_set_env() {
  print_banner
  printf "${WHITE} 💻 Configurando variáveis de ambiente (backend)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  # ensure idempotency
  backend_url=$(echo "${backend_url/https:\/\/}")
  backend_url=${backend_url%%/*}
  backend_url=https://$backend_url

  # ensure idempotency
  frontend_url=$(echo "${frontend_url/https:\/\/}")
  frontend_url=${frontend_url%%/*}
  frontend_url=https://$frontend_url

  # Configurações automáticas do Redis
  redis_host="127.0.0.1" # Modificado
  redis_password="${mysql_root_password}"
  redis_uri="redis://:${redis_password}@${redis_host}:${redis_port}"

sudo su - deploy << EOF
  cat <<[-]EOF > /home/deploy/${instancia_add}/backend/.env
NODE_ENV=
BACKEND_URL=${backend_url}
FRONTEND_URL=${frontend_url}
PROXY_PORT=443
PORT=${backend_port}

DB_HOST=localhost
DB_DIALECT=postgres
DB_USER=${instancia_add}
DB_PASS=${mysql_root_password}
DB_NAME=${instancia_add}
DB_PORT=5432

MASTER_KEY=senha_master

IMPORT_FALLBACK_FILE=1

TIMEOUT_TO_IMPORT_MESSAGE=1000

APP_TRIALEXPIRATION=3

JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}

# REDIS CONFIGURADO AUTOMATICAMENTE
REDIS_URI=${redis_uri}
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000

FLOW_MENU_COOLDOWN_SEC=8

USER_LIMIT=${max_user}
CONNECTIONS_LIMIT=${max_whats}
CLOSED_SEND_BY_ME=true

VERIFY_TOKEN=whaticket

#METODOS DE PAGAMENTO
MP_ACCESS_TOKEN=

FACEBOOK_APP_ID=2813216208828642
FACEBOOK_APP_SECRET=8233912aeade366dd8e2ebef6be256b6

# EMAIL
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="seuemail@gmail.com"
SMTP_PASS="suasenha"
SMTP_FROM="Redefinição de senha <seuemail@gmail.com>"

[-]EOF

echo "✅ Variáveis de ambiente configuradas com Redis automático"
EOF

  sleep 2
}

#######################################
# installs node.js dependencies
# Arguments:
#   None
#######################################
backend_node_dependencies() {
  print_banner
  printf "${WHITE} 💻 Instalando dependências do backend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/backend
  npm -f install
EOF

  sleep 2
}

#######################################
# compiles backend code
# Arguments:
#   None
#######################################
backend_node_build() {
  print_banner
  printf "${WHITE} 💻 Compilando o código do backend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/backend
  npm run build
  
  # Verifica se o build foi bem-sucedido
  if [ -d "dist" ] && [ -f "dist/server.js" ]; then
    echo "✅ Build backend realizado com sucesso!"
  else
    echo "❌ Falha no build backend"
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
backend_update() {
  print_banner
  printf "${WHITE} 💻 Atualizando o backend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${empresa_atualizar}
  pm2 stop ${empresa_atualizar}-backend
  git pull
  cd /home/deploy/${empresa_atualizar}/backend
  npm -f install
  npm update -f
  npm -f install @types/fs-extra
  rm -rf dist 
  npm run build
  npx sequelize db:migrate
  npx sequelize db:seed
  pm2 start ${empresa_atualizar}-backend
  pm2 save 
EOF

  sleep 2
}

#######################################
# runs db migrate
# Arguments:
#   None
#######################################
backend_db_migrate() {
  print_banner
  printf "${WHITE} 💻 Executando db:migrate...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/backend
  npx sequelize db:migrate
  
  # Verifica se migrate foi bem-sucedido
  if [ $? -eq 0 ]; then
    echo "✅ Migrations executadas com sucesso!"
  else
    echo "❌ Erro ao executar migrations"
    exit 1
  fi
EOF

  sleep 2
}

#######################################
# runs db seed
# Arguments:
#   None
#######################################
backend_db_seed() {
  print_banner
  printf "${WHITE} 💻 Executando db:seed...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/backend
  npx sequelize db:seed:all
  
  # Verifica se seed foi bem-sucedido
  if [ $? -eq 0 ]; then
    echo "✅ Seeds executados com sucesso!"
  else
    echo "❌ Erro ao executar seeds"
    exit 1
  fi
EOF

  sleep 2
}

#######################################
# starts backend using pm2 in 
# production mode.
# Arguments:
#   None
#######################################
backend_start_pm2() {
  print_banner
  printf "${WHITE} 💻 Iniciando pm2 (backend)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  cd /home/deploy/${instancia_add}/backend
  
  # Para processo existente se houver
  pm2 stop ${instancia_add}-backend 2>/dev/null || true
  pm2 delete ${instancia_add}-backend 2>/dev/null || true
  
  # Inicia o backend
  pm2 start dist/server.js --name ${instancia_add}-backend
  
  # Verifica se iniciou corretamente
  if pm2 list | grep -q "${instancia_add}-backend"; then
    echo "✅ Backend iniciado com sucesso no PM2"
  else
    echo "❌ Falha ao iniciar backend no PM2"
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
backend_nginx_setup() {
  print_banner
  printf "${WHITE} 💻 Configurando nginx (backend)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  backend_hostname=$(echo "${backend_url/https:\/\/}")

sudo su - root << EOF
# Remove configuração existente se houver
rm -f /etc/nginx/sites-enabled/${instancia_add}-backend
rm -f /etc/nginx/sites-available/${instancia_add}-backend

cat > /etc/nginx/sites-available/${instancia_add}-backend << 'END'
server {
  server_name $backend_hostname;
  location / {
    proxy_pass http://127.0.0.1:${backend_port};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_cache_bypass \$http_upgrade;
  }
}
END

# Cria link simbólico se não existir
if [ ! -f "/etc/nginx/sites-enabled/${instancia_add}-backend" ]; then
  ln -s /etc/nginx/sites-available/${instancia_add}-backend /etc/nginx/sites-enabled
fi

echo "✅ Nginx backend configurado para ${backend_hostname}"
EOF

  sleep 2
}

#######################################
# verifies backend installation
# Arguments:
#   None
#######################################
backend_verify_installation() {
  print_banner
  printf "${WHITE} 💻 Verificando instalação do backend...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  echo "🔍 Verificando backend..."
  
  # Verifica PM2
  if pm2 list | grep -q "${instancia_add}-backend"; then
    echo "✅ PM2 backend: OK"
  else
    echo "❌ PM2 backend: FALHA"
    exit 1
  fi
  
  # Verifica se responde na porta
  sleep 5
  if curl -f http://localhost:${backend_port}/ >/dev/null 2>&1; then
    echo "✅ Backend respondendo: OK"
  else
    echo "⚠️  Backend não respondeu imediatamente, aguardando..."
    sleep 10
    if curl -f http://localhost:${backend_port}/ >/dev/null 2>&1; then
      echo "✅ Backend respondendo: OK"
    else
      echo "❌ Backend não responde: FALHA"
      exit 1
    fi
  fi
EOF

  sleep 2
}

#######################################
# verifies redis installation
# Arguments:
#   None
#######################################
backend_verify_redis() {
  print_banner
  printf "${WHITE} 💻 Verificando instalação do Redis...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - root <<EOF
  echo "🔍 Verificando Redis..."
  
  # Verifica container
  if docker ps | grep -q "redis-${instancia_add}"; then
    echo "✅ Container Redis: OK"
  else
    echo "❌ Container Redis: FALHA"
    exit 1
  fi
  
  # Testa conexão com Redis
  if docker exec redis-${instancia_add} redis-cli -a ${mysql_root_password} ping | grep -q "PONG"; then
    echo "✅ Conexão Redis: OK"
  else
    echo "❌ Conexão Redis: FALHA"
    exit 1
  fi
  
  echo "📊 Redis configurado automaticamente:"
  echo "   🏠 Host: 127.0.0.1" # Modificado
  echo "   🔑 Senha: mesma do banco"
  echo "   📍 Porta: ${redis_port}"
EOF

  sleep 2
}