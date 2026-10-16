# GameForge AI Studio Pro

تمت إضافة نسخة احترافية من استوديو توليد الألعاب مع دعم:
- إنشاء عناصر 3D داخل المشهد
- إنشاء شخصية وتعديلها
- قوالب جاهزة للعبة
- حفظ واستعادة المشروع محليًا
- ذكاء اصطناعي عبر خادم Node.js
- معاينة الألعاب داخل iframe
- دعم OpenAI أو LLM محلي

## متطلبات التشغيل
- Node.js 18+
- npm
- إن كنت تستخدم OpenAI، أضف OPENAI_API_KEY في ملف `.env`
- إن كنت تستخدم LLM محليًا، جهّز endpoint مثل Ollama / MLC / text-generation-webui

## الخطوات
### 1) تثبيت الحزم
```bash
npm install
```

### 2) إعداد المتغيرات
انسخ الملف التالي:
```bash
cp .env.example .env
```
ثم عدّل الملف حسب احتياجك:
```bash
PROVIDER=openai
OPENAI_API_KEY=your_key_here
```
أو:
```bash
PROVIDER=local
LOCAL_LLM_URL=http://localhost:8080/generate
```

### 3) تشغيل الخادم
```bash
npm start
```

### 4) افتح الواجهة
افتح ملف `GameForge_AI_Studio_Pro.html` في المتصفح، أو استخدم خادم ثابت محلي مثل `python -m http.server`.

## ملاحظات مهمة
- لا تضع مفاتيح API داخل ملفات GitHub العامة.
- إذا كنت تستخدم OpenAI، ستتكبد تكلفة الطلبات حسب الاستخدام.
- إذا كنت تستخدم LLM محليًا، فالتكلفة تعتمد على قوتك الحاسوبية فقط.
- خيار `DISABLE_RATE_LIMIT=true` يفتح الخادم للاستدعاءات بشكل أكبر، لكنه يزيد التكاليف أو استخدام الموارد.

## ملاحظة عن "غير محدود"
لا يمكن تجاوز حدود مزود خارجي أو API بشكل غير قانوني. الأسلوب الواقعي هو:
- تشغيل نموذج محلي على جهازك/خادمك، أو
- استخدام حساب مزود سحابي مع مراقبة التكلفة.

## الاستضافة السحابية
يمكن نشر الخادم بسهولة على:
- Render
- Fly.io
- Railway
- VPS Linux

ثم وضع متغيرات البيئة عبر لوحة الشبكة أو ملف `.env` على الخادم.

## معلومات إضافية
الواجهة تدعم:
- 3D scene editor
- project saving
- AI generation flow
- previews of generated HTML games
- templates for platformer/runner/shooter/racer/puzzle/survival

تم تصميم هذه النسخة لتكون نقطة انطلاق وظيفية قابلة للتوسعة في أي مشروع لعبة.
