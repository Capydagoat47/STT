const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const OPENAI_TTS_ENDPOINT = "/.netlify/functions/openai-tts";
const OPENAI_TRANSCRIBE_ENDPOINT = "/.netlify/functions/openai-transcribe";

const listenButton = document.getElementById("listenButton");
const stopListenButton = document.getElementById("stopListenButton");
const speakButton = document.getElementById("speakButton");
const stopSpeakButton = document.getElementById("stopSpeakButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const copyTranscriptButton = document.getElementById("copyTranscriptButton");
const clearTranscriptButton = document.getElementById("clearTranscriptButton");
const useTranscriptForSpeechButton = document.getElementById("useTranscriptForSpeechButton");
const saveTextButton = document.getElementById("saveTextButton");
const statusMessage = document.getElementById("statusMessage");
const transcriptOutput = document.getElementById("transcriptOutput");
const ttsInput = document.getElementById("ttsInput");
const voiceSelect = document.getElementById("voiceSelect");
const languageSelect = document.getElementById("languageSelect");
const rateRange = document.getElementById("rateRange");
const pitchRange = document.getElementById("pitchRange");
const rateValue = document.getElementById("rateValue");
const pitchValue = document.getElementById("pitchValue");
const sttSupportChip = document.getElementById("sttSupportChip");
const ttsSupportChip = document.getElementById("ttsSupportChip");
const audioUpload = document.getElementById("audioUpload");
const audioPlayer = document.getElementById("audioPlayer");
const audioFileInfo = document.getElementById("audioFileInfo");
const removeAudioButton = document.getElementById("removeAudioButton");
const transcribeAudioButton = document.getElementById("transcribeAudioButton");
const audioTranscriptOutput = document.getElementById("audioTranscriptOutput");

let recognition = null;
let voices = [];
let isListening = false;
let currentAudioUrl = "";
let generatedSpeechUrl = "";

function setStatus(message) {
  statusMessage.textContent = message;
}

function updateSliderLabels() {
  rateValue.textContent = `${Number(rateRange.value).toFixed(1)}x`;
  pitchValue.textContent = `${Number(pitchRange.value).toFixed(1)}x`;
}

function populateVoices() {
  voices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";

  if (!voices.length) {
    const fallbackOption = document.createElement("option");
    fallbackOption.textContent = "Brauzerin standart səsi";
    fallbackOption.value = "";
    voiceSelect.appendChild(fallbackOption);
    return;
  }

  voices
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
    .forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });

  const preferredIndex = voices.findIndex((voice) =>
    /az|tr|female|zira|aria|samantha|google/i.test(`${voice.name} ${voice.lang}`)
  );

  voiceSelect.value = String(preferredIndex >= 0 ? preferredIndex : 0);
}

async function blobToBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function stopGeneratedSpeech() {
  if (generatedSpeechUrl) {
    URL.revokeObjectURL(generatedSpeechUrl);
    generatedSpeechUrl = "";
  }
  audioPlayer.pause();
}

