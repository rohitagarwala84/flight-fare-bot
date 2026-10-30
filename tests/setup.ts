import fs from "node:fs";

// Integration tests run against a local Postgres and a fake Ignav server (see .env.test).
for (const line of fs.readFileSync(".env.test", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
