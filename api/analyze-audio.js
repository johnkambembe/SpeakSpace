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
- If the speaker is practicing English, focus only on their English.
- If the audio is not understandable, explain that gently.
- Do not invent words that you cannot hear.
- Keep the transcription as faithful as possible.
- Preserve meaningful repetitions and hesitations in the transcription.
- Do not punish the user for using "uh", "um", "like", or pauses.
- Do not rewrite the whole speech.
- Give only a few useful and practical corrections.
- Be encouraging, natural, and concise.
- Do not give a numerical score.
- Do not call the speaker a beginner, bad, weak, or fluent unless the audio clearly supports it.

REPEATED WORDS:
- Identify meaningful words that the speaker repeats noticeably.
- Only include repetitions that could help the speaker improve vocabulary or vary their expression.
- Do not include common grammatical or functional words such as "I", "you", "the", "a", "and", "to", "of", "is", etc.
- When possible, provide up to 3 natural synonyms or alternative expressions.
- Do not force synonyms if there are no useful alternatives.
- Count meaningful occurrences of the word in the speaker's English speech.

CORRECTIONS:
- Focus on important or repeated mistakes that would make the speaker's English more natural or accurate.
- Do not correct every small mistake.
- Prefer corrections that are useful in everyday spoken English.
- Keep the original wording exactly as heard when possible.
- If a correction is uncertain because of unclear audio, do not invent it.

SUGGESTIONS:
- Give practical advice that the speaker can apply during their next speaking practice.
- Focus on vocabulary variety, sentence structure, clarity, fluency, or expressing ideas.
- Do not give generic advice that does not relate to the speaker's performance.

Return ONLY valid JSON.
Do not use Markdown.
Do not put the JSON inside a code block.

Use exactly this structure:

{
  "transcript": "A faithful transcription of the audio.",
  "repeatedWords": [
    {
      "word": "word",
      "count": 3,
      "synonyms": ["alternative1", "alternative2", "alternative3"]
    }
  ],
  "corrections": [
    {
      "original": "I am agree",
      "better": "I agree",
      "explanation": "Use 'I agree' instead of 'I am agree'."
    }
  ],
  "suggestions": [
    "One useful suggestion for the next practice."
  ],
  "encouragement": "A short, kind message tailored to the speaker's effort."
}

Rules:
- If there are no meaningful repeated words, return an empty array.
- If there are no useful corrections, return an empty array.
- If there are no useful suggestions, return an empty array.
- Return a maximum of 5 repeated words.
- Return a maximum of 5 corrections.
- Return a maximum of 3 suggestions.
- For repeated words, include up to 3 useful synonyms when possible.
- Keep all feedback focused on speaking practice.
- Never invent information that is not supported by the audio.
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