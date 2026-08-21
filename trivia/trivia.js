/*
 * A Nation's Story — Trivia Engine
 * Progressive enhancement: the HTML already contains every question,
 * option, answer and explanation. This script only adds interactivity
 * (selecting an option, checking it, tracking progress, scoring).
 * If this file fails to load, every <details> fallback still works
 * and the page remains a fully readable guide.
 */

(function () {
  "use strict";

  // Mark JS as active so CSS can hide the no-js fallbacks.
  document.documentElement.classList.add("js");

  var root = document.querySelector("[data-quiz]");
  if (!root) return;

  var questionEls = Array.prototype.slice.call(root.querySelectorAll("[data-question]"));
  if (!questionEls.length) return;

  var total = questionEls.length;
  var current = 0;
  var results = []; // { correct: boolean, selectedText: string|null }

  var metaCurrent = root.querySelector("[data-meta-current]");
  var metaTotal = root.querySelector("[data-meta-total]");
  var progressFill = root.querySelector("[data-progress-fill]");
  var progressDots = root.querySelector("[data-progress-dots]");
  var completePanel = document.querySelector("[data-complete]");
  var quizWrap = document.querySelector("[data-quiz-wrap]");

  if (metaTotal) metaTotal.textContent = String(total);

  // Build progress dots
  if (progressDots) {
    for (var d = 0; d < total; d++) {
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("data-index", String(d));
      progressDots.appendChild(dot);
    }
  }

  function updateProgress() {
    if (metaCurrent) metaCurrent.textContent = String(current + 1);
    var pct = ((current) / total) * 100;
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressDots) {
      var dots = progressDots.querySelectorAll(".dot");
      dots.forEach(function (dot, i) {
        if (i < current) dot.setAttribute("data-state", "done");
        else if (i === current) dot.setAttribute("data-state", "current");
        else dot.removeAttribute("data-state");
      });
    }
  }

  function showQuestion(index) {
    questionEls.forEach(function (el, i) {
      el.hidden = i !== index;
    });
    updateProgress();
  }

  function initQuestion(qEl) {
    var options = Array.prototype.slice.call(qEl.querySelectorAll(".q-option"));
    var checkBtn = qEl.querySelector("[data-action='check']");
    var revealBtn = qEl.querySelector("[data-action='reveal']");
    var nextBtn = qEl.querySelector("[data-action='next']");
    var resultPanel = qEl.querySelector("[data-result]");
    var correctIndex = parseInt(qEl.getAttribute("data-correct-index"), 10);
    var selectedIndex = null;
    var answered = false;

    function selectOption(idx) {
      if (answered) return;
      selectedIndex = idx;
      options.forEach(function (opt, i) {
        opt.setAttribute("aria-pressed", i === idx ? "true" : "false");
      });
      if (checkBtn) checkBtn.disabled = false;
    }

    options.forEach(function (opt, i) {
      opt.addEventListener("click", function () {
        selectOption(i);
      });
    });

    function lockOptions(showCorrectness) {
      options.forEach(function (opt, i) {
        opt.disabled = true;
        if (showCorrectness) {
          if (i === correctIndex) opt.classList.add("is-correct");
          else if (i === selectedIndex) opt.classList.add("is-incorrect");
        }
      });
    }

    function renderResult(outcome) {
      if (!resultPanel) return;
      resultPanel.hidden = false;
      resultPanel.setAttribute("data-outcome", outcome);
      var statusEl = resultPanel.querySelector("[data-result-status]");
      var yourAnswerRow = resultPanel.querySelector("[data-your-answer-row]");
      var yourAnswerText = resultPanel.querySelector("[data-your-answer-text]");

      if (statusEl) {
        statusEl.textContent = outcome === "correct" ? "✓ Correct" : "✕ Not quite";
      }
      if (outcome === "incorrect" && yourAnswerRow && yourAnswerText && selectedIndex !== null) {
        yourAnswerRow.hidden = false;
        yourAnswerText.textContent = options[selectedIndex].querySelector(".q-option__text").textContent.trim();
      } else if (yourAnswerRow) {
        yourAnswerRow.hidden = true;
      }
      if (checkBtn) checkBtn.hidden = true;
      if (revealBtn) revealBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = false;
      resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (checkBtn) {
      checkBtn.addEventListener("click", function () {
        if (answered || selectedIndex === null) return;
        answered = true;
        var isCorrect = selectedIndex === correctIndex;
        lockOptions(true);
        renderResult(isCorrect ? "correct" : "incorrect");
        results[current] = {
          correct: isCorrect,
          selectedText: options[selectedIndex].querySelector(".q-option__text").textContent.trim(),
        };
      });
    }

    if (revealBtn) {
      revealBtn.addEventListener("click", function () {
        if (answered) return;
        answered = true;
        lockOptions(true);
        renderResult("revealed");
        if (resultPanel) {
          var statusEl = resultPanel.querySelector("[data-result-status]");
          if (statusEl) statusEl.textContent = "Answer revealed";
          resultPanel.setAttribute("data-outcome", "incorrect");
          var yourAnswerRow = resultPanel.querySelector("[data-your-answer-row]");
          if (yourAnswerRow) yourAnswerRow.hidden = true;
        }
        results[current] = { correct: false, selectedText: null, revealed: true };
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goNext();
      });
    }
  }

  questionEls.forEach(initQuestion);

  function goNext() {
    if (current < total - 1) {
      current += 1;
      showQuestion(current);
    } else {
      finishChallenge();
    }
  }

  function finishChallenge() {
    var correctCount = results.filter(function (r) { return r && r.correct; }).length;
    var incorrectCount = results.filter(function (r) { return r && !r.correct; }).length;

    if (quizWrap) quizWrap.hidden = true;
    if (completePanel) {
      completePanel.hidden = false;
      var scoreEl = completePanel.querySelector("[data-score]");
      var correctEl = completePanel.querySelector("[data-correct-count]");
      var incorrectEl = completePanel.querySelector("[data-incorrect-count]");
      if (scoreEl) scoreEl.textContent = correctCount + " / " + total;
      if (correctEl) correctEl.textContent = String(correctCount);
      if (incorrectEl) incorrectEl.textContent = String(incorrectCount);

      var reviewList = completePanel.querySelector("[data-review-list]");
      if (reviewList) {
        reviewList.innerHTML = "";
        questionEls.forEach(function (qEl, i) {
          var qText = qEl.querySelector(".q-card__text").textContent.trim();
          var correctIndex = parseInt(qEl.getAttribute("data-correct-index"), 10);
          var correctText = qEl.querySelectorAll(".q-option")[correctIndex]
            .querySelector(".q-option__text").textContent.trim();
          var explanation = qEl.querySelector("[data-explanation]");
          var explanationHTML = explanation ? explanation.innerHTML : "";
          var r = results[i];
          var outcome = r && r.correct ? "correct" : "incorrect";

          var item = document.createElement("div");
          item.className = "review-item";
          item.setAttribute("data-outcome", outcome);

          var badge = document.createElement("span");
          badge.className = "review-item__badge";
          badge.textContent = r ? (r.revealed ? "Revealed" : (r.correct ? "Correct" : "Incorrect")) : "Skipped";
          item.appendChild(badge);

          var qP = document.createElement("p");
          qP.className = "review-item__q";
          qP.textContent = "Q" + (i + 1) + ". " + qText;
          item.appendChild(qP);

          var ansBlock = document.createElement("div");
          ansBlock.className = "q-answer-block";
          ansBlock.innerHTML =
            '<p class="q-answer-block__label">Correct Answer</p><p class="q-answer-block__value">' +
            correctText + "</p>";
          item.appendChild(ansBlock);

          var expP = document.createElement("p");
          expP.className = "q-explanation";
          expP.innerHTML = explanationHTML;
          item.appendChild(expP);

          reviewList.appendChild(item);
        });
      }
      completePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    var reviewBtn = document.querySelector("[data-action='show-review']");
    var reviewSection = document.querySelector("[data-review-section]");
    if (reviewBtn && reviewSection) {
      reviewBtn.addEventListener("click", function () {
        reviewSection.hidden = !reviewSection.hidden;
        reviewBtn.textContent = reviewSection.hidden ? "Review Answers" : "Hide Review";
      });
    }

    var retryBtn = document.querySelector("[data-action='retry']");
    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        window.location.reload();
      });
    }
  }

  showQuestion(0);
})();
