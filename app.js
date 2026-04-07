const form = document.getElementById("plagiarism-form");
const addPeerBtn = document.getElementById("add-peer-btn");
const peerContainer = document.getElementById("peer-urls-container");
const loadingState = document.getElementById("loading-state");
const resultsSection = document.getElementById("results-section");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const submitBtn = document.getElementById("submit-btn");
const retryBtn = document.getElementById("retry-btn");
const geminiToggle = document.getElementById("use-gemini-toggle");

addPeerBtn.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "peer-url-row";

    row.innerHTML = `
        <div class="input-wrapper">
            <input type="url" class="url-input peer-input" placeholder="https://github.com/peer/repository" required>
        </div>
        <button type="button" class="btn-icon btn-remove-peer">✕</button>
    `;

    row.querySelector(".btn-remove-peer").addEventListener("click", () => {
        row.remove();
    });

    peerContainer.appendChild(row);
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    resultsSection.classList.add("hidden");
    errorState.classList.add("hidden");
    loadingState.classList.remove("hidden");
    submitBtn.classList.add("loading");

    const primaryUrl = document.getElementById("primary-url").value;
    const peerInputs = document.querySelectorAll(".peer-input");
    const peers = Array.from(peerInputs).map(input => input.value);
    const useGemini = geminiToggle.checked;

    const gitUrls = [primaryUrl, ...peers,"https://github.com/utkarsh309/QuantityMeasurementApp"];

    try {
        const response = await fetch("https://api.blaes.bridgelabz.com/api/v1/plag-check/check-plagiarism", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                git_urls: gitUrls,
                use_gemini: useGemini
            })
        });
        console.log(response);

        if (!response.ok) {
            throw new Error("API error");
        }

        const data = await response.json();
        renderResults(data.payload.result);

    } catch (err) {
        errorMessage.textContent = "Failed to analyze repositories.";
        errorState.classList.remove("hidden");
    } finally {
        loadingState.classList.add("hidden");
        submitBtn.classList.remove("loading");
    }
});

retryBtn.addEventListener("click", () => {
    errorState.classList.add("hidden");
});

function renderResults(result) {
    resultsSection.innerHTML = "";

    const header = document.createElement("div");
    header.className = "result-summary";
    header.innerHTML = `
        <div class="summary-card">
            <h2>${result.student}</h2>
            <p>${result.total_compared} Comparisons Analyzed</p>
        </div>
    `;
    resultsSection.appendChild(header);

    result.comparisons.forEach((comp) => {
        const plagiarismClass = comp.is_plagiarism ? "flag-red" : "flag-green";
        const plagiarismText = comp.is_plagiarism ? "Plagiarism Detected" : "Clean";

        const card = document.createElement("div");
        card.className = "result-card enhanced";

        card.innerHTML = `
            <div class="card-header">
                <h3>${comp.other_student}</h3>
                <span class="plag-flag ${plagiarismClass}">
                    ${plagiarismText}
                </span>
            </div>

            <div class="metric">
                <label>Textual Similarity</label>
                <div class="progress-bar">
                    <div class="progress" style="width:${comp.textual_similarity * 100}%"></div>
                </div>
                <span>${(comp.textual_similarity * 100).toFixed(1)}%</span>
            </div>

            <div class="metric">
                <label>Semantic Similarity</label>
                <div class="progress-bar">
                    <div class="progress semantic" style="width:${comp.semantic_similarity * 100}%"></div>
                </div>
                <span>${(comp.semantic_similarity * 100).toFixed(1)}%</span>
            </div>

            <div class="metric">
                <label>Confidence</label>
                <div class="progress-bar">
                    <div class="progress confidence" style="width:${comp.confidence * 100}%"></div>
                </div>
                <span>${(comp.confidence * 100).toFixed(1)}%</span>
            </div>
        `;

        resultsSection.appendChild(card);
    });

    resultsSection.classList.remove("hidden");
}