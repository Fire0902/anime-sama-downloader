const input = document.getElementById("live-input");

let debounceTimer;

input.addEventListener("input", (e) => {
  const value = e.target.value;

  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    try {
      const response = await fetch("http://localhost:3000/input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          value,
          lastChar: value.slice(-1) || null,
        })
      });

      const animesTitle = (await response.json()).animesTitle;
      const animesContainer = document.getElementById("anime-container");

      animesContainer.innerHTML = "";

      for (const [animeName, url] of Object.entries(animesTitle)) {
        const anime = document.createElement("div");
        anime.textContent = animeName;
        animesContainer.appendChild(anime);
      }
    } catch (err) {
      console.error("error: ", err);
    }
  }, 300);
});
