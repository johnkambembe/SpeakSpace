const historyList = document.getElementById("historyList");

function formatDuration(seconds) { 
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; 
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
            row.innerHTML = `<div>
                <h2>“${item.topic}”</h2>
                <p class="history-meta">${item.category} · ${formatDuration(item.duration)} · ${date}</p>
                </div>
                <div>
                    <audio controls src="${URL.createObjectURL(item.audio)}"></audio><button class="delete-button" aria-label="Delete recording">Delete</button>
                    </div>`; 
            row.querySelector(".delete-button").addEventListener("click", () => deleteRecording(item.id)); 
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