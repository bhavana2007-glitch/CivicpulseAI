const key = process.env.GROQ_API_KEY;


  const fallback: ClassificationResult = {
    category: "Road Damage",
    description:
      "Civic issue detected but automatic classification failed. Manual verification required.",
    priority: "medium",
    department: DEPARTMENTS["Road Damage"],
    confidence: 0,
    severity: "Medium",
    isValid: true,
    uncertain: true,
    source: "fallback",
  };


  if (!key) {
    return {
      ...fallback,
      error: "Missing GROQ_API_KEY",
    };
  }


  try {

    const image = extractBase64(data.imageDataUrl);
    const dataUrl = `data:${image.mimeType};base64,${image.data}`;


    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },

        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: SYSTEM_PROMPT },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      }
    );


    if (!response.ok) {

      const errorText = await response.text();

      console.error(
        "Groq API error:",
        response.status,
        errorText.slice(0,300)
      );


      return {
        ...fallback,
        error: `Groq API ${response.status}`,
      };

    }


    const json = await response.json();


    const text =
      json?.choices?.[0]
        ?.message
        ?.content ?? "";
