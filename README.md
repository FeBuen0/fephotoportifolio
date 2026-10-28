# Fephotos — Felipe Bueno

Portfólio estático em HTML, CSS e JavaScript, publicado pelo **GitHub Pages**. Não depende de hospedagem, Functions, Identity ou autenticação do Netlify.

## Publicação

O workflow `.github/workflows/deploy-pages.yml` gera o site e publica a pasta `dist/` a cada commit em `main`. O endereço padrão é `https://febuen0.github.io/fephotoportifolio/`.

A hospedagem no GitHub Pages está disponível no plano gratuito para este repositório público. Um domínio próprio tem registro e renovação separados da hospedagem; este projeto não altera nem cancela o domínio.

## Estrutura

- `src/`: interface do portfólio e página de trabalhos.
- `content/site.json`: apresentação, fundos, textos, contatos e SEO.
- `content/projects/`: um JSON por projeto, com fotos, descrição e ordem.
- `static/images/portfolio/` e `static/images/uploads/`: arquivos de mídia.
- `static/admin/`: painel estático de fotos e grupos e pacote de configuração local de acesso.
- `build.mjs`: gera `dist/`, copia os arquivos e consolida os projetos.

## Painel de fotos e grupos

Abra **https://fephotos.com.br/admin/**. O painel permite criar e renomear grupos, enviar várias fotos, escolher a primeira foto como capa, ordenar fotos e grupos, mover fotos entre grupos e retirar grupos do portfólio. As duas entradas de vídeo existentes são preservadas.

Fotos JPG, PNG e WebP são otimizadas no navegador para até 2200 px no lado maior. Os originais no computador não são alterados. O rascunho, incluindo as fotos novas, fica no IndexedDB deste navegador até publicar. Uma falha de armazenamento mostra que o rascunho só está disponível na aba atual.

**Publicar no site** envia os JSONs e as fotos no mesmo commit em `main`; o workflow do GitHub Pages atualiza o portfólio. A página confirma o resultado da publicação quando o GitHub informa a conclusão. Retirar uma foto ou excluir um grupo remove referências do portfólio; não apaga os arquivos originais já enviados ao repositório.

### Primeiro acesso, uma única vez

1. Baixe `https://fephotos.com.br/admin/primeiro-acesso.zip`, extraia e abra `configurar-acesso.html` no seu computador. Não é necessário instalar Node.js.
2. No configurador, siga **Como obter a chave de publicação?** para criar um token fine-grained na conta `FeBuen0`, limitado a `fephotoportifolio` e à permissão **Contents: Read and write**. Escolha uma expiração. O token e a configuração não exigem contratar hospedagem.
3. Escolha o único usuário do painel e uma senha de pelo menos 16 caracteres. O configurador verifica o token diretamente com a API oficial do GitHub e gera `fephotos-acesso.json`.
4. No painel, use **Importar arquivo de acesso** e entre com esse usuário e senha. Depois, basta entrar normalmente neste navegador. Em outro dispositivo, importe o mesmo arquivo.

Não há cadastro de usuários, recuperação ou criação de senha na página do painel. A configuração inicial acontece no arquivo local do proprietário. Uma chave vencida/revogada ou uma senha esquecida exige gerar outro arquivo pelo configurador.

### Como o acesso é protegido

O GitHub Pages continua servindo apenas arquivos estáticos. O usuário e a senha abrem localmente uma credencial criptografada com **AES-256-GCM**, usando uma chave derivada da senha com **PBKDF2-HMAC-SHA256, 600.000 iterações**, salt aleatório e IV aleatório. A senha não é armazenada nem enviada para um servidor de login.

Só a versão criptografada do token fica no armazenamento do navegador. O token aberto permanece na memória da aba, é enviado apenas à API oficial do GitHub e é descartado ao sair, após 20 minutos sem atividade ou após duas horas de sessão. Quem autoriza leituras e gravações é o GitHub; o login não depende de esconder os botões do painel. O painel restringe as chamadas à conta e ao repositório esperados, publica somente projetos e fotos e nunca faz force-push.

Essa solução não cria uma conta com sessão num servidor próprio. É um cofre local de credencial que permite manter o painel sem outro serviço de hospedagem. Não coloque o arquivo de acesso, senha ou token no repositório. O `.gitignore` bloqueia o nome padrão do arquivo de acesso.

Não há scripts, fontes ou bibliotecas de terceiros no painel. Uma política de conteúdo restringe scripts à própria origem e conexões à API oficial do GitHub. Atualizações de um mesmo grupo em outra aba são detectadas antes da publicação; alterações remotas em arquivos que você não editou são preservadas.

### Atualizar o pacote de configuração

Depois de editar `static/admin/core.mjs`, rode `npm run build:access` antes de `npm run build`. O ZIP contém apenas o configurador e instruções, nunca credenciais. `npm test` verifica a criptografia, o escopo das operações, conflitos, envio atômico e preservação das fotos.

## Rodar no computador

Com Node.js instalado:

```sh
npm run build
npm run start
```

## Domínio e HTTPS

As configurações atuais do domínio e do GitHub Pages permanecem as mesmas. Alterações de DNS ou renovação do domínio devem ser tratadas com o registrador. Para verificar o endereço publicado e o HTTPS, consulte **Settings → Pages** no repositório.
