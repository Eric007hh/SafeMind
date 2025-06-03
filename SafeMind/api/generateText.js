// api/generateText.js (یا نامی که انتخاب کردید)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { promptText, model: clientModel } = req.body;

        if (!promptText) {
            return res.status(400).json({ error: "متن prompt ارسال نشده است." });
        }

        const GROQ_API_KEY = process.env.GROQ_API_KEY_SECURE; // <<-- خواندن کلید از متغیر محیطی Vercel
        if (!GROQ_API_KEY) {
            console.error("Groq API Key not found in environment variables.");
            return res.status(500).json({ error: "پیکربندی سرور برای کلید API صحیح نیست." });
        }

        const modelToUse = clientModel || "llama3-8b-8192"; // مدل پیش‌فرض Groq یا مدلی که از فرانت‌اند میاد

        const fullPrompt = `${promptText} لطفاً پاسخ را فقط و فقط به زبان فارسی روان و معیار ارائه دهید و از کلمات انگلیسی استفاده نکنید، مگر اینکه خود کلمه (مثلاً یک نام خاص) اصالتاً انگلیسی باشد و معادل فارسی رایجی نداشته باشد. در تمام موارد دیگر، پاسخ باید ۱۰۰٪ فارسی باشد.`;

        const groqApiUrl = `https://api.groq.com/openai/v1/chat/completions`;

        const payload = {
            model: modelToUse,
            messages: [
                { 
                    role: "system", 
                    content: "شما یک دستیار هستید که فقط و فقط به زبان فارسی پاسخ می‌دهد و از کلمات انگلیسی استفاده نمی‌کند مگر در موارد ضروری برای اسامی خاص."
                },
                { 
                    role: "user", 
                    content: fullPrompt
                }
            ],
            // temperature: 0.7, // تنظیمات اختیاری
            // max_tokens: 250,  // تنظیمات اختیاری
        };

        const groqResponse = await fetch(groqApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!groqResponse.ok) {
            const errorData = await groqResponse.json().catch(() => ({ message: groqResponse.statusText }));
            console.error("Groq API Error from Backend:", groqResponse.status, errorData);
            const errorMessageDetail = errorData.error && errorData.error.message ? errorData.error.message : (errorData.message || groqResponse.statusText);
            return res.status(groqResponse.status).json({ error: `خطا در ارتباط با Groq API: ${errorMessageDetail}` });
        }

        const result = await groqResponse.json();

        if (result.choices && result.choices.length > 0 &&
            result.choices[0].message && result.choices[0].message.content) {
            const generatedText = result.choices[0].message.content;
            res.status(200).json({ generated_text: generatedText.trim() });
        } else {
            console.error("Groq API Error from Backend: Invalid response structure", result);
            res.status(500).json({ error: 'پاسخ نامعتبر از Groq API دریافت شد.' });
        }

    } catch (error) {
        console.error("Error in Serverless Function (Groq):", error);
        res.status(500).json({ error: error.message || 'خطای داخلی سرور در تابع بدون سرور.' });
    }
}