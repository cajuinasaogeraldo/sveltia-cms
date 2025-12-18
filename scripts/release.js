import { execSync } from 'child_process';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const { version } = pkg;
const tag = `v${version}`;

console.log(`🚀 Publicando release ${tag}...`);

try {
  execSync('git push --follow-tags', { stdio: 'inherit' });

  execSync(`gh release create ${tag} --generate-notes`, { stdio: 'inherit' });

  console.log('🎉 Release criada com sucesso!');
} catch (err) {
  console.error('Erro ao criar release:', err);
  process.exit(1);
}
