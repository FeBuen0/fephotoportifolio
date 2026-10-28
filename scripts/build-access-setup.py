from pathlib import Path
import base64, hashlib, html, re, zipfile
root = Path(__file__).resolve().parent.parent
core = re.sub(r'^export ', '', (root / 'static/admin/core.mjs').read_text(), flags=re.MULTILINE)
script = core + '''
const form = document.querySelector('form');
const status = document.querySelector('#status');
const button = document.querySelector('#generate');
form.addEventListener('submit', async event => {
  event.preventDefault(); button.disabled = true; status.textContent = 'Conferindo acesso e protegendo a chave…';
  const user = document.querySelector('#username').value.trim();
  const password = document.querySelector('#password').value;
  const confirmation = document.querySelector('#confirmation').value;
  const tokenField = document.querySelector('#github-key');
  let client;
  try {
    if (!crypto.subtle) throw new Error('Abra este arquivo no Chrome, Edge, Firefox ou Safari atualizado.');
    if (password !== confirmation) throw new Error('As senhas não coincidem.');
    const token = tokenField.value.trim();
    if (token.length < 20) throw new Error('Cole a chave de publicação criada no GitHub.');
    client = new GitHubStore(token);
    await client.authenticate();
    const vault = await createVault(user, password, token);
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'fephotos-acesso.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    form.reset();
    status.textContent = 'Arquivo de acesso gerado. Abra fephotos.com.br/admin/, importe fephotos-acesso.json e entre com o usuário e a senha escolhidos.';
  } catch (error) { status.textContent = error.message; }
  finally { client?.close(); tokenField.value = ''; document.querySelector('#password').value = ''; document.querySelector('#confirmation').value = ''; button.disabled = false; }
});
'''
style = '''*{box-sizing:border-box}body{font:15px Arial,sans-serif;background:#11140e;color:#edf1e4;margin:0;padding:36px 22px}main{max-width:530px;margin:auto}h1{font-size:32px;letter-spacing:-1px;font-weight:500}p,li{color:#b6c0a6;line-height:1.6;font-size:13px}a{color:#dfea9a}label{display:block;margin:22px 0 8px;font-size:13px}input{width:100%;padding:12px;background:#1e2517;border:1px solid #4d593b;color:#fff;border-radius:6px;font-size:16px}button{background:#dfea9a;color:#17200d;border:0;border-radius:6px;padding:14px 18px;width:100%;font-size:14px;font-weight:bold;margin-top:26px;cursor:pointer}button:disabled{opacity:.5}input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid #dfea9a;outline-offset:3px}#status{min-height:45px;color:#e3edbd}small{display:block;font-size:11px;color:#8d9c77;line-height:1.6;margin-top:7px}.eyebrow{font-size:10px;letter-spacing:2px;color:#b8c98f;margin-top:20px}details{background:#1b2115;border:1px solid #38442b;border-radius:7px;padding:15px;font-size:12px}summary{cursor:pointer;color:#dfea9a}'''
def digest(value): return base64.b64encode(hashlib.sha256(value.encode()).digest()).decode()
policy = f"default-src 'none'; script-src 'sha256-{digest(script)}'; style-src 'sha256-{digest(style)}'; connect-src https://api.github.com; base-uri 'none'; form-action 'none'"
page = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="{html.escape(policy,quote=True)}"><title>Fephotos — Configuração inicial do acesso</title><style>{style}</style></head><body><main><p class="eyebrow">FEPHOTOS / CONFIGURAÇÃO NO SEU COMPUTADOR</p><h1>Prepare seu acesso.</h1><p>Esta configuração é feita uma única vez. Ela gera um arquivo protegido pela sua senha para você entrar no painel. Não cria uma conta pública no site.</p><details><summary>Como obter a chave de publicação?</summary><ol><li>Abra <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">as chaves de acesso do GitHub</a> na conta FeBuen0.</li><li>Dê o nome “Painel Fephotos”, escolha uma expiração e marque <b>Only select repositories → fephotoportifolio</b>.</li><li>Em <b>Repository permissions</b>, selecione <b>Contents: Read and write</b>. Nenhuma outra permissão de escrita é necessária.</li><li>Gere a chave e cole no campo abaixo. Você mesmo faz esta etapa no GitHub; a chave não deve ser enviada em conversa.</li></ol></details><form><label for="username">Usuário do painel</label><input id="username" name="username" autocomplete="username" pattern="[a-zA-Z0-9_.-]{{3,80}}" maxlength="80" required><label for="password">Senha do painel</label><input id="password" type="password" autocomplete="new-password" minlength="16" maxlength="256" required><small>Use ao menos 16 caracteres. Uma frase longa funciona bem. Esta senha abre o arquivo de acesso; não é a senha da sua conta GitHub.</small><label for="confirmation">Confirmar senha</label><input id="confirmation" type="password" autocomplete="new-password" minlength="16" maxlength="256" required><label for="github-key">Chave de publicação do GitHub</label><input id="github-key" type="password" autocomplete="off" spellcheck="false" maxlength="1024" required><small>A chave só é enviada à API oficial do GitHub para validar o acesso. O arquivo gerado guarda apenas sua versão criptografada; sua senha não é gravada.</small><button id="generate" type="submit">Gerar arquivo de acesso</button><p id="status" role="status" aria-live="polite"></p></form><p>Depois, abra <a href="https://fephotos.com.br/admin/" target="_blank" rel="noopener noreferrer">o painel do Fephotos</a> e importe <b>fephotos-acesso.json</b>. Guarde esse arquivo no seu computador. Nunca o adicione ao repositório.</p></main><script type="module">{script}</script></body></html>'''
(root / 'tools/configurar-acesso.html').write_text(page)
readme = '''FEPHOTOS — PRIMEIRO ACESSO

1. Extraia este ZIP e abra configurar-acesso.html no seu navegador.
2. Siga “Como obter a chave de publicação?” no arquivo. A chave do GitHub precisa acessar apenas FeBuen0/fephotoportifolio, com Contents: Read and write.
3. Escolha o único usuário e uma senha de ao menos 16 caracteres. Gere fephotos-acesso.json.
4. Abra https://fephotos.com.br/admin/ e use Importar arquivo de acesso. Entre com seu usuário e senha.

Depois dessa configuração, não há cadastro nem recuperação de senha no site. O painel publica direto no GitHub, sem Netlify ou assinatura de hospedagem.

O arquivo JSON é criptografado com uma chave derivada da sua senha. A senha não é gravada. A chave de publicação só fica aberta na memória enquanto você usa o painel e é enviada apenas à API oficial do GitHub. Sair fecha o acesso.

Um navegador novo exige importar o mesmo arquivo novamente. Se a chave do GitHub vencer ou você esquecer a senha, use este configurador com uma chave válida para gerar outro arquivo. Não envie senhas ou chaves por conversa e não guarde o arquivo de acesso no repositório público.

As fotos do painel ficam em rascunho neste navegador até clicar em Publicar no site. Faça backup dos originais no seu computador.
'''
with zipfile.ZipFile(root / 'static/admin/primeiro-acesso.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
    z.writestr('configurar-acesso.html',page)
    z.writestr('LEIA-ME.txt',readme)
print('Configuração local empacotada, sem credenciais.')
