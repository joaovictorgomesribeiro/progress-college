/* Meu Sistema de Estudos - shell da aplicação: roteamento, navegação, modal, tema */

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  book: '<path d="M12 6c-1.8-1.4-4.2-2-7-2v13c2.8 0 5.2.6 7 2 1.8-1.4 4.2-2 7-2V4c-2.8 0-5.2.6-7 2Z"/><path d="M12 6v13"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/>',
  calendar: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17"/><path d="M8 3v3M16 3v3"/>',
  file: '<path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14.5 3.5V8h4.3"/><path d="M8 13h8M8 16.5h8M8 9.5h4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bars: '<path d="M3 20h18"/><path d="M6 20V11M12 20V5M18 20v-6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M20 18h0"/><circle cx="15" cy="6" r="1.8"/><circle cx="7" cy="12" r="1.8"/><circle cx="16" cy="18" r="1.8"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15v5Z"/><path d="m13.5 6.5 3 3"/>',
  trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5"/><path d="M6.5 6.5 7.3 19a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l.8-12.5"/><path d="M10.2 10.5v6.3M13.8 10.5v6.3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  upload: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
  logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/>',
};

function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

/* Controles de "Anterior/Próxima" para respostas paginadas do backend
   ({itens, total, pagina, por_pagina, paginas}). Quem chama precisa ligar os
   listeners de [data-pagina-anterior]/[data-pagina-proxima] depois de injetar. */
function paginacaoHtml(resp) {
  if (resp.paginas <= 1) return "";
  return `<div class="field-row" style="justify-content:space-between; align-items:center; margin-top:var(--space-3);">
    <button class="btn btn-sm" data-pagina-anterior ${resp.pagina <= 1 ? "disabled" : ""}>Anterior</button>
    <span class="field-hint" style="margin:0;">Página ${resp.pagina} de ${resp.paginas}</span>
    <button class="btn btn-sm" data-pagina-proxima ${resp.pagina >= resp.paginas ? "disabled" : ""}>Próxima</button>
  </div>`;
}

const NAV_ITEMS = [
  { route: "dashboard", icon: "home", label: "Início", primary: true },
  { route: "disciplinas", icon: "book", label: "Matérias", primary: true, group: "Estudos" },
  { route: "avaliacoes", icon: "file", label: "Avaliações", group: "Estudos" },
  { route: "tarefas", icon: "check", label: "Tarefas", primary: true, group: "Estudos" },
  { route: "calendario", icon: "calendar", label: "Agenda", primary: true, group: "Planejamento" },
  { route: "estudos", icon: "target", label: "Plano de estudos", group: "Planejamento" },
  { route: "pomodoro", icon: "clock", label: "Pomodoro", group: "Planejamento" },
  { route: "estatisticas", icon: "bars", label: "Estatísticas", group: "Análise" },
  { route: "grade", icon: "grid", label: "Grade curricular", group: "Análise" },
  { route: "config", icon: "sliders", label: "Configurações" },
];

const Pages = {}; // cada módulo de página registra { render(container, param) }

function registerPage(name, def) { Pages[name] = def; }

