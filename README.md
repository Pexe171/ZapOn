# ZapOn com Docker

Este repositório foi organizado para rodar o projeto **ZapOn (Multizap)** com **Docker Compose**, reduzindo a dependência de instalação manual no servidor.

## O que foi preparado

- Container do **PostgreSQL**.
- Container do **Redis**.
- Container do **backend** (Node.js 20 + build TypeScript + migrations automáticas).
- Container do **frontend** (build React + Nginx).

## Pré-requisitos

- Docker 24+
- Docker Compose (plugin `docker compose`)

## Compatibilidade de Node.js

O backend depende do pacote `baileys`, que exige **Node.js 20+** em tempo de instalação. Por isso, o `Multizap/backend/Dockerfile` usa a imagem `node:20-bookworm-slim`.

## Subindo o ambiente

Na raiz do projeto, execute:

```bash
docker compose up -d --build
```

A aplicação ficará disponível em:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Tutorial de produção via SSH (Ubuntu)

> Fluxo recomendado para quem já está com servidor Ubuntu e acesso SSH.

### 1) Acessar o servidor

```bash
ssh usuario@IP_DO_SERVIDOR
```

### 2) Instalar Docker e plugin Compose

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

### 3) Clonar projeto no servidor

```bash
git clone <URL_DO_REPOSITORIO> zapon
cd zapon
```

### 4) Ajustar variáveis de produção

Edite o `docker-compose.yml` antes de subir:

- Troque senhas/segredos (`DB_PASS`, `JWT_SECRET`, `JWT_REFRESH_SECRET`).
- Ajuste `FRONTEND_URL` e `BACKEND_URL` para o domínio final.
- Se necessário, ajuste portas publicadas.

### 5) Subir stack em produção

```bash
sudo docker compose up -d --build
```

### 6) Conferir se subiu corretamente

```bash
sudo docker compose ps
sudo docker compose logs -f backend
sudo docker compose logs -f frontend
```

### 7) Atualizar versão em deploy futuro

```bash
git pull
sudo docker compose up -d --build
```

### 8) Backup básico do banco PostgreSQL

```bash
sudo docker exec -t zapon-db pg_dump -U zapon zapon > backup_zapon.sql
```

### 9) Restore básico do banco PostgreSQL

```bash
cat backup_zapon.sql | sudo docker exec -i zapon-db psql -U zapon -d zapon
```

## Comandos úteis

### Ver logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Parar ambiente

```bash
docker compose down
```

### Parar e remover volumes (zera banco/redis)

```bash
docker compose down -v
```

## Estrutura Docker criada

- `docker-compose.yml`
- `Multizap/backend/Dockerfile`
- `Multizap/frontend/Dockerfile`
- `.dockerignore`

## Observações importantes

1. O backend roda `npm run db:migrate` ao iniciar o container.
2. O frontend usa `REACT_APP_BACKEND_URL=http://localhost:8080` no build do container.
3. Caso precise personalizar segredos e URLs, ajuste as variáveis no serviço `backend` dentro do `docker-compose.yml`.
4. Para produção, recomenda-se:
   - trocar senhas/sigilos (`JWT_SECRET`, `DB_PASS`, etc.);
   - usar HTTPS com proxy reverso (Nginx/Traefik/Caddy);
   - configurar backup de volume do Postgres;
   - restringir acesso externo direto às portas de banco/redis.
5. O backend agora mantém `@types/multer` em dependências de produção para permitir o `npm run build` dentro do Docker mesmo com `npm ci --omit=dev`.

## Migração do modo antigo para Docker

O modo antigo baseado em cópia manual de pastas + PM2 foi substituído por uma esteira mais previsível via containers. Isso reduz erro operacional, facilita rollback e padroniza o ambiente entre máquinas.

## Limpeza de legado

Para simplificar manutenção, foram removidos os artefatos antigos de instalação manual (scripts `instalar_*`, pastas `lib/`, `utils/`, `variables/`, arquivo `config` e `ecosystem.config.js`).

O fluxo oficial agora é **somente Docker Compose**.

## Observação sobre dependências do frontend

O frontend possui um arquivo `Multizap/frontend/.npmrc` com `legacy-peer-deps=true` e o `Multizap/frontend/Dockerfile` também executa `npm ci --legacy-peer-deps` para evitar falhas de resolução de _peer dependencies_ durante o build Docker em ambientes diferentes (local/CI).

## Criar usuário direto no banco (CLI)

Quando você precisar criar rapidamente um usuário (email/senha) direto no banco de dados, use o comando abaixo no backend:

```bash
cd Multizap/backend
npm run create:user -- --name="Administrador" --email="admin@empresa.com" --password="123456" --companyId=1 --profile=admin
```

Parâmetros:

- `--name` (obrigatório)
- `--email` (obrigatório, em formato válido, ex: `admin@empresa.com`)
- `--password` (obrigatório)
- `--companyId` (opcional, padrão: `1`)
- `--profile` (opcional, padrão: `admin`)

Pré-requisitos de conexão com banco (arquivo `.env` do backend):

- `DB_NAME` e `DB_USER` devem estar definidos.
- Defina `DB_PASS` (ou `DB_PASSWORD`) como texto.
- Se aparecer o erro `client password must be a string`, normalmente é `DB_PASS`/`DB_PASSWORD` ausente ou mal formatado.

Exemplo de `.env` mínimo para o comando `create:user`:

```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=multizap
DB_USER=postgres
DB_PASS=123456
# opcional: pode usar no lugar de DB_PASS
# DB_PASSWORD=123456
```

> Dica: mantenha apenas uma das variáveis de senha (`DB_PASS` ou `DB_PASSWORD`) para evitar confusão.

Ajuda rápida:

```bash
npm run create:user -- --help
```
