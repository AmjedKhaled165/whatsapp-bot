// WhatsApp Web Clone - JavaScript

const API_URL = ''; // Relative path to support both Localhost and Cloudflare
let currentChatId = null;
let currentChatName = null;
let messageInterval = null; // To store the auto-refresh interval

// ============================================
// Load All Chats
// ============================================
async function loadChats() {
    const chatsList = document.getElementById('chatsList');
    chatsList.innerHTML = '<div class="loading-chats"><div class="spinner"></div><p>جاري تحميل المحادثات...</p></div>';

    try {
        const response = await fetch(`${API_URL}/chats`);

        // Redirect to login if unauthorized
        if (response.status === 401 || response.url.includes('login.html')) {
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        if (data.success && data.chats) {
            displayChats(data.chats);
        } else {
            chatsList.innerHTML = '<div class="loading-chats"><p>لا توجد محادثات</p></div>';
        }
    } catch (error) {
        console.error('Error loading chats:', error);
        // Temporary Debug Alert
        alert('خطأ في تحميل المحادثات:\n' + error.message);
        chatsList.innerHTML = `<div class="loading-chats"><p>خطأ في الاتصال: ${error.message}</p></div>`;
    }
}

// ============================================
// Display Chats
// ============================================
function displayChats(chats) {
    const chatsList = document.getElementById('chatsList');

    if (chats.length === 0) {
        chatsList.innerHTML = '<div class="loading-chats"><p>لا توجد محادثات</p></div>';
        return;
    }

    chatsList.innerHTML = chats.map(chat => `
        <div class="chat-item" data-chat-id="${String(chat.id)}" data-chat-name="${chat.name || ''}">>
            <div class="chat-item-avatar">
                ${chat.profilePic ?
            `<img src="${chat.profilePic}" alt="${escapeHtml(chat.name)}">` :
            '👤'
        }
            </div>
            <div class="chat-item-content">
                <div class="chat-item-header">
                    <div class="chat-item-name">${escapeHtml(chat.name)}</div>
                    <div class="chat-item-time">${formatTime(chat.timestamp)}</div>
                </div>
                <div class="chat-item-message">
                    ${escapeHtml(chat.lastMessage || 'لا توجد رسائل')}
                </div>
            </div>
            ${chat.unreadCount > 0 ?
            `<div class="chat-item-unread">${chat.unreadCount}</div>` :
            ''
        }
        </div>
    `).join('');

    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', function () {
                const chatId = this.getAttribute('data-chat-id');
                const chatName = this.getAttribute('data-chat-name');
                console.log('🖱️ Chat clicked:', { chatId, chatName });
                openChat(chatId, chatName);
            });
        });
    }, 100);
}

// ============================================
// Open Chat
// ============================================
async function openChat(chatId, chatName) {
    console.log('🚀 openChat called with:', { chatId, chatName });

    currentChatId = chatId;
    currentChatName = chatName;

    // Hide default view, show chat view
    document.getElementById('defaultView').style.display = 'none';
    document.getElementById('chatView').style.display = 'flex';

    // Update chat header
    document.getElementById('chatName').textContent = chatName;
    document.getElementById('chatStatus').textContent = 'اضغط هنا للحصول على معلومات جهة الاتصال';

    // Mark chat as active
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    event?.target?.closest('.chat-item')?.classList.add('active');

    // Load messages
    await loadMessages(chatId);

    // Auto-refresh messages every 3 seconds
    if (messageInterval) clearInterval(messageInterval);
    messageInterval = setInterval(() => {
        if (currentChatId === chatId) {
            loadMessages(chatId, true); // true for silent loading
        }
    }, 3000);
}

