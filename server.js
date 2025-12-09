require('dotenv').config();
const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Enable proxy trust for Cloudflare/NGINX
app.set('trust proxy', 1);

// 🔒 Authentication Configuration
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: true, // Force save
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
// Login Middleware
const authMiddleware = (req, res, next) => {
    // Allow login page and assets
    if (req.path === '/login.html' || req.path === '/login' || req.path.match(/\.(css|js|png|jpg|jpeg)$/)) {
        return next();
    }

    // Check if user is authenticated
    if (req.session && req.session.isAuthenticated) {
        return next();
    }

    // Redirect to login if not authenticated
    res.redirect('/login.html');
};

// Apply Middleware to all routes (except login)
app.use(authMiddleware);

// Login Route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    console.log(`[LOGIN] Attempt: ${username}`);

    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (username === validUsername && password === validPassword) {
        req.session.isAuthenticated = true;
        req.session.user = username;

        // Force session save before response
        req.session.save((err) => {
            if (err) {
                console.error('[LOGIN] Save Error:', err);
                return res.status(500).json({ success: false });
            }
            console.log('[LOGIN] Success. Session saved.');
            res.json({ success: true });
        });
    } else {
        res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }
});

// Logout Route (App Session)
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

let clientInstance = null;
global.currentWhatsAppQR = null; // Variable to store the current QR Code

// 🔄 WhatsApp Logout Route (Disconnect & Delete Session)
app.post('/whatsapp-logout', async (req, res) => {
    console.log('[WHATSAPP] Logout requested...');

    try {
        if (clientInstance) {
            console.log('[WHATSAPP] Logging out from current account...');
            await clientInstance.logout();
            await clientInstance.close();
            clientInstance = null;
            console.log('[WHATSAPP] Client closed. Restarting WPPConnect for new session...');

            // Auto-restart to generate new QR
            setTimeout(() => startWhatsApp(), 1000);
        }

        res.json({
            success: true,
            message: 'تم تسجيل الخروج. سيظهر QR Code جديد تلقائياً خلال لحظات.'
        });
    } catch (error) {
        console.error('[WHATSAPP] Logout error:', error);
        res.json({
            success: false,
            message: 'حدث خطأ أثناء تسجيل الخروج.'
        });
    }
});

// 📁 Multer Configuration for File Uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if not exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Append extension
    }
});

const upload = multer({ storage: storage });

// 📤 Send Media Route
app.post('/send-media', upload.single('file'), async (req, res) => {
    const { chatId, caption } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    if (!clientInstance) {
        return res.status(500).json({ success: false, error: 'WPPConnect not initialized' });
    }

    try {
        console.log(`📤 Sending media to ${chatId}: ${file.path}`);

        // Send the file
        const result = await clientInstance.sendFile(
            chatId,
            file.path,
            file.originalname,
            caption || ''
        );

        res.json({ success: true, result });
    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ success: false, error: error.toString() });
    }
});

// 📨 Send Text Message Route
app.post('/send', async (req, res) => {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
        return res.status(400).json({ success: false, error: 'chatId and message are required' });
    }

    if (!clientInstance) {
        return res.status(500).json({ success: false, error: 'WPPConnect not initialized' });
    }

    try {
        console.log(`📨 Sending message to ${chatId}`);
        const result = await clientInstance.sendText(chatId, message);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.toString() });
    }
});

// ============================================
// Endpoint to get QR Code
// ============================================
app.get('/auth/qr', (req, res) => {
    res.json({
        success: true,
        qr: global.currentWhatsAppQR,
        isConnected: !!clientInstance
    });
});

