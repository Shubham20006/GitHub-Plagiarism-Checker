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
const loadingStatus = document.getElementById("loading-status");

addPeerBtn.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "peer-url-row";

    row.innerHTML = `
        <div class="input-wrapper">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
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

    const gitUrls = [primaryUrl, ...peers];

    try {
        loadingStatus.textContent = "Submitting repositories...";

        const response = await fetch("https://bl-assginiq-automation-187791816934.asia-south1.run.app/api/v1/plag-check/check-plagiarism", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                git_urls: gitUrls,
                use_gemini: useGemini
            })
        });

        if (!response.ok) throw new Error();

        const data = await response.json();
        const taskId = data?.task_id;

        if (!taskId) throw new Error();

        await pollJobStatus(taskId);

    } catch {
        showError("Failed to analyze repositories.");
    }
});

retryBtn.addEventListener("click", () => {
    errorState.classList.add("hidden");
});

async function pollJobStatus(taskId) {
    const statusUrl = `https://bl-assginiq-automation-187791816934.asia-south1.run.app/api/v1/plag-check/job-status/${taskId}`;

    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
        try {
            attempts++;

            const res = await fetch(statusUrl);
            const data = await res.json();
            const status = data?.payload?.status || data?.status;

            loadingStatus.textContent = `Status: ${status} (${attempts})`;

            if (status === "SUCCESS") {
                clearInterval(interval);
                loadingStatus.textContent = "Finalizing results...";
                await fetchFinalResult(taskId);
            }

            if (status === "FAILURE") {
                clearInterval(interval);
                showError("Analysis failed.");
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                showError("Analysis timed out.");
            }

        } catch {
            clearInterval(interval);
            showError("Polling failed.");
        }
    }, 2000);
}

async function fetchFinalResult(taskId) {
    try {
        const resultUrl = `https://bl-assginiq-automation-187791816934.asia-south1.run.app/api/v1/plag-check/task-result/${taskId}`;

        const res = await fetch(resultUrl);
        const data = await res.json();

        const results = data?.payload?.result?.result;

        if (!results || !Array.isArray(results)) throw new Error();

        renderResults(results);

    } catch {
        showError("Failed to fetch results.");
    } finally {
        loadingState.classList.add("hidden");
        submitBtn.classList.remove("loading");
    }
}

function showError(message) {
    loadingState.classList.add("hidden");
    submitBtn.classList.remove("loading");
    errorMessage.textContent = message;
    errorState.classList.remove("hidden");
}

function renderResults(results) {
    resultsSection.innerHTML = "";

    const uniquePairs = new Map();

    results.forEach((result) => {
        result.comparisons.forEach((comp) => {
            const pairKey = [result.student, comp.other_student].sort().join("-");

            if (!uniquePairs.has(pairKey)) {
                uniquePairs.set(pairKey, {
                    student1: result.student,
                    student2: comp.other_student,
                    textual: comp.textual_similarity,
                    semantic: comp.semantic_similarity,
                    cosine: comp.cosine_similarity,
                    confidence: comp.confidence,
                    plagiarism: comp.is_plagiarism
                });
            }
        });
    });

    const pairs = Array.from(uniquePairs.values());
    const totalPairs = pairs.length;
    const flagged = pairs.filter(p => p.plagiarism === true).length;
    const clean = totalPairs - flagged;

    const summary = document.createElement("div");
    summary.className = "report-summary";

    summary.innerHTML = `
        <h2 class="section-title" style="text-align:center;margin-bottom:15px;">Plagiarism Report</h2>
        <p style="color:#aaa; font-size:14px; margin-bottom:10px;">
            This report shows similarity analysis between student repositories.
            Each row represents a comparison between two students.
        </p>
        <p style="margin-bottom:15px;">
            <strong>Total:</strong> ${totalPairs} &nbsp; | &nbsp;
            <strong>Clean:</strong> ${clean} &nbsp; | &nbsp;
            <strong>Plagiarism:</strong> ${flagged}
        </p>
    `;

    resultsSection.appendChild(summary);

    const table = document.createElement("table");
    table.className = "result-table";

    table.innerHTML = `
        <thead>
            <tr>
                <th>Student 1</th>
                <th>Student 2</th>
                <th>Textual %</th>
                <th>Semantic %</th>
                <th>Cosine %</th>
                <th>Confidence %</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${pairs.map(pair => {
        const statusClass = pair.plagiarism ? "flag-red" : "flag-green";
        const statusText = pair.plagiarism ? "Plagiarism" : "Clean";

        return `
                    <tr>
                        <td>${pair.student1}</td>
                        <td>${pair.student2}</td>
                        <td>${(pair.textual * 100).toFixed(1)}%</td>
                        <td>${(pair.semantic * 100).toFixed(1)}%</td>
                        <td>${(pair.cosine * 100).toFixed(1)}%</td>
                        <td>${(pair.confidence * 100).toFixed(1)}%</td>
                        <td>
                            <span class="plag-flag ${statusClass}">
                                ${statusText}
                            </span>
                        </td>
                    </tr>
                `;
    }).join("")}
        </tbody>
    `;
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "table-wrapper";
    tableWrapper.appendChild(table);
    resultsSection.appendChild(tableWrapper);
    resultsSection.classList.remove("hidden");
}

const themeToggle = document.getElementById("theme-toggle");

// Load saved theme
if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-theme");
    themeToggle.textContent = "☀️";
}

// Toggle theme
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");

    const isLight = document.body.classList.contains("light-theme");

    themeToggle.textContent = isLight ? "☀️" : "🌙";

    localStorage.setItem("theme", isLight ? "light" : "dark");
});