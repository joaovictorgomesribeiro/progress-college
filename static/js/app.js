/* Meu Sistema de Estudos - shell da aplicação: roteamento, navegação, modal, tema */

const NAV_ITEMS = [
  { route: "dashboard", icon: "🏠", label: "Início", primary: true },
  { route: "disciplinas", icon: "📚", label: "Matérias", primary: true },
  { route: "tarefas", icon: "✅", label: "Tarefas", primary: true },
  { route: "calendario", icon: "📅", label: "Agenda", primary: true },
  { route: "avaliacoes", icon: "📝", label: "Avaliações" },
  { route: "estudos", icon: "🎯", label: "Estudos" },
  { route: "pomodoro", icon: "🍅", label: "Pomodoro" },
  { route: "estatisticas", icon: "📊", label: "Estatísticas" },
  { route: "grade", icon: "🎓", label: "Grade" },
  { route: "config", icon: "⚙️", label: "Config." },
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
      view.innerHTML = `<div class="container"><div class="empty-state"><span class="empty-emoji">🤔</span>Página não encontrada.</div></div>`;
      return;
    }
    view.innerHTML = `<div class="container" id="page-${route}"><div class="empty-state">Carregando…</div></div>`;
    try {
      await page.render(document.getElementById(`page-${route}`), param);
      updateFab(route);
    } catch (e) {
      view.querySelector(".container").innerHTML = `<div class="empty-state"><span class="empty-emoji">⚠️</span>${e.message}</div>`;
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
        <button type="button" class="icon-btn" id="modal-close" aria-label="Fechar">✕</button>
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
    btn.textContent = escuro ? "☀️" : "🌙";
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
      <h1>Configurações</h1>

      <div class="card" style="margin-bottom:16px;">
        <h3>🎨 Aparência</h3>
        <p class="foco-sub">Escolha entre tema claro, escuro ou o padrão do sistema.</p>
        <div class="field-row">
          <button class="btn" data-tema="claro">☀️ Claro</button>
          <button class="btn" data-tema="escuro">🌙 Escuro</button>
          <button class="btn" data-tema="sistema">🖥️ Sistema</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3>📥 Importar planilha (.xlsx)</h3>
        <p class="foco-sub">A importação pode adicionar ou atualizar dados existentes.</p>
        <div class="field">
          <label for="modo-importacao">Modo de importação</label>
          <select id="modo-importacao">
            <option value="add">Adicionar (mantém o que já existe, só insere novo)</option>
            <option value="update" selected>Atualizar (insere novos e atualiza existentes)</option>
            <option value="replace">Substituir (apaga tudo e importa do zero)</option>
          </select>
        </div>
        <button class="btn btn-primary btn-block" id="btn-importar">Selecionar arquivo .xlsx</button>
      </div>

      <div class="card">
        <h3>📤 Exportar dados</h3>
        <p class="foco-sub">Gera um novo arquivo .xlsx com os dados atuais do sistema.</p>
        <button class="btn btn-primary btn-block" id="btn-exportar">Exportar dados</button>
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

/* ---------- Inicialização ---------- */
document.addEventListener("DOMContentLoaded", () => {
  buildSidebarAndNav();
  aplicarTemaSalvo();
  window.addEventListener("hashchange", App.render);
  if (!location.hash) location.hash = "#/dashboard";
  App.render();
});

function buildSidebarAndNav() {
  const sidebarContainer = document.getElementById("sidebar-items");
  sidebarContainer.innerHTML = NAV_ITEMS.map((item) => `
    <button type="button" class="nav-item" data-route="${item.route}">
      <span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>
    </button>`).join("");
  sidebarContainer.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => { location.hash = `#/${el.dataset.route}`; });
  });

  const primary = NAV_ITEMS.filter((n) => n.primary);
  const bottomNav = document.getElementById("bottom-nav");
  bottomNav.innerHTML = primary.map((item) => `
    <button type="button" class="nav-item" data-route="${item.route}">
      <span class="nav-icon">${item.icon}</span><span>${item.label}</span>
    </button>`).join("") + `
    <button type="button" class="nav-item" data-route="mais">
      <span class="nav-icon">⋯</span><span>Mais</span>
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
          <span class="nav-icon">${item.icon}</span><span>${item.label}</span>
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