const App = (() => {
  let currentRoute = "dashboard";
  let currentParam = null;

  function parseHash() {
    const hash = (location.hash || "#/dashboard").replace(/^#\//, "");
    const [route, param] = hash.split("/");
    return { route: route || "dashboard", param: param || null };
  }

  function setActiveNav(route) {
    document.querySelectorAll("#sidebar .nav-item, #bottom-nav .nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === route);
    });
    const maisBtn = document.querySelector('#bottom-nav .nav-item[data-route="mais"]');
    if (maisBtn) {
      const isSecondary = NAV_ITEMS.some((n) => n.route === route && !n.primary);
      maisBtn.classList.toggle("active", isSecondary);
    }
  }

  function updateFab(route) {
    const fab = document.getElementById("fab");
    if (route === "tarefas" && Pages.tarefas && Pages.tarefas.onFab) {
      fab.hidden = false;
      fab.innerHTML = icon("plus");
      fab.onclick = Pages.tarefas.onFab;
    } else {
      fab.hidden = true;
      fab.onclick = null;
    }
  }

  async function render() {
    const { route, param } = parseHash();
    currentRoute = route;
    currentParam = param;
    setActiveNav(route);
    updateFab(route);
    const view = document.getElementById("view");
    const page = Pages[route];
    if (!page) {
      view.innerHTML = `<div class="container"><div class="empty-state"><p>Página não encontrada.</p></div></div>`;
      return;
    }
    view.innerHTML = `<div class="container" id="page-${route}"><p class="empty-state">Carregando…</p></div>`;
    try {
      await page.render(document.getElementById(`page-${route}`), param);
      updateFab(route);
    } catch (e) {
      view.querySelector(".container").innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
    }
  }

  function refresh() { render(); }

  return { render, refresh, get currentRoute() { return currentRoute; } };
})();

const UI = (() => {
  function openModal({ title, bodyHtml, actionsHtml = "" }) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${title}</h3>
        <button type="button" class="icon-btn" id="modal-close" aria-label="Fechar" title="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${actionsHtml ? `<div class="modal-actions"><button type="button" class="btn" id="modal-cancel">Cancelar</button>${actionsHtml}</div>` : ""}
    </div>`;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.addEventListener("click", backdropClick);
    document.getElementById("modal-close").addEventListener("click", closeModal);
    const cancelBtn = document.getElementById("modal-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  }

  function backdropClick(e) {
    if (e.target.id === "modal-root") closeModal();
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.removeEventListener("click", backdropClick);
    root.innerHTML = "";
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function confirmar(mensagem) {
    return window.confirm(mensagem);
  }

  return { openModal, closeModal, showToast, confirmar };
})();

/* ---------- Tema ---------- */
function aplicarTemaSalvo() {
  const btn = document.getElementById("theme-toggle");
  const atualizarIcone = () => {
    const attr = document.documentElement.getAttribute("data-theme");
    const escuro = attr === "dark" || (!attr && window.matchMedia("(prefers-color-scheme: dark)").matches);
    btn.innerHTML = icon(escuro ? "sun" : "moon");
  };
  atualizarIcone();
  btn.addEventListener("click", () => {
    const atual = document.documentElement.getAttribute("data-theme");
    const escuroAtivo = atual === "dark" || (!atual && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const novo = escuroAtivo ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    try { localStorage.setItem("tema", novo === "light" ? "claro" : "escuro"); } catch (e) {}
    atualizarIcone();
  });
}

/* ---------- Página de Configurações (inclui import/export) ---------- */
registerPage("config", {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Configurações</h1></div>
      <p class="page-subtitle">Aparência e dados do sistema.</p>

      <div class="section">
        <div class="section-header"><h2>Aparência</h2></div>
        <div class="panel">
          <p class="field-hint" style="margin-top:0;">Tema claro, escuro ou o padrão do sistema operacional.</p>
          <div class="field-row">
            <button class="btn" data-tema="claro">Claro</button>
            <button class="btn" data-tema="escuro">Escuro</button>
            <button class="btn" data-tema="sistema">Sistema</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Conta</h2></div>
        <div class="panel">
          <form id="form-trocar-senha">
            <div class="field"><label for="cfg-senha-atual">Senha atual</label><input id="cfg-senha-atual" type="password" required autocomplete="current-password"></div>
            <div class="field"><label for="cfg-senha-nova">Nova senha</label><input id="cfg-senha-nova" type="password" required minlength="6" autocomplete="new-password"></div>
            <button type="submit" class="btn btn-primary">Trocar senha</button>
          </form>
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Importar planilha</h2></div>
        <div class="panel">
          <p class="field-hint" style="margin-top:0;">A importação pode adicionar ou atualizar dados existentes.</p>
          <div class="field">
            <label for="modo-importacao">Modo de importação</label>
            <select id="modo-importacao">
              <option value="add">Adicionar — mantém o que já existe, só insere novo</option>
              <option value="update" selected>Atualizar — insere novos e atualiza existentes</option>
              <option value="replace">Substituir — apaga tudo e importa do zero</option>
            </select>
          </div>
          <button class="btn btn-primary" id="btn-importar">${icon("upload")} Selecionar arquivo .xlsx</button>
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Exportar dados</h2></div>
        <div class="panel">
          <p class="field-hint" style="margin-top:0;">Gera um novo arquivo .xlsx com os dados atuais do sistema.</p>
          <button class="btn" id="btn-exportar">${icon("download")} Exportar dados</button>
        </div>
      </div>
    `;

    container.querySelectorAll("[data-tema]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tema = btn.dataset.tema;
        if (tema === "sistema") {
          document.documentElement.removeAttribute("data-theme");
          try { localStorage.removeItem("tema"); } catch (e) {}
        } else {
          document.documentElement.setAttribute("data-theme", tema === "claro" ? "light" : "dark");
          try { localStorage.setItem("tema", tema); } catch (e) {}
        }
        aplicarTemaSalvo();
        UI.showToast("Tema atualizado.");
      });
    });

    container.querySelector("#form-trocar-senha").addEventListener("submit", async (e) => {
      e.preventDefault();
      const senhaAtual = document.getElementById("cfg-senha-atual").value;
      const senhaNova = document.getElementById("cfg-senha-nova").value;
      try {
        await Api.trocarSenha({ senha_atual: senhaAtual, senha_nova: senhaNova });
        document.getElementById("form-trocar-senha").reset();
        UI.showToast("Senha alterada.");
      } catch (err) { UI.showToast(err.message); }
    });

    container.querySelector("#btn-importar").addEventListener("click", () => {
      const input = document.getElementById("import-file-input");
      input.value = "";
      input.onchange = async () => {
        const arquivo = input.files[0];
        if (!arquivo) return;
        if (!UI.confirmar("A importação pode adicionar ou atualizar dados existentes. Deseja continuar?")) return;
        const modo = document.getElementById("modo-importacao").value;
        try {
          const resumo = await Api.importarXlsx(arquivo, modo);
          UI.showToast(`Importação concluída: ${resumo.inseridos} inseridos, ${resumo.atualizados} atualizados.`);
          App.refresh();
        } catch (e) {
          UI.showToast(`Erro na importação: ${e.message}`);
        }
      };
      input.click();
    });

    container.querySelector("#btn-exportar").addEventListener("click", () => {
      window.location.href = Api.exportarXlsxUrl();
    });
  },
});

