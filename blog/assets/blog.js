/**
 * FC Mobile Tools — Blog behaviour
 * One shared file for every article. Content lives in the HTML;
 * this only enhances it. If this file fails to load, the article
 * still reads fine — nothing here is required for basic content.
 */

document.addEventListener("DOMContentLoaded", () => {
  buildTableOfContents();
  initReadingProgress();
});

// Reads the article's own <h2> elements and builds a TOC from them.
// No article has to hand-maintain a contents list — it's derived,
// same principle as the trivia pages deriving question count from the DOM.
function buildTableOfContents() {
  const body = document.querySelector(".article-body");
  const tocMount = document.querySelector("[data-toc]");
  if (!body || !tocMount) return;

  const headings = body.querySelectorAll("h2");
  if (headings.length < 2) {
    tocMount.remove();
    return;
  }

  const list = document.createElement("ol");
  headings.forEach((h, i) => {
    if (!h.id) h.id = `section-${i + 1}`;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });

  const label = document.createElement("div");
  label.className = "article-toc__label";
  label.textContent = "In this article";

  tocMount.innerHTML = "";
  tocMount.appendChild(label);
  tocMount.appendChild(list);
}

function initReadingProgress() {
  const bar = document.querySelector(".reading-progress");
  const article = document.querySelector(".article-body");
  if (!bar || !article) return;

  const update = () => {
    const rect = article.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    const pct = total > 0 ? (scrolled / total) * 100 : 0;
    bar.style.width = `${pct}%`;
  };

  document.addEventListener("scroll", update, { passive: true });
  update();
}
