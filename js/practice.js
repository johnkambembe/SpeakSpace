const selected = JSON.parse(
  localStorage.getItem("selectedTopic") || "null"
);

const topicText = document.getElementById("topicText");
const categoryText = document.getElementById("categoryText");

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const result = document.getElementById("result");

const aiFeedbackToggle = document.getElementById("aiFeedbackToggle");
const aiFeedbackStatus = document.getElementById("aiFeedbackStatus");
const aiFeedbackOption = document.querySelector(".ai-feedback-option");

let recorder;
let stream;
let chunks = [];

let timerId;
let remaining = selected?.duration || 120;
let recordingStartedAt;
let currentFeedback = null;
let savedRecordingId = null;


// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

if (selected) {
  topicText.textContent = `“${selected.topic}”`;

  categoryText.textContent =
    `${selected.category.toUpperCase()} / SPEAKING SESSION`;

  timerEl.textContent = formatTime(remaining);

} else {
  topicText.textContent = "No topic selected";

  startBtn.disabled = true;

  statusEl.textContent =
    "Return to topics to choose a prompt.";
}


// --------------------------------------------------
// TIMER
// --------------------------------------------------

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}


function startTimer() {
  timerEl.textContent = formatTime(remaining);

  timerId = setInterval(() => {
    remaining -= 1;

    timerEl.textContent = formatTime(remaining);

    if (remaining <= 0) {
      stopRecording(true);
    }

  }, 1000);
}


// --------------------------------------------------
// RECORDING
// --------------------------------------------------

async function startRecording() {

  try {

    stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const supportedMimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus"
    ];
    const mimeType = supportedMimeTypes.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    chunks = [];

    recordingStartedAt = Date.now();

    recorder.addEventListener("dataavailable", (event) => {

      if (event.data.size) {
        chunks.push(event.data);
      }

    });

    recorder.addEventListener(
      "stop",
      finishRecording,
      { once: true }
    );

    recorder.start();

    document.body.classList.add("recording");

    statusEl.textContent = "Recording in progress";

    startBtn.disabled = true;
    stopBtn.disabled = false;
    aiFeedbackOption.classList.add("is-hidden");

    startTimer();

  } catch (error) {

    statusEl.textContent =
      error.name === "NotAllowedError"
        ? "Microphone access was denied."
        : "Microphone unavailable. Try again.";

  }

}


function stopRecording(fromTimer = false) {

  clearInterval(timerId);

  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  if (!fromTimer) {
    statusEl.textContent = "Finishing your recording...";
  }

  stopBtn.disabled = true;

}


// --------------------------------------------------
// FINISH RECORDING
// --------------------------------------------------

function finishRecording() {

  document.body.classList.remove("recording");

  const blob = new Blob(chunks, {
    type: recorder.mimeType
  });

  if (!blob.size) {
    statusEl.textContent = "No audio was captured. Please try recording again.";
    startBtn.disabled = false;
    stopBtn.disabled = true;
    return;
  }

  const audioUrl = URL.createObjectURL(blob);

  const elapsed = Math.max(
    1,
    Math.round((Date.now() - recordingStartedAt) / 1000)
  );

  statusEl.textContent = "Session complete";

  result.classList.remove("is-hidden");

  result.innerHTML = `
    <h2>Good work.</h2>

    <p class="history-meta">
      Your recording · ${formatTime(elapsed)}
    </p>

    <audio id="recordingPlayer" controls></audio>

    <div class="result-actions">

      <button
        class="button-primary"
        id="saveBtn"
      >
        Save to history
      </button>

      <button
        class="secondary-button"
        id="retryBtn"
      >
        Try again
      </button>

    </div>

    <p id="saveMessage" class="saved-message"></p>

    <div id="feedbackContainer"></div>
  `;

  const recordingPlayer = result.querySelector("#recordingPlayer");
  recordingPlayer.src = audioUrl;
  recordingPlayer.load();
  recordingPlayer.addEventListener("error", () => {
    statusEl.textContent = "Recording created, but this browser cannot play its audio format.";
  }, { once: true });

  result.querySelector("#saveBtn").addEventListener(
    "click",
    () => saveRecording(blob, elapsed)
  );

  result.querySelector("#retryBtn").addEventListener(
    "click",
    resetSession
  );

  result.scrollIntoView({
    behavior: "smooth"
  });


  // AI OFF → nothing else happens

  if (!aiFeedbackToggle.checked) {
    return;
  }


  // AI ON → analyze the audio

  analyzeAudio(blob);

}


// --------------------------------------------------
// SEND AUDIO TO GEMINI BACKEND
// --------------------------------------------------

async function analyzeAudio(blob) {

  const feedbackContainer =
    document.getElementById("feedbackContainer");

  aiFeedbackStatus.classList.remove("is-hidden");

  aiFeedbackStatus.textContent =
    "Analyzing your speaking...";

  feedbackContainer.innerHTML = `
    <div class="ai-loading">
      <p>Listening to your recording...</p>
      <p class="history-meta">
        Your feedback will appear here in a moment.
      </p>
    </div>
  `;

  try {

    const audioBase64 = await blobToBase64(blob);

    const response = await fetch("/api/analyze-audio", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        audioBase64,

        mimeType: blob.type,

        topic: selected.topic,

        category: selected.category

      })

    });


    const data = await response.json();


    if (!response.ok) {
      throw new Error(
        data.error || "Unable to analyze your recording."
      );
    }


    aiFeedbackStatus.textContent =
      "Your feedback is ready.";

    currentFeedback = data.feedback;
    renderFeedback(data.feedback);

    if (savedRecordingId !== null) {
      updateSavedFeedback(savedRecordingId, currentFeedback);
    }

  } catch (error) {

    console.error(error);

    aiFeedbackStatus.textContent =
      "Feedback unavailable.";

    feedbackContainer.innerHTML = `
      <div class="ai-error">
        <p>
          We couldn't analyze this recording right now.
        </p>

        <p class="history-meta">
          You can still listen to it and save it to your history.
        </p>
      </div>
    `;

  }

}


