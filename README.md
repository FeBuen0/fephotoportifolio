# Portfólio — Felipe Bueno

Site de uma página feito com HTML, CSS e JavaScript sem framework. Os textos e projetos ficam em arquivos JSON e podem ser alterados pelo Decap CMS em `/admin` depois da configuração do Netlify.

## Estrutura

- `src/`: interface do site.
- `content/site.json`: frase de apresentação, textos, fotos de fundo, contatos e SEO.
- `content/projects/`: um arquivo JSON por projeto.
- `static/admin/`: painel Decap CMS.
- `static/images/uploads/`: imagens enviadas pelo painel.
- `build.mjs`: gera `dist/`, junta os JSONs de projetos e copia arquivos estáticos.

## Rodar no computador

1. Instale a versão LTS do [Node.js](https://nodejs.org/).
2. No terminal, dentro da pasta do projeto, rode `npm run build`.
3. Depois, rode `npm run start` e abra o endereço mostrado no terminal.

## Antes de publicar

1. Abra `content/site.json` e troque as cinco URLs de imagem de exemplo por fotos suas. Para manter o site leve, exporte as fotos em WebP ou JPG, com até 2200 px no lado maior e idealmente abaixo de 500 KB.
2. No mesmo arquivo, troque também `seo.shareImage` por uma foto sua horizontal (1200 × 630 px) para o compartilhamento.
3. Troque ou apague os três projetos marcados com `"isExample": true` em `content/projects/`.
4. Para cada vídeo, use somente o ID do YouTube. Em `https://www.youtube.com/watch?v=abc123`, o ID é `abc123`.

## Publicar no Netlify, do zero

1. Entre em [Netlify](https://app.netlify.com/) usando sua conta GitHub.
2. Clique em **Add new project** → **Import an existing project** → **GitHub** e selecione `FeBuen0/fephotoportifolio`.
3. Nas opções de build, use:
   - **Build command:** `node build.mjs`
   - **Publish directory:** `dist`
4. Clique em **Publish**. A cada commit no GitHub, o Netlify refaz o deploy sozinho.
5. Abra o deploy e confira se os três projetos de exemplo aparecem e se o WhatsApp funciona.

## Painel com usuário e senha

O Decap CMS existente foi reaproveitado. A tela `/admin/` tem somente **Usuário**, **Senha** e **Entrar**. Não há cadastro, convite, recuperação ou alteração de senha pelo site, nem endpoints para essas ações. A única conta é provisionada pelo responsável pela hospedagem.

O backend valida a senha com scrypt, cria uma sessão de quatro horas em cookie HttpOnly/Secure/SameSite=Strict e mantém a credencial do GitHub somente no servidor. Todas as operações de conteúdo exigem sessão e proteção CSRF. O backend só permite editar JSONs em `content/projects/`, `content/site.json` e mídias nas duas pastas do portfólio; não permite alterar código ou workflows. O login tem limite de cinco tentativas por minuto por IP no Netlify.

### Ativação no Netlify

1. Publique este repositório no projeto Netlify existente, com `node build.mjs` e pasta `dist`. As funções em `netlify/functions/` são publicadas junto do painel. Node.js 22 ou superior.
2. Rode `npm run admin:credentials` em um terminal privado. Informe o usuário desejado e uma senha de ao menos 16 caracteres. A senha não aparece na tela e não é salva. O comando produz o hash e o segredo de sessão.
3. Configure `FEPHOTOS_ADMIN_USERNAME`, `FEPHOTOS_ADMIN_PASSWORD_HASH` e `FEPHOTOS_SESSION_SECRET` como segredos **somente das Functions**, usando os valores gerados. Nunca configure os valores no código, no frontend, em arquivos de build ou no GitHub público.
4. Crie um token fine-grained do GitHub limitado ao repositório `FeBuen0/fephotoportifolio`, com **Contents: read/write**. Guarde-o no segredo `FEPHOTOS_GITHUB_TOKEN`, também somente nas Functions. Defina uma expiração e renove pelo provedor antes de vencer. Nenhum token é enviado ao navegador.
5. Refaça o deploy para aplicar as variáveis. Teste login incorreto, login correto, adição de uma foto, publicação e logout. Os commits em `main` continuam acionando a publicação no GitHub Pages.

**O GitHub Pages não executa as funções de login.** É possível manter o portfólio público no Pages e acessar o painel pelo endereço HTTPS do mesmo projeto no Netlify. O painel e as funções precisam estar na mesma origem para o cookie seguro funcionar. Se quiser o endereço `fephotos.com.br/admin/` enquanto o domínio público continua no Pages, é necessário um proxy de rotas no provedor do domínio; isso não é configurado por este repositório.

Sem os quatro segredos, o backend recusa o acesso (503). Não existe senha padrão e não há login de demonstração. O comando de geração só é executado no terminal do responsável; ele não cria uma tela de cadastro.

### Uso

1. Entre no painel com o único usuário provisionado.
2. Em **Projetos**, crie ou abra um projeto, envie as fotos, ajuste a ordem e os textos e clique em **Publicar**.
3. Em **Textos, fotos e contatos**, edite as imagens de fundo e dados do site.
4. Use **Sair** no menu do Decap ao terminar. A sessão expira após quatro horas.

Fotos devem ser exportadas em JPG, PNG, WebP, AVIF ou GIF; o painel também aceita MP4. Cada arquivo enviado pode ter até 3 MB, e cada requisição tem limite total de 4,5 MB: prefira fotos comprimidas e envie em grupos pequenos. A biblioteca usa URLs de miniatura e não carrega os originais de todas as fotos no backend.

Para trocar a senha, rode novamente `npm run admin:credentials`, substitua os segredos e refaça o deploy. A mudança invalida todas as sessões antigas. Isso não adiciona recuperação ou cadastro à tela.

### Verificação

`npm test` verifica acesso anônimo, credenciais inválidas, sessão adulterada/expirada, CSRF, ausência de cadastro, escopo dos arquivos e publicação atômica no GitHub usando um servidor simulado. `npm run build` confirma a geração do portfólio. Testes locais não substituem a verificação do login no serviço real após a configuração dos segredos.

## Ligar Fephotos.com.br

1. No Netlify: **Domain management** → **Add a domain** → digite `fephotos.com.br`.
2. Escolha usar o DNS do Netlify (mais simples) ou mantenha o DNS onde o domínio foi comprado.
3. Se mantiver o provedor atual, copie os registros DNS que o Netlify mostrar. Para o domínio raiz normalmente serão registros A/ALIAS; para `www`, um CNAME. Não adivinhe valores: copie exatamente os exibidos no seu painel.
4. Adicione também `www.fephotos.com.br` e marque uma versão como domínio principal. Recomendo `fephotos.com.br` e redirecionar `www` para ele.
5. Espere a validação e o certificado HTTPS ficarem ativos. Só então use esse endereço nas configurações de SEO e no OAuth, se necessário.

## Cloudflare Web Analytics, sem cookies

1. Crie uma conta Cloudflare e abra **Web Analytics** → **Add a site**.
2. Informe `fephotos.com.br`, copie o snippet recebido e substitua o comentário `Cloudflare Web Analytics` no fim de `src/index.html` por ele.
3. Publique novamente. Como o site fica no Netlify e não é necessariamente proxy do Cloudflare, o snippet manual é o caminho correto.
4. O painel mostra visitantes, visualizações, páginas, países, dispositivo e origem (referer). O script foi reservado no código e não usa cookies.

Importante: Cloudflare Web Analytics mede carregamento e desempenho da página, mas não oferece uma métrica confiável de **tempo total no site**. Para isso seria necessário usar outra ferramenta de analytics com medição de sessão — o que normalmente implica uma escolha adicional de privacidade e consentimento.

## Checklist final

- [ ] Trocar as fotos e a imagem de compartilhamento.
- [ ] Trocar/apagar os projetos de exemplo.
- [ ] Publicar no Netlify.
- [ ] Provisionar a única conta e configurar os quatro segredos do painel no serviço de hospedagem.
- [ ] Testar `/admin` com sua conta GitHub.
- [ ] Conectar `fephotos.com.br`.
- [ ] Inserir o token do Cloudflare Web Analytics.
