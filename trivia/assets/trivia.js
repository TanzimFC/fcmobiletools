(() => {
  const page = document.querySelector("[data-trivia]");
  if (!page) return;

  const questions = [...page.querySelectorAll(".question-data")].map(el => ({
    text: el.querySelector(".question-text").innerHTML,
    answer: el.dataset.answer,
    explanation: el.querySelector(".question-explanation").innerHTML,
    options: [...el.querySelectorAll(".question-option")].map(o => o.textContent.trim())
  }));
  if (!questions.length) return;

  const $ = sel => document.querySelector(sel);
  const els = {
    num: $("#questionNumber"), qt: $("#questionText"), opts: $("#options"),
    answerBox: $("#answerBox"), answerText: $("#answerText"), explanation: $("#explanation"),
    check: $("#check"), show: $("#show"), next: $("#next"), dots: $("#dots"),
    quiz: $("#quiz"), result: $("#result"), score: $("#score"), retry: $("#retry"), back: $("#back")
  };

  const state = { index: 0, score: 0, locked: false };
  const storageKey = `trivia-${page.dataset.country || "unknown"}-${page.dataset.day || "unknown"}`;

  function renderDots() {
    els.dots.innerHTML = questions.map((_, i) => {
      const cls = i < state.index ? "done" : i === state.index ? "current" : "";
      return `<span class="dot ${cls}" aria-hidden="true"></span>`;
    }).join("");
  }

  function renderQuestion() {
    state.locked = false;
    const q = questions[state.index];
    els.num.textContent = `Question ${state.index + 1} of ${questions.length}`;
    els.qt.innerHTML = q.text;
    els.opts.innerHTML = q.options.map((opt, i) => `<button class="option" type="button" aria-label="Option ${String.fromCharCode(65 + i)}: ${opt}"><span class="option-key">${String.fromCharCode(65 + i)}</span>${opt}</button>`).join("");

    els.opts.querySelectorAll(".option").forEach(btn => btn.addEventListener("click", () => {
      if (state.locked) return;
      els.opts.querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      els.check.disabled = false;
    }));

    els.answerBox.classList.remove("show");
    els.answerText.textContent = q.answer;
    els.explanation.innerHTML = q.explanation;
    els.check.disabled = true;
    els.check.style.display = "inline-block";
    els.show.style.display = "inline-block";
    els.next.style.display = "none";
    renderDots();
  }

  function lockOptions(correctAnswer) {
    els.opts.querySelectorAll(".option").forEach(btn => {
      btn.disabled = true;
      if (btn.textContent.trim().replace(/^[A-D]\s*/, "") === correctAnswer) btn.classList.add("correct");
    });
  }

  function revealAnswer() {
    els.answerBox.classList.add("show");
    els.check.style.display = "none";
    els.show.style.display = "none";
    els.next.style.display = "inline-block";
    els.next.focus({ preventScroll: true });
  }

  function finish() {
    els.quiz.style.display = "none";
    els.result.classList.add("show");
    els.score.textContent = `${state.score} / ${questions.length}`;
    try { localStorage.setItem(storageKey, JSON.stringify({ score: state.score, total: questions.length, completed: true })); } catch {}
  }

  els.check.addEventListener("click", () => {
    if (state.locked) return;
    const selected = els.opts.querySelector(".selected");
    if (!selected) return;
    state.locked = true;
    const q = questions[state.index];
    const chosen = selected.textContent.trim().replace(/^[A-D]\s*/, "");
    const isCorrect = chosen === q.answer;
    if (isCorrect) state.score++;
    selected.classList.add(isCorrect ? "correct" : "wrong");
    lockOptions(q.answer);
    revealAnswer();
  });

  els.show.addEventListener("click", () => {
    if (state.locked) return;
    state.locked = true;
    lockOptions(questions[state.index].answer);
    revealAnswer();
  });

  els.next.addEventListener("click", () => {
    state.index++;
    if (state.index >= questions.length) finish();
    else renderQuestion();
  });

  els.retry.addEventListener("click", () => {
    state.index = 0;
    state.score = 0;
    els.result.classList.remove("show");
    els.quiz.style.display = "block";
    renderQuestion();
  });

  els.back.addEventListener("click", () => {
    location.href = `/trivia/${page.dataset.country || "mexico"}/`;
  });

  document.addEventListener("keydown", e => {
    if (state.locked && e.key === "Enter" && els.next.style.display !== "none") {
      els.next.click(); return;
    }
    if (state.locked) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      const btn = els.opts.querySelectorAll(".option")[n - 1];
      if (btn) btn.click();
    }
    if (e.key === "Enter" && !els.check.disabled) els.check.click();
  });

  renderQuestion();
})();
