const selected = JSON.parse(localStorage.getItem("selectedTopic") || "null");
const topicText = document.getElementById("topicText"); 
const categoryText = document.getElementById("categoryText");
const timerEl = document.getElementById("timer"); 
const statusEl = document.getElementById("status"); 
const startBtn = document.getElementById("startBtn"); 
const stopBtn = document.getElementById("stopBtn"); 
const result = document.getElementById("result");
let recorder; 
let stream; 
let chunks = []; 
let timerId; 
let remaining = selected?.duration || 120; 
let recordingStartedAt;
if (selected) { 
	topicText.textContent = `“${selected.topic}”`; 
	categoryText.textContent = `${selected.category.toUpperCase()} / SPEAKING SESSION`; timerEl.textContent = formatTime(remaining);
	
} else { 

	topicText.textContent = "No topic selected"; startBtn.disabled = true; 
	statusEl.textContent = "Return to topics to choose a prompt."; 
}

function formatTime(seconds) { 
	return `${String(Math.floor(seconds / 60))
	.padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
 }

function startTimer() { 
	timerEl.textContent = formatTime(remaining);
	timerId = setInterval(() => { 

		remaining -= 1; timerEl.textContent = formatTime(remaining);

		if (remaining <= 0) stopRecording(true);
	 }, 1000); }

async function startRecording() {
	try { 
		stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
		const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"; 
		recorder = new MediaRecorder(stream, { mimeType }); 
		chunks = []; recordingStartedAt = Date.now(); 

		recorder.addEventListener("dataavailable", (event) => { 

			if (event.data.size) chunks.push(event.data); }); 
				recorder.addEventListener("stop", finishRecording, { once: true }); 
				recorder.start(); 
				
				document.body.classList.add("recording"); 
				statusEl.textContent = "Recording in progress"; 
				startBtn.disabled = true; 
				stopBtn.disabled = false; startTimer(); 

			} catch (error) { 
				
				statusEl.textContent = error.name === "NotAllowedError" ? "Microphone access was denied." : "Microphone unavailable. Try again.";
			 }
}

function stopRecording(fromTimer = false) { 
	clearInterval(timerId); 
	if (recorder && recorder.state !== "inactive") 
	recorder.stop(); 
	if (stream) stream.getTracks().forEach((track) => track.stop());
	if (!fromTimer) statusEl.textContent = "Finishing your recording..."; 
	stopBtn.disabled = true; 
}

function finishRecording() { 
	document.body.classList.remove("recording"); 
	const blob = new Blob(chunks, { type: recorder.mimeType }); 
	const audioUrl = URL.createObjectURL(blob); 
	const elapsed = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000)); 
	statusEl.textContent = "Session complete"; 
	result.classList.remove("is-hidden"); 

	result.innerHTML = `<h2>Good work.</h2>
	<p class="history-meta">Your recording · ${formatTime(elapsed)}</p>
	<audio controls src="${audioUrl}"></audio>
	<div class="result-actions">
		<button class="button-primary" id="saveBtn">Save to history</button>
		<button class="secondary-button" id="retryBtn">Try again</button>
	</div><p id="saveMessage" class="saved-message">
	</p>`; 
	
	result.querySelector("#saveBtn").addEventListener("click", () => saveRecording(blob, elapsed)); 
	result.querySelector("#retryBtn").addEventListener("click", resetSession); 
	result.scrollIntoView({ behavior: "smooth" }); 
}

function resetSession() { 

	remaining = selected.duration; 
	timerEl.textContent = formatTime(remaining); 
	statusEl.textContent = "Ready when you are"; 
	result.classList.add("is-hidden"); 
	startBtn.disabled = false; 
}
function saveRecording(blob, elapsed) { 
	const request = indexedDB.open("SpeaklyDB", 1); 
	request.onupgradeneeded = () => 
	request.result.createObjectStore("recordings", { keyPath: "id", autoIncrement: true }); 
	request.onsuccess = () => { 

		const database = request.result; 
		const transaction = database.transaction("recordings", "readwrite"); 
		transaction.objectStore("recordings").add({ topic: selected.topic, category: selected.category, duration: elapsed, date: new Date().toISOString(), audio: blob });

		transaction.oncomplete = () => { 
			document.getElementById("saveMessage").textContent = "Saved in your history."; 
			document.getElementById("saveBtn").disabled = true; }; }; 
		}

startBtn.addEventListener("click", startRecording); 
stopBtn.addEventListener("click", () => stopRecording());