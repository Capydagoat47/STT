exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed"
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: "OPENAI_API_KEY is missing"
    };
  }

  try {
    const { filename, mimeType, base64 } = JSON.parse(event.body || "{}");

    if (!base64) {
      return {
        statusCode: 400,
        body: "Audio payload is required"
      };
    }

    const buffer = Buffer.from(base64, "base64");
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType || "audio/mpeg" });

    formData.append("file", blob, filename || "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "az");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: text
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: text
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: error instanceof Error ? error.message : "Unknown transcription error"
    };
  }
};
