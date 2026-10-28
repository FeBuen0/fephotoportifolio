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
- `static/admin/config.yml`: estrutura de conteúdo do Decap preservada para uma futura integração.
- `build.mjs`: gera `dist/`, copia os arquivos e consolida os projetos.

## Fotos e projetos

As fotos atuais pertencem ao fotógrafo. Para atualizar o conteúdo pelo GitHub:

1. Envie os arquivos para `static/images/uploads/` pelo repositório.
2. No JSON do projeto em `content/projects/`, informe o caminho público `/images/uploads/nome-da-foto.jpg` e o texto alternativo. Para um novo projeto, use um JSON existente como referência.
3. Faça o commit em `main`. O GitHub Actions publica a atualização automaticamente.

Para as imagens de fundo, edite os campos correspondentes em `content/site.json`. Prefira JPG ou WebP comprimidos, com até 2200 px no lado maior e, quando possível, abaixo de 500 KB. Vídeos podem usar MP4 ou o ID do YouTube conforme a estrutura dos projetos existentes.

## Painel de edição

O antigo login dependia de um serviço de autenticação no Netlify. Esse serviço foi retirado do fluxo. A página `/admin/` informa que o acesso ainda está indisponível e não carrega o CMS nem abre um login no provedor antigo.

O painel com usuário e senha próprios **ainda não está ativo**. Uma implementação futura deve manter a edição protegida no servidor e respeitar a restrição de não adicionar cobrança de hospedagem. Não coloque senhas ou tokens no HTML, JavaScript, JSON de conteúdo ou repositório público.

## Rodar no computador

Com Node.js instalado:

```sh
npm run build
npm run start
```

## Domínio e HTTPS

As configurações atuais do domínio e do GitHub Pages permanecem as mesmas. Alterações de DNS ou renovação do domínio devem ser tratadas com o registrador. Para verificar o endereço publicado e o HTTPS, consulte **Settings → Pages** no repositório.