/* ---------- Autenticação ---------- */
let authModo = "login"; // "login" | "cadastro"

let appJaIniciado = false;

function aplicarUsuarioLogado(usuario) {
  document.getElementById("usuario-nome").textContent = usuario.nome;
  document.getElementById("logout-btn").innerHTML = icon("logout");
  document.getElementById("logout-btn").onclick = async () => {
    await Api.logout();
    mostrarTelaAuth();
  };
}

async function iniciarApp(usuario) {
  aplicarUsuarioLogado(usuario);
  document.getElementById("auth-screen").hidden = true;
  document.getElementById("app-shell").hidden = false;
  if (!appJaIniciado) {
    appJaIniciado = true;
    buildSidebarAndNav();
    aplicarTemaSalvo();
    window.addEventListener("hashchange", App.render);
    if (!location.hash) location.hash = "#/dashboard";
  }
  App.render();
}

function mostrarTelaAuth() {
  document.getElementById("app-shell").hidden = true;
  const tela = document.getElementById("auth-screen");
  tela.hidden = false;
  aplicarModoAuth();
}

function aplicarModoAuth() {
  const cadastro = authModo === "cadastro";
  document.getElementById("auth-titulo").textContent = "Meu Sistema de Estudos";
  document.getElementById("auth-subtitulo").textContent = cadastro
    ? "Crie sua conta para começar."
    : "Entre com sua conta para continuar.";
  document.getElementById("auth-campo-nome").hidden = !cadastro;
  document.getElementById("auth-submit").textContent = cadastro ? "Criar conta" : "Entrar";
  document.getElementById("auth-alternar").textContent = cadastro
    ? "Já tem conta? Entrar"
    : "Não tem conta? Cadastre-se";
  document.getElementById("auth-erro").style.display = "none";
}

