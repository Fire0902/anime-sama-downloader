const input = document.getElementById("live-input");

input.addEventListener("input", async (e) => {
  const value = e.target.value;

  try {
    const response = await fetch("http://localhost:3000/input", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        value,
        lastChar: value.slice(-1) || null,
        timestamp: Date.now()
      })
    });
    const animesTitle = (await response.json()).animesTitle;
    const animesContainer = document.getElementById("anime-container");
    console.log(animesTitle);
    animesContainer.innerHTML = "";

    for(const [animeName, url] of Object.entries(animesTitle)){
        const anime = document.createElement("div");
        anime.textContent = animeName;
        animesContainer.appendChild(anime);
    }
  } catch (err) {
    console.error("error: ", err);
  }
});
