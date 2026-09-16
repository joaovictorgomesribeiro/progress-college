/* Meu Sistema de Estudos - Pomodoro */

const POMODORO_PRESETS = [
  { label: "25 / 5", foco: 25, pausa: 5 },
  { label: "50 / 10", foco: 50, pausa: 10 },
];

let pomodoro = {
  foco: 25, pausa: 5, restanteSeg: 25 * 60, emPausa: false, rodando: false,
  timerId: null, sessaoNumero: 1, disciplinaId: null,
};

function pomContainer() {
  return document.getElementById("page-pomodoro");
}

registerPage("pomodoro", {
  async render(container) {
    const disciplinas = await Api.listarDisciplinas();
    container.innerHTML = `
      <div class="page-header"><h1>Pomodoro</h1></div>
      <div class="pomodoro-wrap">
        <div class="field" style="width:100%; max-width:280px;">
          <label for="pom-disciplina">Matéria</label>
          <select id="pom-disciplina">
            <option value="">Estudo geral</option>
            ${disciplinas.map((d) => `<option value="${d.id}" ${pomodoro.disciplinaId === String(d.id) ? "selected" : ""}>${d.nome}</option>`).join("")}
          </select>
        </div>

        <div class="pomodoro-presets">
          ${POMODORO_PRESETS.map((p) => `<button class="btn" data-preset="${p.foco}-${p.pausa}">${p.label}</button>`).join("")}
          <button class="btn" id="btn-preset-custom">Personalizado</button>
        </div>
        <div id="preset-custom-fields" class="field-row" hidden style="width:100%; max-width:280px;">
          <div class="field"><label for="pom-custom-foco">Foco (min)</label><input id="pom-custom-foco" type="number" min="1" value="25"></div>
          <div class="field"><label for="pom-custom-pausa">Pausa (min)</label><input id="pom-custom-pausa" type="number" min="1" value="5"></div>
        </div>

        <div class="pomodoro-ring" id="pom-ring" style="--pct:0;">
          <div class="pomodoro-ring-inner">
            <div class="pomodoro-timer" id="pom-display">25:00</div>
            <div id="pom-disciplina-nome" class="field-hint">Estudo geral</div>
          </div>
        </div>

        <div class="pomodoro-controls">
          <button class="btn btn-primary" id="btn-pom-toggle">${pomodoro.rodando ? "Pausar" : "Iniciar"}</button>
          <button class="btn" id="btn-pom-reset">Reiniciar</button>
        </div>
        <div class="field-hint">Sessão #${pomodoro.sessaoNumero}${pomodoro.emPausa ? " · Pausa" : ""}</div>
      </div>
    `;

    atualizarDisplay();

    container.querySelectorAll("[data-preset]").forEach((btn) => btn.addEventListener("click", () => {
      const [foco, pausa] = btn.dataset.preset.split("-").map(Number);
      definirPreset(foco, pausa);
    }));
    container.querySelector("#btn-preset-custom").addEventListener("click", () => {
      container.querySelector("#preset-custom-fields").hidden = false;
    });
    container.querySelector("#pom-custom-foco").addEventListener("change", aplicarCustom);
    container.querySelector("#pom-custom-pausa").addEventListener("change", aplicarCustom);

    container.querySelector("#pom-disciplina").addEventListener("change", (e) => {
      pomodoro.disciplinaId = e.target.value || null;
      const nome = e.target.options[e.target.selectedIndex].text;
      const label = container.querySelector("#pom-disciplina-nome");
      if (label) label.textContent = nome;
    });

    container.querySelector("#btn-pom-toggle").addEventListener("click", togglePomodoro);
    container.querySelector("#btn-pom-reset").addEventListener("click", resetPomodoro);
  },
});

function aplicarCustom() {
  const container = pomContainer();
  if (!container) return;
  const foco = parseInt(container.querySelector("#pom-custom-foco").value, 10) || 25;
  const pausa = parseInt(container.querySelector("#pom-custom-pausa").value, 10) || 5;
  definirPreset(foco, pausa);
}

function definirPreset(foco, pausa) {
  clearInterval(pomodoro.timerId);
  pomodoro = { ...pomodoro, foco, pausa, restanteSeg: foco * 60, emPausa: false, rodando: false, timerId: null };
  atualizarDisplay();
}

function togglePomodoro() {
  if (pomodoro.rodando) {
    clearInterval(pomodoro.timerId);
    pomodoro.rodando = false;
  } else {
    pomodoro.rodando = true;
    pomodoro.timerId = setInterval(tick, 1000);
  }
  atualizarDisplay();
}

function resetPomodoro() {
  clearInterval(pomodoro.timerId);
  pomodoro.restanteSeg = (pomodoro.emPausa ? pomodoro.pausa : pomodoro.foco) * 60;
  pomodoro.rodando = false;
  atualizarDisplay();
}

async function tick() {
  pomodoro.restanteSeg--;
  if (pomodoro.restanteSeg <= 0) {
    if (!pomodoro.emPausa) {
      try {
        await Api.criarEstudo({
          disciplina_id: pomodoro.disciplinaId, data: new Date().toISOString().slice(0, 10),
          duracao_min: pomodoro.foco, tipo: "pomodoro",
          observacoes: `Sessão #${pomodoro.sessaoNumero} de pomodoro`,
        });
        UI.showToast("Sessão de foco registrada. Hora da pausa.");
      } catch (e) { /* segue mesmo se falhar o registro */ }
      pomodoro.emPausa = true;
      pomodoro.restanteSeg = pomodoro.pausa * 60;
    } else {
      pomodoro.emPausa = false;
      pomodoro.sessaoNumero++;
      pomodoro.restanteSeg = pomodoro.foco * 60;
      UI.showToast("Pausa terminada. Hora de focar novamente.");
    }
  }
  atualizarDisplay();
}

function atualizarDisplay() {
  const container = pomContainer();
  if (!container) return;
  const min = String(Math.floor(pomodoro.restanteSeg / 60)).padStart(2, "0");
  const seg = String(pomodoro.restanteSeg % 60).padStart(2, "0");
  const display = container.querySelector("#pom-display");
  if (display) display.textContent = `${min}:${seg}`;
  const total = (pomodoro.emPausa ? pomodoro.pausa : pomodoro.foco) * 60;
  const pct = total ? Math.round(100 * (1 - pomodoro.restanteSeg / total)) : 0;
  const ring = container.querySelector("#pom-ring");
  if (ring) ring.style.setProperty("--pct", pct);
  const subLabel = container.querySelector("#pom-disciplina-nome");
  if (subLabel && pomodoro.emPausa) subLabel.textContent = "Pausa";
  const toggleBtn = container.querySelector("#btn-pom-toggle");
  if (toggleBtn) toggleBtn.textContent = pomodoro.rodando ? "Pausar" : "Continuar";
  if (toggleBtn && pomodoro.restanteSeg === (pomodoro.emPausa ? pomodoro.pausa : pomodoro.foco) * 60 && !pomodoro.rodando) {
    toggleBtn.textContent = "Iniciar";
  }
  const sessaoLabel = container.querySelector(".pomodoro-wrap > .field-hint");
  if (sessaoLabel) sessaoLabel.textContent = `Sessão #${pomodoro.sessaoNumero}${pomodoro.emPausa ? " · Pausa" : ""}`;
}
