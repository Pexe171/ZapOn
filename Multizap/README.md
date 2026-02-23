# Multizap - Execução com Docker

A partir desta versão, a forma recomendada de execução é via **Docker Compose**.

## Subir ambiente completo

Na raiz do repositório (`/workspace/ZapOn`):

```bash
docker compose up -d --build
```

## Tutorial rápido de produção (Ubuntu via SSH)

```bash
ssh usuario@IP_DO_SERVIDOR
git clone <URL_DO_REPOSITORIO> zapon
cd zapon
sudo docker compose up -d --build
sudo docker compose logs -f backend
```

> Antes de subir em produção, ajuste segredos e URLs no `docker-compose.yml`.

## Endereços

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`

## Parar ambiente

```bash
docker compose down
```

## Dica

Se quiser limpar banco/redis para recomeçar do zero:

```bash
docker compose down -v
```

## Limpeza realizada

Os arquivos legados de instalação com PM2 foram removidos do repositório para reduzir complexidade operacional.

Use apenas o fluxo com Docker Compose descrito neste documento e no README da raiz.

## Observação sobre dependências do frontend

O frontend possui um arquivo `Multizap/frontend/.npmrc` com `legacy-peer-deps=true` e o `Multizap/frontend/Dockerfile` também executa `npm ci --legacy-peer-deps` para evitar falhas de resolução de _peer dependencies_ durante o build Docker em ambientes diferentes (local/CI).



## Compatibilidade de Node.js

O backend utiliza a dependência `baileys`, que exige **Node.js 20+** durante o `npm ci`. Por isso, a imagem base do backend no Dockerfile foi definida como `node:20-bookworm-slim`.

## Criar usuário direto no banco (CLI)

Para criar um usuário com email e senha diretamente no banco de dados:

```bash
cd Multizap/backend
npm run create:user -- --name="Administrador" --email="admin@empresa.com" --password="123456" --companyId=1 --profile=admin
```

Parâmetros:

- `--name` (obrigatório)
- `--email` (obrigatório)
- `--password` (obrigatório)
- `--companyId` (opcional, padrão: `1`)
- `--profile` (opcional, padrão: `admin`)

Ajuda:

```bash
npm run create:user -- --help
```
