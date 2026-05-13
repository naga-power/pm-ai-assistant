/* === Development PM AI Support System - Frontend === */

const API_BASE = '';

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        const sectionId = `section-${item.dataset.section}`;
        document.getElementById(sectionId).classList.add('active');
    });
});

// --- Utility ---
function renderMarkdown(text) {
    return marked.parse(text);
}

function createLoadingIndicator() {
    const el = document.createElement('div');
    el.className = 'loading-indicator';
    el.innerHTML = `
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>
        <span>AIが処理中です...</span>
    `;
    return el;
}

function showResultWithCopy(panelId, title, icon, content, rawContent) {
    const panel = document.getElementById(panelId);
    panel.innerHTML = `
        <div class="result-content">
            <div class="result-header">
                <h3><i class="fas fa-${icon}"></i> ${title}</h3>
                <button class="btn-copy" onclick="copyResult(this)" data-raw="${encodeURIComponent(rawContent)}">
                    <i class="fas fa-copy"></i> コピー
                </button>
            </div>
            <div class="result-body">${renderMarkdown(content)}</div>
        </div>
    `;
}

function showError(panelId, message) {
    const panel = document.getElementById(panelId);
    panel.innerHTML = `
        <div class="result-content" style="border-color: var(--danger);">
            <div class="result-header" style="border-color: var(--danger);">
                <h3 style="color: var(--danger);"><i class="fas fa-exclamation-circle"></i> エラー</h3>
            </div>
            <p>${message}</p>
            <p style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                OPENAI_API_KEYが設定されているか確認してください。
            </p>
        </div>
    `;
}

window.copyResult = function(btn) {
    const raw = decodeURIComponent(btn.dataset.raw);
    navigator.clipboard.writeText(raw).then(() => {
        const origHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> コピー完了';
        btn.style.color = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        setTimeout(() => {
            btn.innerHTML = origHTML;
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);
    });
};

async function apiCall(endpoint, data) {
    const response = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `HTTP ${response.status}`);
    }
    return response.json();
}

// --- Chat ---
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
let chatHistory = [];

function addChatMessage(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    const icon = role === 'user' ? 'fa-user' : 'fa-robot';
    div.innerHTML = `
        <div class="message-avatar"><i class="fas ${icon}"></i></div>
        <div class="message-content">${role === 'user' ? escapeHtml(content) : renderMarkdown(content)}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendChatMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatSend.disabled = true;

    addChatMessage('user', msg);

    const loading = createLoadingIndicator();
    chatMessages.appendChild(loading);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const result = await apiCall('chat', {
            message: msg,
            history: chatHistory,
        });
        loading.remove();
        addChatMessage('assistant', result.content);
        chatHistory.push({ role: 'user', content: msg });
        chatHistory.push({ role: 'assistant', content: result.content });

        if (chatHistory.length > 20) {
            chatHistory = chatHistory.slice(-20);
        }
    } catch (err) {
        loading.remove();
        addChatMessage('assistant', `エラーが発生しました: ${err.message}\n\nOPENAI_API_KEYが正しく設定されているか確認してください。`);
    }

    chatSend.disabled = false;
    chatInput.focus();
}

chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

// --- Progress Slider ---
const progressSlider = document.getElementById('reportProgress');
const progressValue = document.getElementById('progressValue');
if (progressSlider) {
    progressSlider.addEventListener('input', () => {
        progressValue.textContent = progressSlider.value + '%';
    });
}

// --- Report Form ---
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';

    const panel = document.getElementById('reportResult');
    const loading = createLoadingIndicator();
    panel.innerHTML = '';
    panel.appendChild(loading);

    try {
        const result = await apiCall('report', {
            project_name: document.getElementById('reportProjectName').value,
            progress_percent: parseInt(document.getElementById('reportProgress').value),
            milestones: document.getElementById('reportMilestones').value,
            achievements: document.getElementById('reportAchievements').value,
            issues: document.getElementById('reportIssues').value,
            next_plan: document.getElementById('reportNextPlan').value,
            additional_info: document.getElementById('reportAdditional').value || null,
        });
        showResultWithCopy('reportResult', 'ステータスレポート', 'chart-bar', result.content, result.content);
    } catch (err) {
        showError('reportResult', err.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> レポートを生成';
});

// --- Risk Form ---
document.getElementById('riskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';

    const panel = document.getElementById('riskResult');
    const loading = createLoadingIndicator();
    panel.innerHTML = '';
    panel.appendChild(loading);

    try {
        const result = await apiCall('risk', {
            project_description: document.getElementById('riskDescription').value,
            current_status: document.getElementById('riskStatus').value,
            team_info: document.getElementById('riskTeam').value || null,
            deadline_info: document.getElementById('riskDeadline').value || null,
            additional_context: document.getElementById('riskContext').value || null,
        });
        showResultWithCopy('riskResult', 'リスク分析結果', 'shield-alt', result.content, result.content);
    } catch (err) {
        showError('riskResult', err.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-search"></i> リスクを分析';
});

// --- Minutes Form ---
document.getElementById('minutesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';

    const panel = document.getElementById('minutesResult');
    const loading = createLoadingIndicator();
    panel.innerHTML = '';
    panel.appendChild(loading);

    try {
        const result = await apiCall('minutes', {
            meeting_notes: document.getElementById('minutesNotes').value,
            meeting_info: document.getElementById('minutesInfo').value || null,
        });
        showResultWithCopy('minutesResult', '議事録', 'clipboard', result.content, result.content);
    } catch (err) {
        showError('minutesResult', err.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-pen-fancy"></i> 議事録を生成';
});

// --- Task Breakdown Form ---
document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分解中...';

    const panel = document.getElementById('taskResult');
    const loading = createLoadingIndicator();
    panel.innerHTML = '';
    panel.appendChild(loading);

    try {
        const result = await apiCall('task-breakdown', {
            task_description: document.getElementById('taskDescription').value,
            context: document.getElementById('taskContext').value || null,
            constraints: document.getElementById('taskConstraints').value || null,
        });
        showResultWithCopy('taskResult', 'タスク分解結果', 'sitemap', result.content, result.content);
    } catch (err) {
        showError('taskResult', err.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-project-diagram"></i> タスクを分解';
});

// --- Health Check ---
fetch(`${API_BASE}/api/health`)
    .then(r => r.json())
    .then(data => {
        if (!data.openai_configured) {
            console.warn('OpenAI API key is not configured.');
        }
    })
    .catch(() => {
        console.warn('Backend not reachable.');
    });