// Function to Initialize WPPConnect
function startWhatsApp() {
    if (clientInstance) return; // Prevent double start

    console.log('[WPPConnect] Starting client...');

    // Create WPPConnect Session
    wppconnect.create({
        session: 'royal_session_v2', // Changed session name to force fresh login and fix 'undefined (reading m)' error
        autoClose: false,            // Bot stays running
        puppeteerOptions: {
            headless: true,          // Headless mode
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu'
            ]
        },
        logQR: true,                 // Log QR to console
        // Capture QR Code for Web Interface
        catchQR: (base64Qr, asciiQR) => {
            console.log('⚡ QR Code received for web interface');
            global.currentWhatsAppQR = base64Qr;
        },
        // Monitor Status
        statusFind: (statusSession, session) => {
            console.log('Status Session:', statusSession);
            if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess' || statusSession === 'inChat') {
                global.currentWhatsAppQR = null; // Clear QR when logged in
            }
            if (statusSession === 'browserClose') {
                clientInstance = null;
            }
        }
    })
        .then((client) => {
            clientInstance = client;
            global.currentWhatsAppQR = null; // Ensure QR is cleared
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("🚀 WPPConnect بدأ العمل بنجاح!");
            console.log("✅ الجلسة محفوظة - لن تحتاج QR مرة ثانية");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

            // Listen for Incoming Calls
            client.onIncomingCall(async (call) => {
                console.log('📞 Incoming Call:', call);
                // TODO: Notify frontend
            });

            // استقبال جميع الرسائل الواردة
            client.onMessage(async (message) => {
                // تجاهل رسائل الستوري (الحالة)
                if (message.from === 'status@broadcast') {
                    return;
                }

                // تجاهل رسائل الجروبات (اختياري - احذف السطرين التاليين لو عايز البوت يرد في الجروبات)
                if (message.isGroupMsg) {
                    return;
                }

                console.log(`📩 رسالة جديدة من ${message.from}`);
                console.log(`📝 المحتوى: ${message.body || '[رسالة وسائط]'}`);

                try {
                    // التأكد من وجود نص في الرسالة
                    if (!message.body || typeof message.body !== 'string') {
                        console.log('⚠️ الرسالة لا تحتوي على نص (قد تكون صورة أو ملف)');
                        return;
                    }

                    const messageText = message.body.toLowerCase().trim();

                    // مثال: رد تلقائي على كلمة "مرحبا"
                    if (messageText === "مرحبا" || messageText === "hi") {
                        await client.sendText(message.from, "أهلاً وسهلاً! 👋\nكيف يمكنني مساعدتك؟");
                    }

                    // مثال: رد على كلمة "معلومات"
                    if (messageText === "معلومات") {
                        await client.sendText(message.from,
                            "🤖 أنا بوت واتساب ذكي\n" +
                            "✨ يمكنني:\n" +
                            "• الرد التلقائي على الرسائل\n" +
                            "• إرسال الصور والملفات\n" +
                            "• التفاعل مع API خارجي"
                        );
                    }

                } catch (error) {
                    console.error("❌ خطأ في معالجة الرسالة:", error);
                }
            });

            // حدث عند تلقي أي إشعار
            client.onAck((ack) => {
                console.log(`✓ حالة الرسالة: ${ack.body} - ${ack.ack}`);
            });

        })
        .catch((err) => {
            console.error('[WPPConnect] Initialization Error:', err);
            clientInstance = null;
        });
}

// Start WhatsApp on Server Start
startWhatsApp();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📡 API Endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// التحقق من حالة البوت
app.get("/status", (req, res) => {
    if (!clientInstance) {
        return res.status(503).json({
            status: "not_ready",
            message: "البوت غير متصل بعد"
        });
    }
    res.json({
        status: "ready",
        message: "البوت يعمل بنجاح ✅",
        session: "royal_session"
    });
});

// جلب جميع المحادثات (Chats)
app.get("/chats", async (req, res) => {
    console.log('[API] GET /chats request received');

    if (!clientInstance) {
        console.log('[API] Error: Bot not ready');
        return res.status(503).json({
            error: "البوت غير جاهز بعد"
        });
    }

    try {
        console.log('[API] Fetching chats from WPPConnect...');
        // استخدام الطريقة الصحيحة من WPPConnect
        const chats = await clientInstance.listChats();

        // ترتيب المحادثات حسب آخر رسالة
        const sortedChats = chats
            .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
            .map(chat => {
                // التأكد من أن ID هو string
                let chatId = chat.id;
                if (typeof chatId === 'object' && chatId !== null) {
                    chatId = chatId._serialized || chatId.user || JSON.stringify(chatId);
                }
                chatId = String(chatId);

                return {
                    id: chatId,  // ✅ الآن دائماً string
                    name: chat.name || chat.contact?.name || chat.contact?.pushname || chatId,
                    lastMessage: chat.lastMessage || '',
                    timestamp: chat.lastMessageTime || Date.now() / 1000,
                    unreadCount: chat.unreadCount || 0,
                    isGroup: chat.isGroup || false,
                    profilePic: null
                };
            });

        console.log(`✅ [API] Retrieved ${sortedChats.length} chats successfully`);

        res.json({
            success: true,
            chats: sortedChats
        });
    } catch (err) {
        console.error("❌ خطأ في جلب المحادثات:", err);
        res.status(500).json({
            error: err.toString()
        });
    }
});

