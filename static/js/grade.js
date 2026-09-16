/* Meu Sistema de Estudos - Grade curricular e pré-requisitos */

const STATUS_GRADE_DOT = { concluida: "dot-success", andamento: "dot-info", planejada: "dot", bloqueada: "dot-danger" };
const STATUS_GRADE_LABEL = { concluida: "Concluída", andamento: "Em andamento", planejada: "Planejada", bloqueada: "Bloqueada" };

registerPage("grade", {
  async render(container) {
    const periodos = await Api.obterGrade();

    container.innerHTML = `
      <div class="page-header"><h1>Grade curricular</h1></div>
      <div class="legend-row" style="margin-bottom:var(--space-6);">
        ${Object.entries(STATUS_GRADE_LABEL).map(([status, label]) => `
          <span class="legend-item"><span class="dot ${STATUS_GRADE_DOT[status]}"></span>${label}</span>
        `).join("")}
      </div>

      ${periodos.length ? periodos.map(periodoHtml).join("") : `<p class="empty-state">Nenhuma disciplina na grade ainda.</p>`}
    `;

    container.querySelectorAll(".list-row[data-id]").forEach((el) => {
      el.addEventListener("click", () => { location.hash = `#/disciplinas/${el.dataset.id}`; });
    });
  },
});

function periodoHtml(p) {
  return `<div class="grade-periodo">
    <h3>${p.periodo}º período</h3>
    <div class="list">
      ${p.disciplinas.map(disciplinaGradeHtml).join("")}
    </div>
  </div>`;
}

function disciplinaGradeHtml(d) {
  const bloqueadaPor = (d.pre_requisitos || []).filter((p) => p.status !== "concluida");
  return `<div class="list-row" data-id="${d.id}">
    <span class="dot ${STATUS_GRADE_DOT[d.status_efetivo] || "dot"}"></span>
    <div class="list-row-main">
      <div class="list-row-title">${d.nome}</div>
      ${d.status_efetivo === "bloqueada" && bloqueadaPor.length
        ? `<div class="prereq-note">Pré-requisito: ${bloqueadaPor.map((p) => p.nome).join(", ")}</div>`
        : `<div class="prereq-note">${STATUS_GRADE_LABEL[d.status_efetivo]}</div>`}
    </div>
  </div>`;
}