// --------------------------------------------------
// BLOB → BASE64
// --------------------------------------------------

function blobToBase64(blob) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onloadend = () => {

      const base64String = reader.result.split(",")[1];

      resolve(base64String);

    };

    reader.onerror = reject;

    reader.readAsDataURL(blob);

  });

}


// --------------------------------------------------
// DISPLAY FEEDBACK
// --------------------------------------------------

function renderFeedback(feedback) {

  const feedbackContainer =
    document.getElementById("feedbackContainer");

  const repeatedWords = feedback.repeatedWords || [];
  const corrections = feedback.corrections || [];
  const suggestions = feedback.suggestions || [];


  const repeatedWordsHTML = repeatedWords.length

    ? repeatedWords.map((item) => `
        <span class="feedback-tag">
          ${escapeHTML(item.word)} ×${item.count}
        </span>
      `).join("")

    : `<p class="history-meta">No noticeable repeated words.</p>`;


  const correctionsHTML = corrections.length

    ? corrections.map((item) => `
        <div class="correction-item">

          <p class="correction-original">
            ${escapeHTML(item.original)}
          </p>

          <p class="correction-better">
            → ${escapeHTML(item.better)}
          </p>

          <p class="history-meta">
            ${escapeHTML(item.explanation || "")}
          </p>

        </div>
      `).join("")

    : `<p class="history-meta">No corrections to highlight.</p>`;


  const suggestionsHTML = suggestions.length

    ? suggestions.map((item) => `
        <li>${escapeHTML(item)}</li>
      `).join("")

    : `<li>Keep speaking and experimenting with English.</li>`;


  feedbackContainer.innerHTML = `

    <section class="ai-feedback-card">

      <div class="ai-feedback-heading">
        <p class="eyebrow">AI FEEDBACK</p>
        <h2>A little reflection.</h2>
      </div>


      <div class="feedback-section">

        <h3>Your transcription</h3>

        <p class="transcript">
          ${escapeHTML(feedback.transcript || "No transcription available.")}
        </p>

      </div>


      <div class="feedback-section">

        <h3>Words you repeated</h3>

        <div class="feedback-tags">
          ${repeatedWordsHTML}
        </div>

      </div>


      <div class="feedback-section">

        <h3>A few corrections</h3>

        ${correctionsHTML}

      </div>


      <div class="feedback-section">

        <h3>One thing to try next time</h3>

        <ul class="feedback-suggestions">
          ${suggestionsHTML}
        </ul>

      </div>


      <div class="feedback-encouragement">

        ${escapeHTML(
          feedback.encouragement ||
          "Keep going. Every session is practice."
        )}

      </div>

    </section>

  `;

}


function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// --------------------------------------------------
// RESET SESSION
// --------------------------------------------------

function resetSession() {

  remaining = selected.duration;

  timerEl.textContent = formatTime(remaining);

  statusEl.textContent = "Ready when you are";

  result.classList.add("is-hidden");

  aiFeedbackStatus.classList.add("is-hidden");

  startBtn.disabled = false;

  stopBtn.disabled = true;
  currentFeedback = null;
  savedRecordingId = null;
  aiFeedbackOption.classList.remove("is-hidden");

}


// --------------------------------------------------
// SAVE TO INDEXEDDB
// --------------------------------------------------

async function saveRecording(blob, elapsed) {

  const saveButton = document.getElementById("saveBtn");
  const saveMessage = document.getElementById("saveMessage");
  saveButton.disabled = true;
  saveMessage.textContent = "Saving your recording...";

  let audioData;

  try {
    audioData = await blob.arrayBuffer();
  } catch (error) {
    saveButton.disabled = false;
    saveMessage.textContent = "This recording could not be read.";
    return;
  }

  const request = indexedDB.open("SpeaklyDB", 1);

  request.onupgradeneeded = () => {

    request.result.createObjectStore(
      "recordings",
      {
        keyPath: "id",
        autoIncrement: true
      }
    );

  };


  request.onsuccess = () => {

    const database = request.result;

    const transaction = database.transaction(
      "recordings",
      "readwrite"
    );

    const addRequest = transaction.objectStore("recordings").add({
      topic: selected.topic,
      category: selected.category,
      duration: elapsed,
      date: new Date().toISOString(),
      audioData,
      mimeType: blob.type || "audio/webm",
      feedback: currentFeedback
    });


    transaction.oncomplete = () => {

      savedRecordingId = addRequest.result;

      saveMessage.textContent =
        "Saved in your history.";

    };

    transaction.onerror = () => {
      saveButton.disabled = false;
      saveMessage.textContent =
        "This recording could not be saved in your browser.";
    };

  };

  request.onerror = () => {
    saveButton.disabled = false;
    saveMessage.textContent =
      "This recording could not be saved in your browser.";

  };

}

function updateSavedFeedback(recordingId, feedback) {
  const request = indexedDB.open("SpeaklyDB", 1);

  request.onsuccess = () => {
    const database = request.result;
    const transaction = database.transaction("recordings", "readwrite");
    const store = transaction.objectStore("recordings");
    const getRequest = store.get(recordingId);

    getRequest.onsuccess = () => {
      if (getRequest.result) {
        store.put({ ...getRequest.result, feedback });
      }
    };
  };
}


// --------------------------------------------------
// BUTTON EVENTS
// --------------------------------------------------

startBtn.addEventListener(
  "click",
  startRecording
);

stopBtn.addEventListener(
  "click",
  () => stopRecording()
);