function configurarAuth() {
  document.getElementById("auth-alternar").addEventListener("click", () => {
    authModo = authModo === "login" ? "cadastro" : "login";
    aplicarModoAuth();
  });

  document.getElementById("form-auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById("auth-erro");
    erroEl.style.display = "none";
    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value;
    try {
      let usuario;
      if (authModo === "cadastro") {
        const nome = document.getElementById("auth-nome").value.trim();
        if (!nome) { throw new Error("Informe seu nome."); }
        usuario = await Api.cadastro({ nome, email, senha });
      } else {
        usuario = await Api.login({ email, senha });
      }
      document.getElementById("form-auth").reset();
      await iniciarApp(usuario);
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.style.display = "block";
    }
  });

  window.addEventListener("auth:required", () => mostrarTelaAuth());
}

/* ---------- Inicialização ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  configurarAuth();
  try {
    const usuario = await Api.me();
    await iniciarApp(usuario);
  } catch (e) {
    mostrarTelaAuth();
  }
});

function navItemHtml(item) {
  return `<button type="button" class="nav-item" data-route="${item.route}">
    ${icon(item.icon)}<span class="nav-label">${item.label}</span>
  </button>`;
}

function buildSidebarAndNav() {
  const sidebarContainer = document.getElementById("sidebar-items");
  const semGrupo = NAV_ITEMS.filter((n) => !n.group && n.route !== "config");
  const grupos = [];
  NAV_ITEMS.forEach((item) => {
    if (!item.group) return;
    let g = grupos.find((x) => x.nome === item.group);
    if (!g) { g = { nome: item.group, itens: [] }; grupos.push(g); }
    g.itens.push(item);
  });
  const config = NAV_ITEMS.find((n) => n.route === "config");

  let html = `<div class="nav-group">${semGrupo.map((i) => navItemHtml(i)).join("")}</div>`;
  grupos.forEach((g) => {
    html += `<div class="nav-group">
      <div class="nav-group-label">${g.nome}</div>
      ${g.itens.map((i) => navItemHtml(i)).join("")}
    </div>`;
  });
  html += `<div class="nav-divider"></div><div class="nav-group">${navItemHtml(config)}</div>`;
  sidebarContainer.innerHTML = html;
  sidebarContainer.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => { location.hash = `#/${el.dataset.route}`; });
  });

  const primary = NAV_ITEMS.filter((n) => n.primary);
  const bottomNav = document.getElementById("bottom-nav");
  bottomNav.innerHTML = primary.map((item) => `
    <button type="button" class="nav-item" data-route="${item.route}">
      ${icon(item.icon)}<span>${item.label}</span>
    </button>`).join("") + `
    <button type="button" class="nav-item" data-route="mais">
      ${icon("more")}<span>Mais</span>
    </button>`;
  bottomNav.querySelectorAll('.nav-item:not([data-route="mais"])').forEach((el) => {
    el.addEventListener("click", () => { location.hash = `#/${el.dataset.route}`; });
  });
  bottomNav.querySelector('.nav-item[data-route="mais"]').addEventListener("click", () => {
    const secundarios = NAV_ITEMS.filter((n) => !n.primary);
    UI.openModal({
      title: "Mais opções",
      bodyHtml: `<div class="sheet-grid">${secundarios.map((item) => `
        <button type="button" class="nav-item" data-route="${item.route}">
          ${icon(item.icon)}<span>${item.label}</span>
        </button>`).join("")}</div>`,
    });
    document.querySelectorAll("#modal-root .sheet-grid .nav-item").forEach((el) => {
      el.addEventListener("click", () => {
        location.hash = `#/${el.dataset.route}`;
        UI.closeModal();
      });
    });
  });
}