// جلب رسائل محادثة معينة مع Retry Logic
app.get("/messages/:chatId", async (req, res) => {
    if (!clientInstance) {
        return res.status(503).json({
            error: "البوت غير جاهز بعد"
        });
    }

    try {
        const chatId = req.params.chatId;
        const limit = parseInt(req.query.limit) || 100;

        console.log(`📩 جاري جلب رسائل ${chatId}...`);

        let messages = [];
        let attempts = 0;
        const maxAttempts = 3;

        // محاولة مع retry logic
        while (attempts < maxAttempts && messages.length === 0) {
            attempts++;

            try {
                console.log(`محاولة ${attempts} من ${maxAttempts}...`);

                // الطريقة الأولى: getMessages
                messages = await clientInstance.getMessages(chatId, {
                    count: limit,
                    direction: 'before'
                });

                // إذا فشلت، جرب طريقة بديلة
                if (!messages || messages.length === 0) {
                    console.log('⚠️ لا توجد رسائل بالطريقة الأولى، أجرب طريقة بديلة...');

                    // الطريقة البديلة: getAllMessagesInChat
                    const allMessages = await clientInstance.getAllMessagesInChat(chatId);
                    if (allMessages && allMessages.length > 0) {
                        messages = allMessages.slice(-limit);
                        console.log(`✅ تم جلب ${messages.length} رسالة بالطريقة البديلة`);
                    }
                }

                // إذا لسه فاضي، استني شوية وحاول تاني
                if ((!messages || messages.length === 0) && attempts < maxAttempts) {
                    console.log('⏳ انتظار 1 ثانية قبل المحاولة التالية...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (innerErr) {
                console.error(`❌ خطأ في محاولة ${attempts}:`, innerErr.message);
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // إذا مفيش رسائل بعد كل المحاولات
        if (!messages || messages.length === 0) {
            console.log('⚠️ لا توجد رسائل بعد كل المحاولات');
            return res.json({
                success: true,
                messages: [],
                warning: 'لا توجد رسائل في هذه المحادثة أو فشل تحميلها'
            });
        }

        // تنسيق الرسائل وتحميل الصور الكاملة
        const formattedMessages = await Promise.all(messages.map(async (msg) => {
            let mediaData = null;

            // Debug logging
            if (msg.isMedia || msg.hasMedia || msg.type === 'image' || msg.type === 'sticker') {
                console.log(`📷 رسالة ميديا - type: ${msg.type}, isMedia: ${msg.isMedia}, hasMedia: ${msg.hasMedia}, mimetype: ${msg.mimetype}`);
            }

            // لو رسالة فيها ميديا (صور أو فيديو)
            // نتحقق من الفيديو كمان عشان نحمله base64
            const isMediaMessage =
                msg.type === 'image' ||
                msg.type === 'video' ||
                msg.type === 'sticker' ||
                msg.type === 'audio' ||
                msg.type === 'ptt' ||
                msg.type === 'document' ||
                msg.type === 'application' || // وثائق
                msg.isMedia ||
                msg.hasMedia;

            if (isMediaMessage) {
                try {
                    // محاولة تحميل الميديا كـ base64
                    // ملاحظة: downloadMedia ممكن ياخد وقت، عشان كده بنستخدمه بحذر
                    mediaData = await clientInstance.downloadMedia(msg.id._serialized || msg.id).catch(e => {
                        console.error(`Media download failed for ${msg.id}:`, e.message);
                        return null;
                    });
                } catch (e) {
                    console.error('Error downloading media wrapper:', e);
                }
            }

            return {
                id: msg.id._serialized || msg.id,
                from: msg.from,
                to: msg.to,
                body: msg.body || '',
                type: msg.type,
                timestamp: msg.t || msg.timestamp,
                fromMe: msg.fromMe,
                // بيانات الميديا
                mediaUrl: mediaData, // Base64 content
                isMedia: isMediaMessage,
                mimetype: msg.mimetype,
                duration: msg.duration, // للفيديو/الصوت
                filename: msg.filename,  // للملفات
                caption: msg.caption
            };
        }));

        res.json({
            success: true,
            messages: formattedMessages
        });

    } catch (err) {
        console.error("❌ خطأ في جلب الرسائل:", err);
        res.status(500).json({
            error: err.toString()
        });
    }
});

// تشغيل السيرفر
const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
