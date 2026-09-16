/* Meu Sistema de Estudos - Calendário / Agenda */

let calDataSelecionada = new Date().toISOString().slice(0, 10);
let calMesAtual = new Date().getMonth();
let calAnoAtual = new Date().getFullYear();

const MESES_NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

registerPage("calendario", {
  async render(container) {
    const [avaliacoes, tarefas] = await Promise.all([Api.listarAvaliacoes(), Api.listarTarefas()]);
    const eventosPorData = agruparEventosPorData(avaliacoes, tarefas);

    container.innerHTML = `
      <div class="page-header"><h1>Agenda</h1></div>

      <div class="panel" style="margin-bottom:var(--space-5);">
        <div class="page-header" style="margin-bottom:var(--space-3);">
          <button class="icon-btn" id="cal-prev" aria-label="Mês anterior" title="Mês anterior">${icon("arrowLeft")}</button>
          <h2>${MESES_NOMES[calMesAtual]} ${calAnoAtual}</h2>
          <button class="icon-btn" id="cal-next" aria-label="Próximo mês" title="Próximo mês" style="transform:scaleX(-1);">${icon("arrowLeft")}</button>
        </div>
        <div class="cal-weekday-row">${["D", "S", "T", "Q", "Q", "S", "S"].map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="cal-month-grid" id="cal-grid"></div>
      </div>

      <div class="section-header"><h2>${formatarDataLonga(calDataSelecionada)}</h2></div>
      <div class="list" id="cal-agenda"></div>
    `;

    renderGridMes(container, eventosPorData);
    renderAgendaDia(container, eventosPorData);

    container.querySelector("#cal-prev").addEventListener("click", () => {
      calMesAtual--; if (calMesAtual < 0) { calMesAtual = 11; calAnoAtual--; }
      App.refresh();
    });
    container.querySelector("#cal-next").addEventListener("click", () => {
      calMesAtual++; if (calMesAtual > 11) { calMesAtual = 0; calAnoAtual++; }
      App.refresh();
    });
  },
});

function agruparEventosPorData(avaliacoes, tarefas) {
  const map = {};
  avaliacoes.forEach((a) => {
    if (!a.data) return;
    (map[a.data] = map[a.data] || []).push({
      tipo: "avaliacao", titulo: `${TIPO_AVAL_LABEL[a.tipo] || "Avaliação"} de ${a.disciplina_nome}`,
      sub: a.titulo, hora: null, dotClasse: "dot-danger",
    });
  });
  tarefas.forEach((t) => {
    if (!t.prazo || t.status === "concluida") return;
    (map[t.prazo] = map[t.prazo] || []).push({
      tipo: "tarefa", titulo: t.nome, sub: t.disciplina_nome || "Geral", hora: "23:59", dotClasse: "dot-info",
    });
  });
  return map;
}

function renderGridMes(container, eventosPorData) {
  const grid = container.querySelector("#cal-grid");
  const primeiroDia = new Date(calAnoAtual, calMesAtual, 1);
  const totalDias = new Date(calAnoAtual, calMesAtual + 1, 0).getDate();
  const offset = primeiroDia.getDay();
  const hojeIso = new Date().toISOString().slice(0, 10);

  let html = "";
  for (let i = 0; i < offset; i++) html += `<div class="cal-cell empty"></div>`;
  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${calAnoAtual}-${String(calMesAtual + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const temEvento = !!eventosPorData[iso];
    html += `<button type="button" class="cal-cell ${iso === hojeIso ? "today" : ""} ${iso === calDataSelecionada ? "selected" : ""}" data-dia="${iso}">
      ${dia}${temEvento ? '<span class="cal-dot"></span>' : ""}
    </button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll("[data-dia]").forEach((btn) => {
    btn.addEventListener("click", () => {
      calDataSelecionada = btn.dataset.dia;
      App.refresh();
    });
  });
}

function renderAgendaDia(container, eventosPorData) {
  const eventos = (eventosPorData[calDataSelecionada] || []).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  const agenda = container.querySelector("#cal-agenda");
  agenda.innerHTML = eventos.length
    ? eventos.map((e) => `<div class="agenda-item">
        <div class="agenda-time">${e.hora || "—"}</div>
        <span class="dot ${e.dotClasse}" style="margin-top:6px;"></span>
        <div>
          <div style="font-weight:500;">${e.titulo}</div>
          <div class="list-row-sub">${e.sub}</div>
        </div>
      </div>`).join("")
    : `<p class="empty-state">Nenhum evento neste dia.</p>`;
}

function formatarDataLonga(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia} de ${MESES_NOMES[parseInt(mes, 10) - 1].toLowerCase()}`;
}
