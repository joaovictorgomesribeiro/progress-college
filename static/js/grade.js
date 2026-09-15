/* Meu Sistema de Estudos - Grade curricular e pré-requisitos */

const STATUS_GRADE_EMOJI = { concluida: "🟢", andamento: "🔵", planejada: "🟡", bloqueada: "🔴" };
const STATUS_GRADE_LABEL = { concluida: "Concluída", andamento: "Em andamento", planejada: "Planejada", bloqueada: "Bloqueada" };

registerPage("grade", {
  async render(container) {
    const periodos = await Api.obterGrade();

    container.innerHTML = `
      <h1>Grade curricular</h1>
      <div class="card" style="margin-bottom:16px;">
        <div class="foco-sub">
          🟢 Concluída &nbsp; 🔵 Em andamento &nbsp; 🟡 Planejada &nbsp; 🔴 Bloqueada
        </div>
      </div>

      ${periodos.length ? periodos.map(periodoHtml).join("") : emptyState("🎓", "Nenhuma disciplina na grade ainda.")}
    `;

    container.querySelectorAll(".grade-disciplina").forEach((el) => {
      el.addEventListener("click", () => { location.hash = `#/disciplinas/${el.dataset.id}`; });
    });
  },
});

function periodoHtml(p) {
  return `<div class="grade-periodo">
    <h3>${p.periodo}º PERÍODO</h3>
    <div class="grade-list">
      ${p.disciplinas.map(disciplinaGradeHtml).join("")}
    </div>
  </div>`;
}

function disciplinaGradeHtml(d) {
  const bloqueadaPor = (d.pre_requisitos || []).filter((p) => p.status !== "concluida");
  return `<div class="grade-disciplina" data-id="${d.id}" role="button" tabindex="0">
    <span class="status-emoji">${STATUS_GRADE_EMOJI[d.status_efetivo] || "🟡"}</span>
    <div style="flex:1;">
      <div style="font-weight:700;">${d.nome}</div>
      ${d.status_efetivo === "bloqueada" && bloqueadaPor.length
        ? `<div class="prereq-note">🔒 Pré-requisito: ${bloqueadaPor.map((p) => p.nome).join(", ")}</div>`
        : `<div class="prereq-note">${STATUS_GRADE_LABEL[d.status_efetivo]}</div>`}
    </div>
  </div>`;
}