function fallbackBrowserTts(text) {
  if (!("speechSynthesis" in window)) {
    setStatus("Bu brauzer mətni səsə çevirməyi dəstəkləmir.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = voices[Number(voiceSelect.value)];

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.lang = languageSelect.value || "az-AZ";
  utterance.rate = Number(rateRange.value);
  utterance.pitch = Number(pitchRange.value);

  utterance.onstart = () => setStatus("Brauzer səsi ilə oxunur...");
  utterance.onend = () => setStatus("Oxuma tamamlandı.");
  utterance.onerror = () => setStatus("Brauzer Azərbaycan sözlərini düzgün oxuya bilmədi.");

  window.speechSynthesis.speak(utterance);
}

async function speakText() {
  const text = ttsInput.value.trim();
  if (!text) {
    setStatus("Əvvəl mətn yaz, sonra oxut.");
    return;
  }

  stopGeneratedSpeech();
  window.speechSynthesis.cancel();
  setStatus("OpenAI TTS ilə səs hazırlanır...");

  try {
    const response = await fetch(OPENAI_TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        language: languageSelect.value || "az-AZ"
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const audioBlob = await response.blob();
    generatedSpeechUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = generatedSpeechUrl;
    audioPlayer.play().catch(() => {
      setStatus("Səs hazırdır. Audio play düyməsinə bas.");
    });
    audioFileInfo.textContent = "OpenAI TTS səsi hazırdır";
    setStatus("OpenAI TTS hazırdır. Bu səs AI tərəfindən yaradılıb.");
  } catch (error) {
    fallbackBrowserTts(text);
    console.error(error);
  }
}

function copyTranscript() {
  const text = transcriptOutput.value.trim();
  if (!text) {
    setStatus("Kopyalamaq üçün mətn yoxdur.");
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => setStatus("Mətn panoya kopyalandı."))
    .catch(() => setStatus("Panoya giriş bloklandı."));
}

function saveTextToFile() {
  const text = ttsInput.value.trim() || transcriptOutput.value.trim() || audioTranscriptOutput.value.trim();
  if (!text) {
    setStatus("Yadda saxlamaq üçün mətn yoxdur.");
    return;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stt-note.txt";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Mətn faylı yadda saxlanıldı.");
}

function moveTranscriptToTts() {
  const transcript = transcriptOutput.value.trim() || audioTranscriptOutput.value.trim();
  if (!transcript) {
    setStatus("Köçürmək üçün mətn yoxdur.");
    return;
  }

  ttsInput.value = transcript;
  setStatus("Mətn TTS bölməsinə köçürüldü.");
}

function clearAudioSelection() {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = "";
  }

  stopGeneratedSpeech();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
  audioUpload.value = "";
  audioFileInfo.textContent = "Hələ audio seçilməyib.";
  audioTranscriptOutput.value = "";
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setupRecognition() {
  if (!SpeechRecognition) {
    sttSupportChip.textContent = "STT dəstəklənmir";
    setStatus("Canlı mikrofon STT üçün Chrome və ya Edge lazımdır.");
    listenButton.disabled = true;
    stopListenButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = languageSelect.value || "az-AZ";

  sttSupportChip.textContent = "STT hazırdır";

  recognition.onstart = () => {
    isListening = true;
    listenButton.disabled = true;
    stopListenButton.disabled = false;
    setStatus("Dinlənilir...");
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const chunk = event.results[index][0].transcript;
      if (event.results[index].isFinal) {
        finalText += chunk + " ";
      } else {
        interimText += chunk;
      }
    }

    const existingFinal = transcriptOutput.dataset.finalText || "";
    const mergedFinal = `${existingFinal}${finalText}`.trim();
    transcriptOutput.dataset.finalText = mergedFinal ? `${mergedFinal} ` : "";
    transcriptOutput.value = `${mergedFinal}${mergedFinal && interimText ? " " : ""}${interimText}`.trim();
  };

  recognition.onerror = (event) => {
    const messageMap = {
      "not-allowed": "Mikrofona icazə verilmədi.",
      "no-speech": "Heç bir səs aşkarlanmadı.",
      "audio-capture": "Mikrofon tapılmadı.",
      "network": "Brauzerin səs xidməti əlçatan deyil."
    };

    setStatus(messageMap[event.error] || `Səs tanıma xətası: ${event.error}`);
  };

  recognition.onend = () => {
    isListening = false;
    listenButton.disabled = false;
    stopListenButton.disabled = true;
    if (statusMessage.textContent === "Dinlənilir...") {
      setStatus("Dinləmə dayandırıldı.");
    }
  };
}

async function transcribeUploadedAudio() {
  const [file] = audioUpload.files;
  if (!file) {
    setStatus("Əvvəl audio fayl seç.");
    return;
  }

  setStatus("Audio OpenAI Whisper ilə mətnə çevrilir...");

  try {
    const base64 = await blobToBase64(file);
    const response = await fetch(OPENAI_TRANSCRIBE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || "audio/mpeg",
        base64
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    audioTranscriptOutput.value = result.text || "";
    setStatus("Audio mətnə çevrildi.");
  } catch (error) {
    console.error(error);
    audioTranscriptOutput.value = "";
    setStatus("Audio transkripsiyası alınmadı. OpenAI açarı və Netlify funksiyası lazımdır.");
  }
}

listenButton.addEventListener("click", () => {
  if (!recognition || isListening) {
    return;
  }

  recognition.lang = languageSelect.value || "az-AZ";
  recognition.start();
});

stopListenButton.addEventListener("click", () => {
  if (recognition && isListening) {
    recognition.stop();
  }
});

languageSelect.addEventListener("change", () => {
  if (recognition) {
    recognition.lang = languageSelect.value;
  }
  setStatus(`Dil seçildi: ${languageSelect.options[languageSelect.selectedIndex].text}.`);
});

speakButton.addEventListener("click", speakText);
stopSpeakButton.addEventListener("click", () => {
  window.speechSynthesis.cancel();
  stopGeneratedSpeech();
  setStatus("Səsləndirmə dayandırıldı.");
});
pauseButton.addEventListener("click", () => {
  if (!audioPlayer.paused && audioPlayer.src) {
    audioPlayer.pause();
    setStatus("Audio pauzaya qoyuldu.");
    return;
  }

  window.speechSynthesis.pause();
  setStatus("Səsləndirmə pauzaya qoyuldu.");
});
resumeButton.addEventListener("click", () => {
  if (audioPlayer.src && audioPlayer.paused) {
    audioPlayer.play().catch(() => {
      setStatus("Audio davam etmədi.");
    });
    setStatus("Audio davam edir.");
    return;
  }

  window.speechSynthesis.resume();
  setStatus("Səsləndirmə davam edir.");
});
copyTranscriptButton.addEventListener("click", copyTranscript);
clearTranscriptButton.addEventListener("click", () => {
  transcriptOutput.value = "";
  transcriptOutput.dataset.finalText = "";
  setStatus("Mətn təmizləndi.");
});
useTranscriptForSpeechButton.addEventListener("click", moveTranscriptToTts);
saveTextButton.addEventListener("click", saveTextToFile);
rateRange.addEventListener("input", updateSliderLabels);
pitchRange.addEventListener("input", updateSliderLabels);
removeAudioButton.addEventListener("click", () => {
  clearAudioSelection();
  setStatus("Audio silindi.");
});
transcribeAudioButton.addEventListener("click", transcribeUploadedAudio);
audioUpload.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  clearAudioSelection();
  currentAudioUrl = URL.createObjectURL(file);
  audioPlayer.src = currentAudioUrl;
  audioFileInfo.textContent = `${file.name} | ${formatFileSize(file.size)}`;
  setStatus("Audio fayl əlavə olundu.");
});

if ("speechSynthesis" in window) {
  ttsSupportChip.textContent = "TTS hazırdır";
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
} else {
  ttsSupportChip.textContent = "TTS brauzerdə zəifdir";
}

updateSliderLabels();
setupRecognition();
setStatus("Azərbaycan dili üçün OpenAI TTS daha yaxşı nəticə verir.");
