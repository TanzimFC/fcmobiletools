function goToTriviaLevel(country, level) {
    window.location.assign(`/trivia/${country}/${level}/`);
}

function getCountryFromPath() {
    const parts = window.location.pathname
        .split("/")
        .filter(Boolean);

    const triviaIndex = parts.indexOf("trivia");

    if (triviaIndex === -1) return null;

    return parts[triviaIndex + 1] || null;
}

function getLevelFromPath() {
    const parts = window.location.pathname
        .split("/")
        .filter(Boolean);

    const triviaIndex = parts.indexOf("trivia");

    if (triviaIndex === -1) return null;

    return parts[triviaIndex + 2] || null;
}