// ============================================
// Load Messages
// ============================================
async function loadMessages(chatId, silent = false) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!silent) {
        messagesContainer.innerHTML = '<div class="loading-messages"><div class="spinner"></div><p>جاري تحميل الرسائل...</p></div>';
    }

    try {
        const response = await fetch(`${API_URL}/messages/${encodeURIComponent(chatId)}`);
        const data = await response.json();

        if (data.success) {
            if (data.messages && data.messages.length > 0) {
                if (silent) {
                    const existingMessages = document.querySelectorAll('.message');
                    let lastExistingId = null;
                    if (existingMessages.length > 0) {
                        const lastMsg = existingMessages[existingMessages.length - 1];
                        lastExistingId = lastMsg.getAttribute('data-id');
                    }

                    const lastDataMsg = data.messages[data.messages.length - 1];
                    const lastDataId = lastDataMsg.id || String(lastDataMsg.timestamp);

                    if (lastExistingId === lastDataId && existingMessages.length === data.messages.length) {
                        return;
                    }
                }
                displayMessages(data.messages);
            } else {
                messagesContainer.innerHTML = '<div class="loading-messages"><p>لا توجد رسائل في هذه المحادثة</p></div>';
            }
        } else {
            messagesContainer.innerHTML = '<div class="loading-messages"><p>فشل تحميل الرسائل</p></div>';
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesContainer.innerHTML = '<div class="loading-messages"><p>خطأ في الاتصال بالسيرفر</p></div>';
    }
}

function displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 150;

    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="loading-messages"><p>لا توجد رسائل</p></div>';
        return;
    }

    // Capture current scroll position
    const previousScrollHeight = messagesContainer.scrollHeight;
    const previousScrollTop = messagesContainer.scrollTop;

    messagesContainer.innerHTML = messages.map(msg => {
        const messageClass = msg.fromMe ? 'sent' : 'received';
        const msgId = msg.id || msg.timestamp;

        let mediaHtml = '';
        let textHtml = msg.body || msg.caption || '';
        let imageSrc = null;

        if (msg.type === 'video') {
            let videoSrc = null;
            if (msg.mediaUrl && (msg.mediaUrl.startsWith('data:') || msg.mediaUrl)) {
                videoSrc = msg.mediaUrl;
            }

            if (videoSrc) {
                mediaHtml = `<div class="message-media" style="width: 100%; min-width: 250px;">
                    <video controls style="width: 100%; border-radius: 8px;">
                        <source src="${videoSrc}">
                        فيديو غير مدعوم
                    </video>
                 </div>`;
                if (textHtml.startsWith('data:') || textHtml.startsWith('/9j/')) {
                    textHtml = msg.caption || '';
                }
            }
        }
        // Document/File handling (PDF, Word, Excel, etc.)
        else if (msg.type === 'document' || msg.type === 'application' || msg.mimetype?.includes('pdf') || msg.mimetype?.includes('document') || msg.mimetype?.includes('spreadsheet') || msg.mimetype?.includes('presentation')) {
            const fileName = msg.filename || msg.body || 'ملف';
            const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

            // File type icons
            let fileIcon = '📄';
            if (fileExt === 'pdf') fileIcon = '📕';
            else if (['doc', 'docx'].includes(fileExt)) fileIcon = '📘';
            else if (['xls', 'xlsx'].includes(fileExt)) fileIcon = '📗';
            else if (['ppt', 'pptx'].includes(fileExt)) fileIcon = '📙';
            else if (['zip', 'rar', '7z'].includes(fileExt)) fileIcon = '🗜️';
            else if (['mp3', 'wav', 'ogg'].includes(fileExt)) fileIcon = '🎵';

            let downloadLink = msg.mediaUrl || '#';

            mediaHtml = `<div class="message-document" onclick="window.open('${downloadLink}', '_blank')" style="
                background: #1a2e35;
                border-radius: 8px;
                padding: 12px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                min-width: 250px;
                transition: background 0.2s;
            " onmouseover="this.style.background='#243b44'" onmouseout="this.style.background='#1a2e35'">
                <span style="font-size: 32px;">${fileIcon}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="color: #e9edef; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(fileName)}</div>
                    <div style="color: #8696a0; font-size: 12px; margin-top: 2px;">${fileExt.toUpperCase()} • اضغط للتحميل</div>
                </div>
                <svg viewBox="0 0 24 24" width="24" height="24" style="color: #00a884; flex-shrink: 0;">
                    <path fill="currentColor" d="M12 16l-6-6h4V4h4v6h4l-6 6zm6 2H6v2h12v-2z"></path>
                </svg>
            </div>`;
            textHtml = msg.caption || '';
        }
        else if (msg.type === 'image' || textHtml.startsWith('data:image') || textHtml.startsWith('/9j/')) {
            if (msg.mediaUrl && msg.mediaUrl.startsWith('data:image')) {
                imageSrc = msg.mediaUrl;
                textHtml = msg.caption || '';
            } else if (textHtml.startsWith('data:image')) {
                imageSrc = textHtml;
                textHtml = msg.caption || '';
            } else if (textHtml.startsWith('/9j/')) {
                imageSrc = `data:image/jpeg;base64,${textHtml}`;
                textHtml = msg.caption || '';
            } else if (msg.mediaUrl) {
                imageSrc = msg.mediaUrl;
            }
        }
        // Catch-all for ANY long contiguous string (likely Base64 or Raw Data)
        // Checks if length > 300 AND contains a very long word > 60 chars (no spaces)
        else if (textHtml.length > 300 && /\S{60,}/.test(textHtml)) {
            // Check signatures
            if (textHtml.includes('JVBERi')) {
                // PDF
                let pdfBase64 = textHtml.trim();
                let pdfSrc = `data:application/pdf;base64,${pdfBase64.replace(/^[\.\s]+/, '')}`;

                mediaHtml = `<div class="message-document" onclick="
                    const win = window.open();
                    win.document.write('<iframe src=\\'${pdfSrc}\\' frameborder=\\'0\\' style=\\'border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;\\' allowfullscreen></iframe>');
                " style="
                    background: #1a2e35; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; min-width: 250px;">
                    <span style="font-size: 32px;">📕</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="color: #e9edef; font-size: 14px;">ملف PDF</div>
                        <div style="color: #8696a0; font-size: 12px;">انقر للفتح</div>
                    </div>
                 </div>`;
                textHtml = '';
            }
            else if (textHtml.includes('/9j/') || textHtml.includes('iVBOR')) {
                // Image
                const cleanBase64 = textHtml.replace(/^[\.\s]+/, '');
                imageSrc = `data:image/jpeg;base64,${cleanBase64}`;
                textHtml = msg.caption || 'صورة مستلمة';
            }
            else {
                // Generic - Create Download Link logic
                // Avoid using huge string in onclick directly

                // We will use a unique ID for this message to attach logic later if needed, 
                // but simpler for now implies using data URI with octet-stream

                const cleanBase64 = textHtml.replace(/^[\.\s]+/, '').trim();
                const fileSizeKB = Math.round(cleanBase64.length / 1024);

                // Use data URI with octet-stream to force download
                // Note: Very large files might lag the browser, but this is a fallback for < 5MB usually
                const genericSrc = `data:application/octet-stream;base64,${cleanBase64}`;

                mediaHtml = `<div class="message-document" onclick="
                    const a = document.createElement('a');
                    a.href = '${genericSrc}';
                    a.download = 'file_${msg.timestamp}.bin'; // Default name
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                " style="
                    background: #1a2e35; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; min-width: 250px;">
                    <span style="font-size: 32px;">💾</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="color: #e9edef; font-size: 14px;">ملف غير معروف</div>
                        <div style="color: #8696a0; font-size: 12px;">بيانات خام (${fileSizeKB} KB) - اضغط للتحميل</div>
                    </div>
                 </div>`;
                textHtml = '';
            }
        }

        if (imageSrc) {
            const imageIndex = window.imageCache ? window.imageCache.length : 0;
            if (!window.imageCache) window.imageCache = [];
            window.imageCache[imageIndex] = imageSrc;

            mediaHtml = `<div class="message-media" data-image-index="${imageIndex}" onclick="openLightbox(${imageIndex})">
                <img src="${imageSrc}" alt="صورة" loading="lazy" onerror="this.style.display='none'">
            </div>`;
        }

        return `
            <div class="message ${messageClass}" data-id="${msgId}">
                <div class="message-bubble">
                    ${mediaHtml}
                    ${textHtml && !textHtml.startsWith('data:') ? `<div class="message-text">${escapeHtml(textHtml)}</div>` : ''}
                    <div class="message-time">${formatMessageTime(msg.timestamp)}</div>
                </div>
            </div>
        `;
    }).join('');

    if (isAtBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 300);
    } else {
        // Restore scroll position if not at bottom
        // Adjust for any new height but try to keep user looking at same relative place
        // Actually, just restoring scrollTop is usually enough if we are adding meaningful content
        // BUT if content replaced was "spinner", then we need to be careful.
        // In this flow, we replaced ACTUAL messages with ACTUAL messages (just updated).
        // So previousScrollTop should be fine.
        messagesContainer.scrollTop = previousScrollTop;
    }
}

