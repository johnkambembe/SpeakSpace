const historyList = document.getElementById("historyList");

function formatDuration(seconds) { 
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; 
}

function getAudioBlob(item) {
    if (item.audioData instanceof ArrayBuffer) {
        return new Blob([item.audioData], { type: item.mimeType || "audio/webm" });
    }

    if (ArrayBuffer.isView(item.audioData)) {
        return new Blob([item.audioData.buffer], { type: item.mimeType || "audio/webm" });
    }

    if (item.audio instanceof Blob) {
        return item.audio;
    }

    return null;
}

function openDatabase() { 
    return new Promise((resolve, reject) => { 
        const request = indexedDB.open("SpeaklyDB", 1); 
        request.onupgradeneeded = () => request.result.createObjectStore("recordings", { keyPath: "id", autoIncrement: true }); 
        request.onsuccess = () => resolve(request.result); 
        request.onerror = () => reject(request.error); 
    }); 
}

async function loadHistory() { 
    
    try { 
        const database = await openDatabase(); 
        const request = database.transaction("recordings", "readonly").objectStore("recordings").getAll(); 
        request.onsuccess = () => renderHistory(request.result.reverse()); 
            request.onerror = () => {
                historyList.innerHTML = '<div class="empty-state">Your recordings could not be loaded.</div>';
            };
    } catch (error) { 
        historyList.innerHTML = '<div class="empty-state">Your browser could not open local history.</div>'; 
    } 
}

function renderHistory(items) { 
    if (!items.length) { 
        historyList.innerHTML = '<div class="empty-state">No recordings yet. Your next great answer starts with a question.</div>'; 
        return; 
    } historyList.replaceChildren(); 
        items.forEach((item) => { 
            const row = document.createElement("article"); 
            row.className = "history-item"; 
            const date = new Date(item.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); 
                const details = document.createElement("div");
                details.innerHTML = `<h2>“${item.topic}”</h2>
                    <p class="history-meta">${item.category} · ${formatDuration(item.duration)} · ${date}</p>`;

                const actions = document.createElement("div");
                const audio = document.createElement("audio");
                audio.controls = true;
                audio.preload = "metadata";
                let audioControl = audio;

                const audioBlob = getAudioBlob(item);

                if (audioBlob) {
                    audio.src = URL.createObjectURL(audioBlob);
                    audio.addEventListener("error", () => {
                        audio.replaceWith(document.createTextNode("Audio format unavailable in this browser"));
                    }, { once: true });
                } else {
                    audioControl = document.createTextNode("Audio unavailable");
                }

                const deleteButton = document.createElement("button");
                deleteButton.className = "delete-button";
                deleteButton.setAttribute("aria-label", "Delete recording");
                deleteButton.textContent = "Delete";

                actions.append(audioControl);

                if (item.feedback) {
                    const feedbackDetails = document.createElement("details");
                    const feedbackSummary = document.createElement("summary");
                    feedbackSummary.textContent = "View feedback";
                    const feedbackText = document.createElement("div");
                    feedbackText.className = "history-feedback";

                    const transcript = document.createElement("p");
                    transcript.textContent = item.feedback.transcript || "No transcription available.";
                    feedbackText.append(transcript);

                    const encouragement = document.createElement("p");
                    encouragement.textContent = item.feedback.encouragement || "Keep going. Every session is practice.";
                    feedbackText.append(encouragement);

                    const suggestions = item.feedback.suggestions || [];
                    if (suggestions.length) {
                        const suggestionsList = document.createElement("ul");
                        suggestions.forEach((suggestion) => {
                            const suggestionItem = document.createElement("li");
                            suggestionItem.textContent = suggestion;
                            suggestionsList.appendChild(suggestionItem);
                        });
                        feedbackText.append(suggestionsList);
                    }

                    feedbackDetails.append(feedbackSummary, feedbackText);
                    actions.append(feedbackDetails);
                }

                actions.append(deleteButton);
                row.append(details, actions);
                deleteButton.addEventListener("click", () => deleteRecording(item.id)); 
            historyList.appendChild(row); 
    }); 
}

function deleteRecording(id) { 
    const request = indexedDB.open("SpeaklyDB", 1); 
    request.onsuccess = () => { 
        const transaction = request.result.transaction("recordings", "readwrite"); 
        transaction.objectStore("recordings").delete(id); 
        transaction.oncomplete = loadHistory; 
    }; 
}

loadHistory();