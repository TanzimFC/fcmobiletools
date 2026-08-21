(function () {

  "use strict";


  window.initQuiz = function (country, level) {

    const app = document.getElementById("quiz-app");

    if (!app) return;


    const countryData = window.TRIVIA_DATA?.[country];

    if (!countryData) {

      app.innerHTML = `
        <div class="error-box">
          <h2>Quiz unavailable</h2>
          <p>We couldn't find this country.</p>
        </div>
      `;

      return;
    }


    const levelData = countryData[level];

    if (!levelData) {

      app.innerHTML = `
        <div class="error-box">
          <h2>Level unavailable</h2>
          <p>We couldn't find this difficulty level.</p>
        </div>
      `;

      return;
    }


    let currentChallenge = 0;
    let currentQuestion = 0;

    let score = 0;
    let answered = false;

    render();


    function render() {

      const challenge =
        levelData.challenges[currentChallenge];

      const question =
        challenge.questions[currentQuestion];

      const totalQuestions =
        challenge.questions.length;

      const currentNumber =
        currentQuestion + 1;


      const challengeProgress =
        `${currentNumber} of ${totalQuestions}`;


      app.innerHTML = `

        <section class="quiz-shell">

          <div class="quiz-top">

            <div>

              <span class="quiz-kicker">
                Challenge ${roman(challenge.id)}
              </span>

              <h2>
                Question ${currentNumber}
                <span>of ${totalQuestions}</span>
              </h2>

            </div>

            <div class="score-mini">
              ${score} correct
            </div>

          </div>


          <div class="progress-track">

            <div
              class="progress-fill"
              style="
                width:
                ${(currentNumber / totalQuestions) * 100}%
              "
            ></div>

          </div>


          <article class="interactive-question">

            <div class="question-counter">
              Question ${challengeProgress}
            </div>

            <h3>
              ${escapeHTML(question.question)}
            </h3>


            <div class="answer-options">

              ${question.options.map((option, index) => `

                <button
                  class="answer-option"
                  data-index="${index}"
                >

                  <span class="option-letter">
                    ${String.fromCharCode(65 + index)}
                  </span>

                  <span>
                    ${escapeHTML(option)}
                  </span>

                </button>

              `).join("")}

            </div>


            <div
              class="answer-result"
              id="answer-result"
            ></div>

          </article>


          <div class="quiz-actions">

            <a
              href="/trivia/${country}/"
              class="secondary-button"
            >
              Exit
            </a>

            <button
              class="primary-button hidden"
              id="next-button"
            >
              Next →
            </button>

          </div>

        </section>

      `;


      app
        .querySelectorAll(".answer-option")
        .forEach(button => {

          button.addEventListener(
            "click",
            () => {

              selectAnswer(
                Number(button.dataset.index),
                question
              );

            }
          );

        });


      const nextButton =
        document.getElementById("next-button");

      if (nextButton) {

        nextButton.addEventListener(
          "click",
          nextQuestion
        );

      }

    }


    function selectAnswer(selectedIndex, question) {

      if (answered) return;

      answered = true;


      const buttons =
        app.querySelectorAll(".answer-option");


      const result =
        document.getElementById("answer-result");


      const correct =
        selectedIndex === question.answer;


      if (correct) {
        score++;
      }


      buttons.forEach((button, index) => {

        button.disabled = true;


        if (index === question.answer) {

          button.classList.add("correct");

        }

        if (
          index === selectedIndex &&
          !correct
        ) {

          button.classList.add("incorrect");

        }

      });


      result.className =
        `answer-result ${correct ? "success" : "failure"}`;


      result.innerHTML = `

        <div class="result-head">

          <strong>
            ${correct ? "✓ Correct" : "✕ Incorrect"}
          </strong>

          <span>
            Correct answer:
            <b>
              ${escapeHTML(
                question.options[question.answer]
              )}
            </b>
          </span>

        </div>

        <p>
          ${escapeHTML(question.explanation)}
        </p>

      `;


      const next =
        document.getElementById("next-button");

      if (next) {

        next.classList.remove("hidden");

      }

    }


    function nextQuestion() {

      const challenge =
        levelData.challenges[currentChallenge];


      if (
        currentQuestion <
        challenge.questions.length - 1
      ) {

        currentQuestion++;
        answered = false;

        render();

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

        return;
      }


      if (
        currentChallenge <
        levelData.challenges.length - 1
      ) {

        currentChallenge++;
        currentQuestion = 0;
        answered = false;

        render();

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

        return;
      }


      renderResult();

    }


    function renderResult() {

      const allQuestions =
        levelData.challenges.reduce(
          (total, challenge) =>
            total + challenge.questions.length,
          0
        );


      const required =
        levelData.required.at(-1);


      const passed =
        score >= required;


      app.innerHTML = `

        <section class="result-screen">

          <span class="section-label">
            ${countryData.name} · ${capitalise(level)}
          </span>

          <h2>
            ${passed ? "Challenge complete." : "Practice complete."}
          </h2>

          <div class="big-score">
            ${score}
            <span>/ ${allQuestions}</span>
          </div>

          <p>
            You answered
            <strong>${score}</strong>
            of
            <strong>${allQuestions}</strong>
            questions correctly.
          </p>


          <div class="result-actions">

            <button
              class="primary-button"
              id="restart-button"
            >
              Try Again
            </button>

            <a
              class="secondary-button"
              href="/trivia/${country}/"
            >
              Back to Mexico
            </a>

          </div>


          <div class="review-box">

            <h3>
              Review the answers
            </h3>

            <p>
              The correct answers and explanations are shown
              after each question while practising, so you can
              immediately check what you got right or wrong.
            </p>

          </div>

        </section>

      `;


      document
        .getElementById("restart-button")
        ?.addEventListener(
          "click",
          () => {

            currentChallenge = 0;
            currentQuestion = 0;
            score = 0;
            answered = false;

            render();

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });

          }
        );

    }

  };


  function roman(number) {

    const values = [
      "I",
      "II",
      "III",
      "IV",
      "V"
    ];

    return values[number - 1] || number;

  }


  function capitalise(value) {

    return value.charAt(0).toUpperCase()
      + value.slice(1);

  }


  function escapeHTML(value) {

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }

})();
