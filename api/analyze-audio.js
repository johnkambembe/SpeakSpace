const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is not configured."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const {
      audioBase64,
      mimeType,
      topic,
      category
    } = req.body || {};

    if (!audioBase64 || !mimeType) {
      return res.status(400).json({
        error: "Audio data is missing."
      });
    }

    const prompt = `
You are the friendly speaking coach inside SpeakSpace.

SpeakSpace is a safe and pressure-free place where people practice speaking English.
Your job is not to judge the speaker or give them a school exam.
Your job is to help them notice useful things and improve naturally.

The user practiced speaking about this topic:

Category: ${category || "Unknown"}
Topic: ${topic || "Unknown"}

Analyze the attached audio.

IMPORTANT:
- The audio may contain English, French, or another language.
- If the speaker is practicing English, focus on their English.
- If the audio is not understandable, explain that gently.
- Do not invent words that you cannot hear.
- Keep the transcription as faithful as possible.
- Preserve meaningful repetitions and hesitations.
- Do not punish the user for using "uh", "um", "like", or pauses.
- Do not rewrite the whole speech.
- Give only a few useful corrections.
- Be encouraging and concise.
- Do not give a numerical score.
- Do not call the speaker a beginner, bad, weak, or fluent unless the audio clearly supports it.

Return ONLY valid JSON.
Do not use Markdown.
Do not put the JSON inside a code block.

Use exactly this structure:

{
  "transcript": "A faithful transcription of the audio.",
  "repeatedWords": [
    {
      "word": "word",
      "count": 3
    }
  ],
  "corrections": [
    {
      "original": "I am agree",
      "better": "I agree",
      "explanation": "Use 'I agree' in this sentence."
    }
  ],
  "suggestions": [
    "One useful suggestion for the next practice."
  ],
  "encouragement": "A short, kind message."
}

Rules:
- If there are no repeated words, return an empty array.
- If there are no corrections, return an empty array.
- If there are no suggestions, return an empty array.
- Return a maximum of 5 repeated words.
- Return a maximum of 5 corrections.
- Return a maximum of 3 suggestions.
- Keep the feedback focused on speaking practice.
`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            },
            {
              inlineData: {
                mimeType,
                data: audioBase64
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text?.trim();

    if (!text) {
      return res.status(502).json({
        error: "Gemini returned an empty response."
      });
    }

    let feedback;

    try {
      feedback = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Gemini returned an invalid JSON response."
      });
    }

    return res.status(200).json({
      success: true,
      feedback
    });

  } catch (error) {
    console.error("Gemini analysis error:", error);

    return res.status(500).json({
      error: "Something went wrong while analyzing your recording."
    });
  }
}

module.exports = handler;