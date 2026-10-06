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

## Ativar o painel em /admin

Este projeto usa o backend **GitHub** do Decap CMS com o OAuth Provider do Netlify. É a escolha para novos projetos: o Git Gateway do Netlify continua funcionando onde já existe, mas está marcado como depreciado para novas configurações.

1. No GitHub, vá em **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Dê o nome `Fephotos CMS` e preencha a **Authorization callback URL** exatamente com `https://api.netlify.com/auth/done`.
3. Copie o **Client ID**, gere e copie o **Client secret**.
4. No Netlify, dentro do projeto, vá em **Project configuration** → **Security** → **OAuth** → **Install Provider** → **GitHub**.
5. Cole o Client ID e Client secret e salve.
6. Abra `https://SEU-SITE.netlify.app/admin/`, entre com a conta GitHub que tem permissão de escrita neste repositório e autorize o acesso.
7. Edite projetos e configurações pelo formulário e clique em **Publish**. O CMS cria um commit, e o Netlify publica a versão atualizada.

> Não compartilhe o Client secret. Ele fica somente na configuração segura do Netlify, nunca no repositório.

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
- [ ] Criar OAuth App do GitHub e instalar o provedor no Netlify.
- [ ] Testar `/admin` com sua conta GitHub.
- [ ] Conectar `fephotos.com.br`.
- [ ] Inserir o token do Cloudflare Web Analytics.
