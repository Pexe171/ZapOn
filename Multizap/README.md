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

O frontend possui um arquivo `Multizap/frontend/.npmrc` com `legacy-peer-deps=true` para evitar falhas de resolução de _peer dependencies_ durante o `npm ci` no build Docker.

