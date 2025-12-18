import { execSync } from "child_process";
import fs from "fs";

function run(cmd) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: "inherit" });
}

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const type = process.argv[2]; // patch | minor | major | undefined

console.log(`📦 Versão atual: ${pkg.version}`);

if (!type) {
  console.error("❌ Você precisa informar: patch | minor | major");
  process.exit(1);
}

console.log(`🏷️ Incrementando versão (${type})...`);
run(`pnpm version ${type}`);

const newPkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const newVersion = newPkg.version;

console.log(`📦 Nova versão: ${newVersion}`);

console.log(`⬆️ Enviando commit e tag...`);
run(`git push`);
run(`git push origin v${newVersion}`);

console.log("🎉 Release preparada! Agora seu workflow vai rodar.");