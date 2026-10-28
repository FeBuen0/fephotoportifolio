/* The browser receives a session and a CSRF token, never the GitHub credential. */
(() => {
  const screen = document.querySelector('#login');
  const form = document.querySelector('#login-form');
  const button = document.querySelector('#login-submit');
  const message = document.querySelector('#login-message');
  const apiRoot = '/api/admin';
  let currentUser;
  let started = false;

  async function api(path, body) {
    const response = await fetch(`${apiRoot}/${path}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(currentUser?.csrf ? { 'X-CSRF-Token': currentUser.csrf } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 404 || response.status === 503
        ? 'O acesso ao painel ainda não foi ativado.'
        : response.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
        : data.error || 'Não foi possível entrar. Tente novamente.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showLogin(text = '') {
    screen.hidden = false;
    message.textContent = text;
    button.disabled = false;
    button.textContent = 'Entrar';
  }

  function expire() {
    // Reload clears the editor and all credentials kept only in memory.
    window.location.reload();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Não foi possível carregar o editor. Verifique sua conexão.')); };
      document.head.append(script);
    });
  }

  async function startEditor(user) {
    currentUser = user;
    if (started) return;
    window.CMS_MANUAL_INIT = true;
    if (!window.CMS) await loadScript('https://cdn.jsdelivr.net/npm/decap-cms@3.17.3/dist/decap-cms.js');
    const ProxyBackend = window.CMS.getBackend('proxy')?.BackendClass;
    if (!ProxyBackend) throw new Error('Não foi possível iniciar o editor. Atualize a página.');
    const SessionLogin = window.createClass({
      componentDidMount() { this.props.onLogin({}); },
      render() {
        return window.h('button', { type: 'button', onClick: expire }, 'Voltar ao login');
      },
    });
    class FephotosBackend extends ProxyBackend {
      async restoreUser() { currentUser = await api('session'); return currentUser; }
      async authenticate() { currentUser = await api('session'); return currentUser; }
      authComponent() { return SessionLogin; }
      async logout() {
        try { await api('logout', {}); }
        finally { currentUser = undefined; expire(); }
      }
      async request(payload) {
        try { return await api('cms', { branch: this.branch, ...payload }); }
        catch (error) { if (error.status === 401) expire(); throw error; }
      }
      async getMedia(mediaFolder = this.mediaFolder) {
        const files = await this.request({ action: 'getMedia', params: { mediaFolder } });
        return files.map(file => ({ ...file, displayURL: file.url }));
      }
    }
    window.CMS.registerBackend('fephotos', FephotosBackend);
    window.CMS.init();
    screen.hidden = true;
    started = true;
    // Do not leave an expired editor open until the next write operation.
    const timeout = Math.max(0, user.expiresAt - Date.now());
    window.setTimeout(expire, Math.min(timeout, 2147483647));
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = 'Entrando…';
    message.textContent = '';
    const username = form.elements.username;
    const password = form.elements.password;
    username.removeAttribute('aria-invalid');
    password.removeAttribute('aria-invalid');
    try {
      const user = await api('login', { username: username.value.trim(), password: password.value });
      password.value = '';
      await startEditor(user);
    } catch (error) {
      password.value = '';
      showLogin(error.message);
      if (error.status === 401) {
        username.setAttribute('aria-invalid', 'true');
        password.setAttribute('aria-invalid', 'true');
        password.focus();
      }
    }
  });

  api('session').then(startEditor).catch(error => {
    showLogin(error.status === 401 ? '' : error.message);
  });
})();
