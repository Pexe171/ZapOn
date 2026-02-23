#!/bin/bash

get_mysql_root_password() {
  
  print_banner
  printf "${WHITE} 💻 Definindo senha padrão (12243648) para Deploy e Banco de Dados...${GRAY_LIGHT}"
  printf "\n\n"
  mysql_root_password="12243648"
  sleep 1
}

get_instancia_add() {
  
  print_banner
  printf "${WHITE} 💻 Informe um nome para a Instância/Empresa que será instalada (Não utilizar espaços ou caracteres especiais; utilizar letras minusculas):${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " instancia_add
}

get_max_whats() {
  
  print_banner
  printf "${WHITE} 💻 Definindo Qtde de Conexões/Whats (999) para ${instancia_add}...${GRAY_LIGHT}"
  printf "\n\n"
  max_whats="999"
  sleep 1
}

get_max_user() {
  
  print_banner
  printf "${WHITE} 💻 Definindo Qtde de Usuários/Atendentes (999) para ${instancia_add}...${GRAY_LIGHT}"
  printf "\n\n"
  max_user="999"
  sleep 1
}

get_frontend_url() {
  
  print_banner
  printf "${WHITE} 💻 Digite o domínio do FRONTEND/PAINEL para a ${instancia_add}:${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " frontend_url
}

get_backend_url() {
  
  print_banner
  printf "${WHITE} 💻 Digite o domínio do BACKEND/API para a ${instancia_add}:${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " backend_url
}

get_frontend_port() {
  
  print_banner
  printf "${WHITE} 💻 Definindo porta do FRONTEND (3001) para ${instancia_add}...${GRAY_LIGHT}"
  printf "\n\n"
  frontend_port="3001"
  sleep 1
}

get_backend_port() {
  
  print_banner
  printf "${WHITE} 💻 Definindo porta do BACKEND (4001) para ${instancia_add}...${GRAY_LIGHT}"
  printf "\n\n"
  backend_port="4001"
  sleep 1
}

get_redis_port() {
  
  print_banner
  printf "${WHITE} 💻 Definindo porta do REDIS (5001) para ${instancia_add}...${GRAY_LIGHT}"
  printf "\n\n"
  redis_port="5001"
  sleep 1
}

get_deploy_email() {
  # Esta função não é mais usada, mas mantida para evitar quebras se chamada em outro lugar.
  # O email é tratado automaticamente no system_certbot_setup
  print_banner
  printf "${WHITE} 💻 SSL será configurado automaticamente...${GRAY_LIGHT}"
  printf "\n\n"
  sleep 1
}

get_empresa_delete() {
  
  print_banner
  printf "${WHITE} 💻 Digite o nome da Instância/Empresa que será Deletada (Digite o mesmo nome de quando instalou):${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " empresa_delete
}

get_empresa_atualizar() {
  
  print_banner
  printf "${WHITE} 💻 Digite o nome da Instância/Empresa que deseja Atualizar (Digite o mesmo nome de quando instalou):${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " empresa_atualizar
}

get_empresa_bloquear() {
  
  print_banner
  printf "${WHITE} 💻 Digite o nome da Instância/Empresa que deseja Bloquear (Digite o mesmo nome de quando instalou):${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " empresa_bloquear
}

get_empresa_desbloquear() {
  
  print_banner
  printf "${WHITE} 💻 Digite o nome da Instância/Empresa que deseja Desbloquear (Digite o mesmo nome de quando instalou):${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " empresa_desbloquear
}

get_empresa_dominio() {
  
  print_banner
  printf "${WHITE} 💻 Digite o nome da Instância/Empresa que deseja Alterar os Dominios (Atenção para alterar os dominios precisa digitar os 2, mesmo que vá alterar apenas 1):${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " empresa_dominio
}

get_alter_frontend_url() {
  
  print_banner
  printf "${WHITE} 💻 Digite o NOVO domínio do FRONTEND/PAINEL para a ${empresa_dominio}:${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " alter_frontend_url
}

get_alter_backend_url() {
  
  print_banner
  printf "${WHITE} 💻 Digite o NOVO domínio do BACKEND/API para a ${empresa_dominio}:${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " alter_backend_url
}

get_alter_frontend_port() {
  
  print_banner
  printf "${WHITE} 💻 Digite a porta do FRONTEND da Instância/Empresa ${empresa_dominio}; A porta deve ser a mesma informada durante a instalação ${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " alter_frontend_port
}

get_alter_backend_port() {
  
  print_banner
  printf "${WHITE} 💻 Digite a porta do BACKEND da Instância/Empresa ${empresa_dominio}; A porta deve ser a mesma informada durante a instalação ${GRAY_LIGHT}"
  printf "\n\n"
  read -p "> " alter_backend_port
}

get_urls() {
  get_mysql_root_password
  get_instancia_add
  get_max_whats
  get_max_user
  get_frontend_url
  get_backend_url
  get_frontend_port
  get_backend_port
  get_redis_port
  # get_deploy_email # Removido, SSL agora é automático
  
  # Configurações automáticas do Redis
  redis_host="127.0.0.1" # Definido conforme solicitado
  redis_password="${mysql_root_password}"
  
  printf "\n${GREEN}   ✅ Redis configurado automaticamente:${GRAY_LIGHT}"
  printf "\n${GREEN}      Host: ${redis_host} | Senha: mesma do banco${GRAY_LIGHT}\n"
  sleep 2
}

software_update() {
  get_empresa_atualizar
  frontend_update
  backend_update
}

software_delete() {
  get_empresa_delete
  deletar_tudo
}

software_bloquear() {
  get_empresa_bloquear
  configurar_bloqueio
}

software_desbloquear() {
  get_empresa_desbloquear
  configurar_desbloqueio
}

software_dominio() {
  get_empresa_dominio
  get_alter_frontend_url
  get_alter_backend_url
  get_alter_frontend_port
  get_alter_backend_port
  configurar_dominio
}

inquiry_options() {
  
  print_banner
  printf "${WHITE} 💻 Bem vindo(a) ao Gerenciador Multizap, selecione abaixo a proxima ação!${GRAY_LIGHT}"
  printf "\n\n"
  printf "   [0] Instalar Multizap\n"
  printf "   [1] Atualizar Multizap\n"
  printf "   [2] Deletar Multizap\n"
  printf "   [3] Bloquear Multizap\n"
  printf "   [4] Desbloquear Multizap\n"
  printf "   [5] Alter. dominio Multizap\n"
  printf "\n"
  read -p "> " option

  case "${option}" in
    0) get_urls ;;

    1) 
      software_update 
      exit
      ;;

    2) 
      software_delete 
      exit
      ;;
    3) 
      software_bloquear 
      exit
      ;;
    4) 
      software_desbloquear 
      exit
      ;;
    5) 
      software_dominio 
      exit
      ;;

    *) exit ;;
  esac
}