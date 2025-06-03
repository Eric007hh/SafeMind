// api/generateText.js
// این تابع Serverless Function در Vercel مسئول پروکسی کردن درخواست‌ها
// از فرانت‌اند شما به OpenAI API است.

export default async function handler(req, res) {
    // 1. بررسی متد HTTP: اطمینان حاصل می‌کنیم که فقط درخواست‌های POST پذیرفته می‌شوند.
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        // ارسال کد وضعیت 405 (Method Not Allowed) برای متدهای غیرمجاز.
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 2. دریافت داده‌ها از درخواست فرانت‌اند:
        // promptText: متنی که کاربر می‌خواهد هوش مصنوعی آن را پردازش کند.
        // model: نام مدل هوش مصنوعی که فرانت‌اند پیشنهاد می‌دهد (اختیاری).
        const { promptText, model: clientModel } = req.body;

        // 3. اعتبارسنجی ورودی: بررسی می‌کنیم که promptText حتماً ارسال شده باشد.
        if (!promptText) {
            return res.status(400).json({ error: "متن prompt (درخواست) ارسال نشده است." });
        }

        // 4. دریافت کلید API به صورت امن:
        // کلید OpenAI API از متغیرهای محیطی Vercel خوانده می‌شود.
        // این نام (OPENAI_API_KEY_SECURE) باید در تنظیمات Environment Variables پروژه Vercel شما تنظیم شود.
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY_SECURE; 
        
        // 5. بررسی وجود کلید API:
        if (!OPENAI_API_KEY) {
            console.error("OpenAI API Key not found in environment variables. Please set OPENAI_API_KEY_SECURE in Vercel.");
            return res.status(500).json({ error: "پیکربندی سرور برای کلید OpenAI API صحیح نیست. لطفاً با مدیر سیستم تماس بگیرید." });
        }

        // 6. انتخاب مدل هوش مصنوعی:
        // اگر فرانت‌اند مدلی را پیشنهاد داده باشد، از آن استفاده می‌کنیم.
        // در غیر این صورت، از مدل پیش‌فرض "gpt-3.5-turbo" استفاده می‌کنیم که هم مقرون‌به‌صرفه است و هم کیفیت خوبی دارد.
        // برای استفاده از مدل‌های دیگر OpenAI (مثل gpt-4o)، می‌توانید 'gpt-3.5-turbo' را به آن تغییر دهید.
        const modelToUse = clientModel || "gpt-3.5-turbo"; 

        // 7. تعریف EndPoint برای OpenAI API:
        // این آدرس استاندارد برای Chat Completions API در OpenAI است.
        const openaiApiUrl = `https://api.openai.com/v1/chat/completions`;

        // 8. آماده‌سازی Payload (بدنه درخواست) برای OpenAI API:
        const payload = {
            model: modelToUse, // مدل انتخابی برای درخواست
            messages: [
                // System Message: برای تعریف شخصیت و دستورالعمل‌های کلی به مدل.
                // این باعث می‌شود مدل همیشه به فارسی پاسخ دهد و از انگلیسی پرهیز کند.
                { 
                    role: "system", 
                    content: "شما یک دستیار هوش مصنوعی مفید و سازنده هستید که فقط و فقط به زبان فارسی روان و معیار پاسخ می‌دهد. لطفاً از کلمات انگلیسی استفاده نکنید، مگر اینکه خود کلمه (مثلاً یک نام خاص) اصالتاً انگلیسی باشد و معادل فارسی رایجی نداشته باشد. در تمام موارد دیگر، پاسخ باید ۱۰۰٪ فارسی باشد. پاسخ‌های شما باید مستقیماً به پرسش کاربر باشد و بدون اضافه کردن جملات مقدماتی یا پایانی غیرضروری باشد."
                },
                // User Message: شامل درخواست اصلی کاربر.
                { 
                    role: "user", 
                    content: promptText // متن prompt که از فرانت‌اند آمده است.
                }
            ],
            temperature: 0.7, // کنترل خلاقیت و تصادفی بودن پاسخ (مقادیر بین 0 و 2). 0.7 یک مقدار متعادل است.
            max_tokens: 500,  // حداکثر تعداد توکن‌هایی که مدل می‌تواند تولید کند.
                              // تنظیم این مقدار به یک عدد پایین‌تر، مصرف توکن (و هزینه) را کاهش می‌دهد.
            // top_p: 1, // پارامتر اختیاری برای کنترل تنوع در نمونه‌گیری.
            // frequency_penalty: 0, // پارامتر اختیاری برای کاهش تکرار کلمات.
            // presence_penalty: 0, // پارامتر اختیاری برای کاهش تکرار موضوعات.
        };

        // 9. ارسال درخواست به OpenAI API:
        const openaiResponse = await fetch(openaiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // هدر Authorization حاوی کلید API برای احراز هویت.
                'Authorization': `Bearer ${OPENAI_API_KEY}` 
            },
            body: JSON.stringify(payload) // تبدیل Payload به رشته JSON
        });

        // 10. مدیریت پاسخ و خطاهای دریافتی از OpenAI:
        if (!openaiResponse.ok) {
            // اگر پاسخ موفقیت‌آمیز نبود (مثلاً کد وضعیت 4xx یا 5xx)، خطا را مدیریت می‌کنیم.
            const errorData = await openaiResponse.json().catch(() => ({ message: openaiResponse.statusText }));
            console.error("OpenAI API Error from Backend:", openaiResponse.status, errorData);
            const errorMessageDetail = errorData.error && errorData.error.message ? errorData.error.message : (errorData.message || openaiResponse.statusText);
            // ارسال کد وضعیت HTTP دریافت شده از OpenAI به فرانت‌اند.
            // این به فرانت‌اند کمک می‌کند تا پیام خطای مناسب‌تری به کاربر نمایش دهد (مثل سهمیه تمام شده).
            return res.status(openaiResponse.status).json({ error: `خطا در ارتباط با OpenAI API: ${errorMessageDetail}` });
        }

        // 11. پردازش پاسخ موفقیت‌آمیز:
        const result = await openaiResponse.json();

        // 12. استخراج متن تولید شده از پاسخ OpenAI:
        if (result.choices && result.choices.length > 0 &&
            result.choices[0].message && result.choices[0].message.content) {
            const generatedText = result.choices[0].message.content;
            // 13. ارسال متن تولید شده به فرانت‌اند:
            res.status(200).json({ generated_text: generatedText.trim() });
        } else {
            // اگر ساختار پاسخ OpenAI نامعتبر بود.
            console.error("OpenAI API Error from Backend: Invalid response structure", result);
            res.status(500).json({ error: 'پاسخ نامعتبر از OpenAI API دریافت شد.' });
        }

    } catch (error) {
        // 14. مدیریت خطاهای عمومی در Serverless Function:
        // این شامل خطاهای شبکه، مشکلات در اجرای کد و غیره می‌شود.
        console.error("Error in Serverless Function (OpenAI):", error);
        res.status(500).json({ error: error.message || 'خطای داخلی سرور در تابع بدون سرور.' });
    }
}