async function sendMessage() {
    if (!currentChatId) {
        alert('يرجى اختيار محادثة أولاً');
        return;
    }

    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: currentChatId, message })
        });
        const data = await response.json();
        if (response.ok) {
            addMessageToUI(message, true);
            input.value = '';
            // Use silent=true to prevent spinner flash and "jump" effect
            setTimeout(() => loadMessages(currentChatId, true), 500);
        } else {
            alert('فشل إرسال الرسالة: ' + (data.error || 'خطأ غير معروف'));
        }
    } catch (error) {
        console.error('Send message error:', error);
        alert('خطأ في الاتصال بالسيرفر');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// ============================================
// Add Message to UI (Optimistic Update)
// ============================================
function addMessageToUI(text, fromMe = true) {
    const messagesContainer = document.getElementById('messagesContainer');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${fromMe ? 'sent' : 'received'}`;
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(text)}</div>
            <div class="message-time">${formatMessageTime(Date.now())}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================
// Enter Key to Send
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');

    messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Load chats on page load
    loadChats();

    // Refresh chats every 10 seconds
    setInterval(loadChats, 10000);
});

// ============================================
// Utility Functions
// ============================================
function formatTime(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
        // Today - show time
        return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
        // Yesterday
        return 'أمس';
    } else {
        // Older - show date
        return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric', year: 'numeric' });
    }
}

function formatMessageTime(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp * 1000 || timestamp);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Search Functionality
// ============================================
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');

    chatItems.forEach(item => {
        const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
        const message = item.querySelector('.chat-item-message').textContent.toLowerCase();

        if (name.includes(searchTerm) || message.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});
// ============================================
// Lightbox Functionality
// ============================================
function openLightbox(index) {
    const imageSrc = window.imageCache[index];
    if (!imageSrc) return;

    const lightbox = document.getElementById('imageLightbox');
    const lightboxImage = document.getElementById('lightboxImage');

    lightboxImage.src = imageSrc;
    lightbox.classList.add('active');

    // Prevent scrolling behind lightbox
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    lightbox.classList.remove('active');

    // Restore scrolling
    document.body.style.overflow = '';

    // Clear image src to stop memory leaks
    setTimeout(() => {
        document.getElementById('lightboxImage').src = '';
    }, 300);
}

// Close lightbox on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLightbox();
    }
});

// ============================================
// Media & Emoji Handling
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Emoji Picker
    const emojiBtn = document.querySelector('button[title="إيموجي"]');
    const input = document.getElementById('messageInput');

    // Check if PicMo is loaded
    if (emojiBtn && window.picmoPopup && window.picmo) {
        try {
            const picker = window.picmoPopup.createPopup({}, {
                referenceElement: emojiBtn,
                triggerElement: emojiBtn,
                position: 'top-start',
                className: 'emoji-picker-theme' // You might want custom CSS for this
            });

            emojiBtn.addEventListener('click', () => {
                picker.toggle();
            });

            picker.addEventListener('emoji:select', (selection) => {
                input.value += selection.emoji;
                input.focus();
            });
        } catch (err) {
            console.error('PicMo initialization failed:', err);
        }
    }

    // 2. File Attachment
    const attachBtn = document.querySelector('button[title="إرفاق"]');
    const fileInput = document.getElementById('fileInput');

    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!currentChatId) {
                alert('يرجى اختيار محادثة أولاً');
                fileInput.value = ''; // Reset
                return;
            }

            const caption = prompt('هل تريد إضافة تعليق؟');
            if (caption === null) {
                fileInput.value = '';
                return; // User cancelled
            }

            // UI Feedback
            const originalIcon = attachBtn.innerHTML;
            attachBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
            attachBtn.disabled = true;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('chatId', currentChatId);
            formData.append('caption', caption);

            try {
                const number = currentChatId.replace('@c.us', '');
                // We use the new endpoint
                const response = await fetch('/send-media', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    // Success! Refresh just to be sure
                    loadMessages(currentChatId, true);
                } else {
                    alert('فشل إرسال الملف: ' + (data.error || 'خطأ غير معروف'));
                }
            } catch (error) {
                console.error('Upload Error:', error);
                alert('خطأ في رفع الملف');
            } finally {
                attachBtn.innerHTML = originalIcon;
                attachBtn.disabled = false;
                fileInput.value = '';
            }
        });
    }
});

// ============================================
// Voice Recording Handling
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const voiceBtn = document.getElementById('voiceBtn');
    let mediaRecorder;
    let audioChunks = [];

    if (voiceBtn) {
        voiceBtn.addEventListener('mousedown', startRecording);
        voiceBtn.addEventListener('mouseup', stopRecording);
        // Touch events
        voiceBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
        voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });
    }

    async function startRecording() {
        if (!currentChatId) {
            alert('يرجى اختيار محادثة أولاً');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = sendAudioMessage;

            mediaRecorder.start();
            voiceBtn.classList.add('recording');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('لا يمكن الوصول للميكروفون. تأكد من السماح بالصلاحيات.');
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            voiceBtn.classList.remove('recording');
        }
    }

    async function sendAudioMessage() {
        if (audioChunks.length === 0) return;

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice-note.webm');
        formData.append('chatId', currentChatId);

        // Visual Feedback
        const originalIcon = voiceBtn.innerHTML;
        voiceBtn.disabled = true;
        voiceBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';

        try {
            const response = await fetch('/send-media', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                loadMessages(currentChatId, true);
            } else {
                alert('فشل إرسال التسجيل');
            }
        } catch (error) {
            console.error('Voice send error:', error);
        } finally {
            voiceBtn.innerHTML = originalIcon;
            voiceBtn.disabled = false;
        }
    }
});

// ============================================
// Video Call Handling (Jitsi Meet Workaround)
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const videoCallBtn = document.getElementById('videoCallBtn');

    if (videoCallBtn) {
        videoCallBtn.addEventListener('click', async () => {
            if (!currentChatId) {
                alert('يرجى اختيار محادثة أولاً');
                return;
            }

            const confirmCall = confirm('هل تريد بدء مكالمة فيديو؟ 📹\nسيتم إرسال رابط المكالمة للطرف الآخر.');
            if (!confirmCall) return;

            // Generate unique meeting ID
            const meetingId = 'RoyalChat-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const meetingLink = `https://meet.jit.si/${meetingId}`;

            const message = `📞 انضم إلى مكالمة الفيديو الخاصة بي:\n${meetingLink}`;

            // Send Link Message
            try {
                const response = await fetch(`${API_URL}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: currentChatId,
                        message: message
                    })
                });

                const data = await response.json();
                if (data.success) {
                    // Open Jitsi in new tab for the caller
                    window.open(meetingLink, '_blank');
                    loadMessages(currentChatId, true);
                } else {
                    alert('فشل بدء المكالمة');
                }
            } catch (error) {
                console.error('Call Error:', error);
                alert('حدث خطأ أثناء بدء المكالمة');
            }
        });
    }
});

// ============================================
// WhatsApp Logout Handler
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const whatsappLogoutBtn = document.getElementById('whatsappLogoutBtn');

    if (whatsappLogoutBtn) {
        whatsappLogoutBtn.addEventListener('click', async () => {
            const confirmLogout = confirm('⚠️ هل تريد تسجيل الخروج من واتساب؟\n\nسيتم حذف الجلسة الحالية وستحتاج لمسح QR جديد لربط حساب آخر.');
            if (!confirmLogout) return;

            try {
                whatsappLogoutBtn.disabled = true;
                whatsappLogoutBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';

                const response = await fetch('/whatsapp-logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                if (data.success) {
                    alert('✅ تم تسجيل الخروج من واتساب بنجاح!\n\nأعد تشغيل السيرفر (npm start) لعرض QR جديد.');
                    window.location.href = '/login.html';
                } else {
                    alert('فشل تسجيل الخروج: ' + (data.error || 'خطأ غير معروف'));
                }
            } catch (error) {
                console.error('Logout Error:', error);
                alert('حدث خطأ أثناء تسجيل الخروج');
            } finally {
                whatsappLogoutBtn.disabled = false;
                whatsappLogoutBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M16 17v-3H9v-4h7V7l5 5-5 5M14 2a2 2 0 0 1 2 2v2h-2V4H5v16h9v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9z"></path></svg>';
            }
        });
    }
});

// ============================================
// QR Code Auto-Display
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    let qrCheckInterval = setInterval(checkQRConnection, 3000);
    let isShowingQR = false;

    async function checkQRConnection() {
        try {
            const response = await fetch('/auth/qr');
            if (response.status === 401) return; // Not logged in app

            const data = await response.json();

            if (data.success && data.qr) {
                // Show QR Overlay
                showQROverlay(data.qr);
                isShowingQR = true;
            } else if (isShowingQR && !data.qr) {
                // QR gone (likely scanned or expired)
                hideQROverlay();
                isShowingQR = false;

                // If connected, reload chats
                if (data.isConnected) {
                    loadChats();
                }
            }
        } catch (error) {
            console.error('QR Check Error:', error);
        }
    }

    function showQROverlay(qrCodeBase64) {
        let overlay = document.getElementById('qrOverlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'qrOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-family: sans-serif;
            `;

            overlay.innerHTML = `
                <div style="background: white; padding: 20px; border-radius: 16px; text-align: center; max-width: 90%; width: 350px;">
                    <h2 style="color: #333; margin-bottom: 20px;">ربط واتساب</h2>
                    <img id="qrImage" src="" style="width: 100%; height: auto; display: block;" />
                    <p style="color: #666; margin-top: 20px; font-size: 14px;">افتح واتساب على هاتفك > الأجهزة المرتبطة > ربط جهاز</p>
                    <div class="spinner" style="margin: 10px auto; border-color: #00a884 #0000;"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        // Update QR Image (append base64 prefix if missing, usually WPP sends raw base64)
        // WPPConnect usually sends data:image/... but let's check
        // If it sends just raw base64 without prefix:
        const src = qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`;
        document.getElementById('qrImage').src = src;
    }

    function hideQROverlay() {
        const overlay = document.getElementById('qrOverlay');
        if (overlay) {
            overlay.remove();
            // Show success message briefly
            const successMsg = document.createElement('div');
            successMsg.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: #00a884; color: white; padding: 12px 24px; border-radius: 50px;
                z-index: 10000; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            `;
            successMsg.textContent = '✅ تم الاتصال بنجاح!';
            document.body.appendChild(successMsg);
            setTimeout(() => successMsg.remove(), 4000);
        }
    }
});
