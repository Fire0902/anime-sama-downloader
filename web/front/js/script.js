const input = document.getElementById("live-input");

let debounceTimer;
let selectedAnime = {}; // look like that {"One Piece": "https://anime-sama.eu/catalogue/one-piece/"}
let selectedSeason = {}; // look like that {"Saga 1 (East Blue)": "https://anime-sama.eu/catalogue/one-piece/saison1/vostfr"}

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
            const animesContainer = document.getElementById("animes-container");
            const seasonsContainer = document.getElementById("seasons-container");

            animesContainer.innerHTML = "";

            for (const [animeName, url] of Object.entries(animesTitle)) {
                const anime = document.createElement("div");
                anime.addEventListener("click", async () => {
                    selectedAnime[animeName] = url;
                    animesContainer.innerHTML = "";
                    input.value = animeName;
                    const response = await fetch("http://localhost:3000/seasons", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            animeUrl: url
                        })
                    });
                    const animeSeasons = (await response.json()).animeSeasons;
                    for(const season of animeSeasons){
                        season.link = url + season.link;
                        const seasonDiv = document.createElement("div");
                        seasonDiv.textContent = season.name
                        seasonDiv.classList.add("season");
                        seasonDiv.addEventListener("click", () => {
                            selectedSeason[season.name] = season.link;
                            
                        })
                        seasonsContainer.appendChild(seasonDiv);
                    }
                });
                anime.classList.add("anime");
                anime.textContent = animeName;
                animesContainer.appendChild(anime);
            }
        } catch (err) {
            console.error("error: ", err);
        }
    }, 300);
});
