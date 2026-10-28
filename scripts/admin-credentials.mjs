import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword } from '../server/admin.mjs';

// Provisioning is a local terminal task. There is no account-creation endpoint.
if (!process.stdin.isTTY) throw new Error('Execute este comando em um terminal interativo.');
let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
const readline = createInterface({ input: process.stdin, output, terminal: true });
try {
  const username = (await readline.question('Usuário do administrador: ')).trim();
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(username)) throw new Error('Use de 3 a 80 letras, números, pontos, hífens ou sublinhados.');
  process.stdout.write('Senha (mínimo 16 caracteres; entrada oculta): ');
  muted = true;
  const password = await readline.question('');
  process.stdout.write('\nConfirme a senha (entrada oculta): ');
  const confirmation = await readline.question('');
  muted = false;
  if (password !== confirmation) throw new Error('As senhas não coincidem.');
  const hash = await hashPassword(password);
  process.stdout.write('\nConfigure estes valores como segredos do serviço de hospedagem:\n');
  process.stdout.write(`FEPHOTOS_ADMIN_USERNAME=${username}\nFEPHOTOS_ADMIN_PASSWORD_HASH=${hash}\nFEPHOTOS_SESSION_SECRET=${randomBytes(48).toString('hex')}\n`);
  process.stdout.write('\nAdicione também FEPHOTOS_GITHUB_TOKEN com permissão Contents: read/write somente em FeBuen0/fephotoportifolio.\nA senha original não foi gravada nem exibida. Não publique estes valores no repositório.\n');
} finally { muted = false; readline.close(); }
