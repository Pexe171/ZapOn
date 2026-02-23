#!/usr/bin/env node
require("dotenv/config");
const bcrypt = require("bcryptjs");
const { Sequelize, QueryTypes } = require("sequelize");

const parseArgs = () => {
  const parsed = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    const value = rest.join("=");
    if (!value) continue;
    parsed[key] = value;
  }
  return parsed;
};

const showHelp = () => {
  console.log(`\nUso:\n  npm run create:user -- --name="Nome" --email="email@dominio.com" --password="SenhaForte123" [--companyId=1] [--profile=admin]\n\nExemplo:\n  npm run create:user -- --name="Administrador" --email="admin@empresa.com" --password="123456" --companyId=1 --profile=admin\n`);
};

const buildSequelize = () => {
  const dialect = process.env.DB_DIALECT || "postgres";
  return new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      dialect,
      logging: false
    }
  );
};

const main = async () => {
  const args = parseArgs();

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    return;
  }

  const name = args.name;
  const email = args.email ? String(args.email).toLowerCase() : "";
  const password = args.password;
  const profile = args.profile || "admin";
  const companyId = args.companyId ? Number(args.companyId) : 1;

  if (!name || !email || !password) {
    console.error("Erro: informe --name, --email e --password.");
    showHelp();
    process.exitCode = 1;
    return;
  }

  if (!Number.isInteger(companyId) || companyId <= 0) {
    console.error("Erro: --companyId deve ser um inteiro maior que zero.");
    process.exitCode = 1;
    return;
  }

  const sequelize = buildSequelize();

  try {
    await sequelize.authenticate();

    const existing = await sequelize.query(
      `SELECT id FROM "Users" WHERE email = :email LIMIT 1`,
      {
        replacements: { email },
        type: QueryTypes.SELECT
      }
    );

    if (existing.length > 0) {
      console.error(`Erro: já existe usuário com o email ${email}.`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, 8);

    const rows = await sequelize.query(
      `INSERT INTO "Users" (name, email, "passwordHash", profile, "companyId", "createdAt", "updatedAt")
       VALUES (:name, :email, :passwordHash, :profile, :companyId, NOW(), NOW())
       RETURNING id, name, email, profile, "companyId"`,
      {
        replacements: { name, email, passwordHash, profile, companyId },
        type: QueryTypes.INSERT
      }
    );

    const created = Array.isArray(rows[0]) ? rows[0][0] : null;

    console.log("Usuário criado com sucesso:");
    if (created) {
      console.log(`- id: ${created.id}`);
      console.log(`- nome: ${created.name}`);
      console.log(`- email: ${created.email}`);
      console.log(`- companyId: ${created.companyId}`);
      console.log(`- profile: ${created.profile}`);
    } else {
      console.log(`- nome: ${name}`);
      console.log(`- email: ${email}`);
      console.log(`- companyId: ${companyId}`);
      console.log(`- profile: ${profile}`);
    }
  } catch (error) {
    console.error("Falha ao criar usuário no banco de dados.");
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

main();
