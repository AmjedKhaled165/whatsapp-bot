// ========================================
// API Base URL
// ========================================
const API_URL = 'http://localhost:3000';

// ========================================
// Toast Notifications
// ========================================
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInLeft 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ========================================
// Check Bot Status
// ========================================
async function checkStatus() {
    try {
        const response = await fetch(`${API_URL}/status`);
        const data = await response.json();

        const statusBadge = document.getElementById('statusBadge');
        const botStatus = document.getElementById('botStatus');

        if (data.status === 'ready') {
            statusBadge.className = 'status-badge online';
            statusBadge.querySelector('.status-text').textContent = 'متصل ✓';
            botStatus.textContent = 'متصل ونشط ✅';
            botStatus.style.color = 'var(--success)';
        } else {
            statusBadge.className = 'status-badge offline';
            statusBadge.querySelector('.status-text').textContent = 'غير متصل';
            botStatus.textContent = 'غير متصل ❌';
            botStatus.style.color = 'var(--error)';
        }
    } catch (error) {
        const statusBadge = document.getElementById('statusBadge');
        const botStatus = document.getElementById('botStatus');

        statusBadge.className = 'status-badge offline';
        statusBadge.querySelector('.status-text').textContent = 'خطأ في الاتصال';
        botStatus.textContent = 'خطأ في الاتصال';
        botStatus.style.color = 'var(--error)';

        console.error('Status check error:', error);
    }
}

// ========================================
// Send Text Message
// ========================================
document.getElementById('sendTextForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const number = document.getElementById('textNumber').value.trim();
    const message = document.getElementById('textMessage').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Validation
    if (!number || !message) {
        showToast('خطأ', 'يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number, message })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('نجح الإرسال! 🎉', `تم إرسال الرسالة إلى ${number}`, 'success');
            e.target.reset();
        } else {
            showToast('فشل الإرسال', data.error || 'حدث خطأ غير متوقع', 'error');
        }
    } catch (error) {
        showToast('خطأ في الاتصال', 'تأكد من أن السيرفر يعمل', 'error');
        console.error('Send text error:', error);
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// ========================================
// Send Image
// ========================================
document.getElementById('sendImageForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const number = document.getElementById('imageNumber').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();
    const caption = document.getElementById('imageCaption').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Validation
    if (!number || !imageUrl) {
        showToast('خطأ', 'يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/send-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number, imageUrl, caption })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('نجح الإرسال! 🎉', `تم إرسال الصورة إلى ${number}`, 'success');
            e.target.reset();
        } else {
            showToast('فشل الإرسال', data.error || 'حدث خطأ غير متوقع', 'error');
        }
    } catch (error) {
        showToast('خطأ في الاتصال', 'تأكد من أن السيرفر يعمل', 'error');
        console.error('Send image error:', error);
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// ========================================
// Send File
// ========================================
document.getElementById('sendFileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const number = document.getElementById('fileNumber').value.trim();
    const fileUrl = document.getElementById('fileUrl').value.trim();
    const fileName = document.getElementById('fileName').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Validation
    if (!number || !fileUrl) {
        showToast('خطأ', 'يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/send-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number, fileUrl, fileName })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('نجح الإرسال! 🎉', `تم إرسال الملف إلى ${number}`, 'success');
            e.target.reset();
        } else {
            showToast('فشل الإرسال', data.error || 'حدث خطأ غير متوقع', 'error');
        }
    } catch (error) {
        showToast('خطأ في الاتصال', 'تأكد من أن السيرفر يعمل', 'error');
        console.error('Send file error:', error);
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// ========================================
// Initialize on Page Load
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Check status immediately
    checkStatus();

    // Check status every 30 seconds
    setInterval(checkStatus, 30000);

    // Show welcome toast
    setTimeout(() => {
        showToast('مرحباً! 👋', 'لوحة التحكم جاهزة للاستخدام', 'success');
    }, 500);
});

// ========================================
// Auto-format phone numbers
// ========================================
const phoneInputs = [
    document.getElementById('textNumber'),
    document.getElementById('imageNumber'),
    document.getElementById('fileNumber')
];

phoneInputs.forEach(input => {
    input.addEventListener('input', (e) => {
        // Remove all non-digit characters
        e.target.value = e.target.value.replace(/\D/g, '');
    });
});
