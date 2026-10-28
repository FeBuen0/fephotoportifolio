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
- `static/admin/`: painel estático de fotos e grupos, com conexão feita na própria página.
- `build.mjs`: gera `dist/`, copia os arquivos e consolida os projetos.

## Painel de fotos e grupos

Abra **https://fephotos.com.br/admin/**. O painel permite criar e renomear grupos, enviar várias fotos, escolher a primeira foto como capa, ordenar fotos e grupos, mover fotos entre grupos e retirar grupos do portfólio. As duas entradas de vídeo existentes são preservadas.

Fotos JPG, PNG e WebP são otimizadas no navegador para até 2200 px no lado maior. Os originais no computador não são alterados. O rascunho, incluindo as fotos novas, fica no IndexedDB deste navegador até publicar. Uma falha de armazenamento mostra que o rascunho só está disponível na aba atual.

**Publicar no site** envia os JSONs e as fotos no mesmo commit em `main`; o workflow do GitHub Pages atualiza o portfólio. A página confirma o resultado da publicação quando o GitHub informa a conclusão. Retirar uma foto ou excluir um grupo remove referências do portfólio; não apaga os arquivos originais já enviados ao repositório.

### Entrar e conectar a publicação

O link discreto **admin**, fixo no canto inferior direito do portfólio e da página de trabalhos, abre `/admin/`. Entre com o usuário fixo `Bumoro` e a senha definida pelo proprietário. Não há cadastro, criação de senha, download ou importação de arquivo.

No primeiro acesso em cada navegador, depois da conferência das credenciais, o painel mostra **Conecte a publicação**. Abra o GitHub pelo link, na conta `FeBuen0`, e crie um token fine-grained limitado ao repositório `fephotoportifolio`, com **Contents: Read and write** e a validade desejada. O link já preenche nome, proprietário e permissão; a seleção do repositório e a confirmação são feitas no GitHub pelo proprietário. Cole a chave no painel e clique em **Conectar e abrir painel**.

O painel verifica a conta e o acesso ao repositório e guarda somente a chave criptografada neste navegador. Nas próximas visitas, entre com usuário e senha. Um novo navegador ou uma chave vencida/revogada exige conectar novamente. **Reconectar publicação**, junto ao login, valida as mesmas credenciais antes de aceitar uma nova chave. Nenhuma chave real foi criada ou incluída no código.

### Como o acesso é protegido

O GitHub Pages continua servindo apenas arquivos estáticos. O módulo de login contém um verificador PBKDF2 da senha definida, sem seu valor em texto aberto. A senha abre localmente uma credencial criptografada com **AES-256-GCM**, usando **PBKDF2-HMAC-SHA256, 600.000 iterações**, salt aleatório e IV aleatório. A senha não é armazenada em texto aberto nem enviada para um servidor de login. O proprietário escolheu uma senha de seis caracteres; um verificador no código público permite tentativas offline e não substitui autenticação em servidor.

Só a versão criptografada do token fica no armazenamento do navegador; ela nunca é publicada no repositório ou compartilhada entre visitantes. O token aberto permanece na memória da aba, é enviado apenas à API oficial do GitHub e é descartado ao sair, após 20 minutos sem atividade ou após duas horas de sessão. A senha usada na conexão é apagada da memória ao concluir/cancelar ou após quinze minutos. Quem autoriza gravações é o GitHub: conhecer ou contornar o verificador local, sozinho, não permite editar o portfólio. O painel restringe as chamadas à conta e ao repositório esperados, publica somente projetos e fotos e nunca faz force-push.

Essa solução não cria uma conta com sessão num servidor próprio. É um cofre local de credencial que permite manter o painel sem outro serviço de hospedagem. Não coloque tokens, senhas em texto aberto ou cofres de acesso no repositório. O `.gitignore` também bloqueia arquivos do formato anterior.

Não há scripts, fontes ou bibliotecas de terceiros no painel. Uma política de conteúdo restringe scripts à própria origem e conexões à API oficial do GitHub. Atualizações de um mesmo grupo em outra aba são detectadas antes da publicação; alterações remotas em arquivos que você não editou são preservadas.

`npm test` verifica a criptografia, a rejeição de credenciais incorretas, o escopo das operações, conflitos, envio atômico e preservação das fotos. O antigo configurador e o ZIP de primeiro acesso foram removidos.

## Rodar no computador

Com Node.js instalado:

```sh
npm run build
npm run start
```

## Domínio e HTTPS

As configurações atuais do domínio e do GitHub Pages permanecem as mesmas. Alterações de DNS ou renovação do domínio devem ser tratadas com o registrador. Para verificar o endereço publicado e o HTTPS, consulte **Settings → Pages** no repositório.
