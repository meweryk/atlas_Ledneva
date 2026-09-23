/* ============================================================
   nozod.js — вкладка «Нозод»: аккордеон + воспроизведение + WAV
   ============================================================ */
(function () {
    'use strict';

    const NOZOD_URL = 'nozod.json';
    const SAMPLE_RATE = 48000;
    const CHANNELS = 2;
    const BITS = 32;
    const DEFAULT_DURATION_SEC = 60;

    let nozodData = null;
    let audioCtx = null;
    let activeOscillators = [];
    let activeMasterGain = null;
    let currentlyPlayingBtn = null;

    /* ---------- Утилиты ---------- */

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function getFreqsString(r) {
        if (Array.isArray(r.frequencies)) return r.frequencies.join('; ');
        return r.frequencies || '';
    }

    function parseFreqs(str) {
        if (!str) return [];
        return String(str)
            .split(/[;,]/)
            .map(s => parseFloat(s.replace(',', '.').trim()))
            .filter(n => !isNaN(n) && n > 0);
    }

    function sanitizeFileName(s) {
        return String(s)
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 80) || 'nozod';
    }

    /* ---------- Toast-уведомления ---------- */

    function ensureToastContainer() {
        let c = document.getElementById('nozodToastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'nozodToastContainer';
            c.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            c.style.zIndex = '2000';
            document.body.appendChild(c);
        }
        return c;
    }

    function showToast(message, type) {
        type = type || 'info';
        const container = ensureToastContainer();
        const bgClass = type === 'success' ? 'text-bg-success'
                      : type === 'danger'  ? 'text-bg-danger'
                      : type === 'warning' ? 'text-bg-warning'
                      : 'text-bg-secondary';
        const el = document.createElement('div');
        el.className = `toast align-items-center ${bgClass} border-0`;
        el.setAttribute('role', 'alert');
        el.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${escapeHtml(message)}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Закрыть"></button>
            </div>`;
        container.appendChild(el);

        if (window.bootstrap && bootstrap.Toast) {
            const t = new bootstrap.Toast(el, { delay: 6000 });
            t.show();
            el.addEventListener('hidden.bs.toast', () => el.remove());
        } else {
            setTimeout(() => el.remove(), 6000);
        }
    }

    /* ---------- Загрузка и рендер ---------- */

    async function loadNozodes() {
        if (nozodData) return;
        const container = document.getElementById('nozodAccordion');
        if (container) {
            container.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Загрузка нозодов…</div>';
        }
        try {
            const res = await fetch(NOZOD_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            nozodData = await res.json();
        } catch (e) {
            console.error('nozod.json load error:', e);
            if (container) {
                container.innerHTML = '<div class="alert alert-danger m-2">Не удалось загрузить nozod.json</div>';
            }
            return;
        }
        renderAccordion();
    }

    function renderAccordion() {
        const container = document.getElementById('nozodAccordion');
        if (!container) return;
        container.innerHTML = '';

        const remedies = Array.isArray(nozodData.remedies) ? nozodData.remedies : [];
        const categories = nozodData.categories || {};

        // Группировка по классам
        const groups = {};
        for (const r of remedies) {
            const cat = r.category || 'other';
            (groups[cat] = groups[cat] || []).push(r);
        }

        // Порядок классов: как в categories, затем прочие
        const orderedCats = [];
        for (const c of Object.keys(categories)) {
            if (groups[c]) orderedCats.push(c);
        }
        for (const c of Object.keys(groups)) {
            if (!orderedCats.includes(c)) orderedCats.push(c);
        }

        let idx = 0;
        for (const cat of orderedCats) {
            const catLabel = categories[cat] || cat;
            const items = groups[cat];
            const accId = 'nozod-cat-' + idx;

            const itemsHtml = items.map(r => renderItem(r)).join('');

            const wrapper = document.createElement('div');
            wrapper.className = 'accordion-item';
            wrapper.innerHTML = `
                <h2 class="accordion-header" id="heading-${accId}">
                    <button class="accordion-button collapsed" type="button"
                            data-bs-toggle="collapse" data-bs-target="#collapse-${accId}"
                            aria-expanded="false" aria-controls="collapse-${accId}">
                        ${escapeHtml(catLabel)} <span class="badge bg-secondary ms-2">${items.length}</span>
                    </button>
                </h2>
                <div id="collapse-${accId}" class="accordion-collapse collapse"
                     aria-labelledby="heading-${accId}" data-bs-parent="#nozodAccordion">
                    <div class="accordion-body nozod-body p-3">${itemsHtml}</div>
                </div>`;
            container.appendChild(wrapper);
            idx++;
        }

        if (!orderedCats.length) {
            container.innerHTML = '<div class="text-muted p-3">Список пуст.</div>';
        }
    }

    function renderItem(r) {
        const freqsStr = getFreqsString(r);
        const hasFreqs = parseFreqs(freqsStr).length > 0;
        const name = r.name || '';
        const desc = r.description || '';
        const func = r.function || '';
        const source = r.source || '';
        const disabled = hasFreqs ? '' : 'disabled';

        const sourceBadge = source
            ? `<span class="badge rounded-pill text-bg-info nozod-source-badge ms-2" title="Источник">${escapeHtml(source)}</span>`
            : '';

        return `
            <div class="card mb-2 nozode-item">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start gap-2">
                        <div class="flex-grow-1">
                            <div class="fw-bold nozod-name">
                                ${escapeHtml(name)}${sourceBadge}
                            </div>
                            ${desc ? `<div class="small text-muted mt-1">${escapeHtml(desc)}</div>` : ''}
                            ${freqsStr ? `<div class="small mt-1"><strong>Частоты (Гц):</strong> <span class="font-monospace">${escapeHtml(freqsStr)}</span></div>` : ''}
                            ${func ? `<div class="small mt-1"><strong>Функция:</strong> ${escapeHtml(func)}</div>` : ''}
                        </div>
                        <div class="d-flex flex-column gap-1 flex-shrink-0">
                            <button class="btn btn-sm btn-outline-success nozod-play-btn" title="Воспроизвести"
                                    data-action="play"
                                    data-name="${escapeHtml(name)}"
                                    data-freqs="${escapeHtml(freqsStr)}"
                                    ${disabled}>
                                <i class="bi bi-play-fill"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary nozod-save-btn" title="Сохранить WAV"
                                    data-action="save"
                                    data-name="${escapeHtml(name)}"
                                    data-source="${escapeHtml(source)}"
                                    data-freqs="${escapeHtml(freqsStr)}"
                                    ${disabled}>
                                <i class="bi bi-download"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    /* ---------- Воспроизведение (Web Audio API) ---------- */

    function ensureAudioCtx() {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new Ctx({ sampleRate: SAMPLE_RATE });
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function setPlayButtonState(btn, playing) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (!icon) return;
        if (playing) {
            btn.classList.remove('btn-outline-success');
            btn.classList.add('btn-danger');
            btn.title = 'Остановить';
            icon.className = 'bi bi-stop-fill';
        } else {
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-outline-success');
            btn.title = 'Воспроизвести';
            icon.className = 'bi bi-play-fill';
        }
    }

    function stopAll() {
        for (const o of activeOscillators) {
            try { o.stop(); } catch (e) { /* ignore */ }
            try { o.disconnect(); } catch (e) { /* ignore */ }
        }
        activeOscillators = [];
        if (activeMasterGain) {
            try { activeMasterGain.disconnect(); } catch (e) { /* ignore */ }
            activeMasterGain = null;
        }
        if (currentlyPlayingBtn) {
            setPlayButtonState(currentlyPlayingBtn, false);
            currentlyPlayingBtn = null;
        }
    }

    function playFrequencies(freqs, btn) {
        stopAll();
        if (!freqs.length) return;
        const ctx = ensureAudioCtx();

        const master = ctx.createGain();
        const amp = 0.5 / freqs.length;
        master.gain.value = amp;
        master.connect(ctx.destination);
        activeMasterGain = master;

        for (const f of freqs) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            osc.connect(master);
            osc.start();
            activeOscillators.push(osc);
        }

        currentlyPlayingBtn = btn || null;
        setPlayButtonState(btn, true);
    }

    /* ---------- Генерация WAV (32-bit PCM, stereo, 48 kHz) ---------- */

    function generateWavBlob(freqs, durationSec) {
        const numChannels = CHANNELS;
        const bytesPerSample = BITS / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = SAMPLE_RATE * blockAlign;
        const numSamples = Math.max(1, Math.floor(durationSec * SAMPLE_RATE));
        const dataLength = numSamples * numChannels;
        const dataSize = dataLength * bytesPerSample;

        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        let off = 0;

        const writeStr = s => { for (let i = 0; i < s.length; i++) view.setUint8(off++, s.charCodeAt(i)); };
        const writeU32 = v => { view.setUint32(off, v >>> 0, true); off += 4; };
        const writeU16 = v => { view.setUint16(off, v & 0xFFFF, true); off += 2; };
        const writeI32 = v => { view.setInt32(off, v | 0, true); off += 4; };

        // RIFF header
        writeStr('RIFF');
        writeU32(36 + dataSize);
        writeStr('WAVE');
        // fmt chunk
        writeStr('fmt ');
        writeU32(16);
        writeU16(1);                // PCM
        writeU16(numChannels);
        writeU32(SAMPLE_RATE);
        writeU32(byteRate);
        writeU16(blockAlign);
        writeU16(BITS);
        // data chunk
        writeStr('data');
        writeU32(dataSize);

        const amp = 0.9 / Math.max(1, freqs.length);
        const twoPi = 2 * Math.PI;
        const fadeSamples = Math.min(Math.floor(SAMPLE_RATE * 0.02), Math.floor(numSamples / 2));

        for (let i = 0; i < numSamples; i++) {
            const t = i / SAMPLE_RATE;
            let s = 0;
            for (let k = 0; k < freqs.length; k++) {
                s += Math.sin(twoPi * freqs[k] * t);
            }
            s *= amp;

            if (i < fadeSamples) s *= i / fadeSamples;
            else if (i > numSamples - fadeSamples) s *= (numSamples - i) / fadeSamples;

            if (s > 1) s = 1; else if (s < -1) s = -1;
            const intVal = Math.round(s * 2147483647);
            writeI32(intVal);
            writeI32(intVal); // правый канал = левый
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /* ---------- Скачивание / сохранение файла ---------- */

    function downloadBlobFallback(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // Имя файла: name_source.wav (или name.wav, если source пуст)
    function buildFileName(name, source) {
        const safeName = sanitizeFileName(name);
        const safeSource = source ? sanitizeFileName(source) : '';
        return safeSource
            ? `${safeName}_${safeSource}.wav`
            : `${safeName}.wav`;
    }

    async function saveWav(name, source, freqs, btn) {
        if (!freqs.length) return;

        const ans = prompt('Длительность WAV в секундах:', String(DEFAULT_DURATION_SEC));
        if (ans === null) {
            showToast('Сохранение отменено', 'warning');
            return;
        }
        const duration = parseFloat(ans.replace(',', '.'));
        if (isNaN(duration) || duration <= 0) {
            showToast('Некорректная длительность', 'danger');
            return;
        }
        if (duration > 600) {
            showToast('Максимум 600 секунд', 'danger');
            return;
        }

        const fileName = buildFileName(name, source);

        // --- File System Access API (Chrome / Edge) ---
        let fileHandle = null;
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'WAV audio',
                        accept: { 'audio/wav': ['.wav'] }
                    }]
                });
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    showToast('Сохранение отменено', 'warning');
                    return;
                }
                console.warn('showSaveFilePicker failed:', err);
                fileHandle = null;
            }
        }

        // --- Блокировка кнопки ---
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        }

        showToast(`Генерация WAV (${duration} с)…`, 'info');

        // Небольшая пауза, чтобы UI успел отрисовать спиннер
        await new Promise(r => setTimeout(r, 50));

        try {
            const blob = generateWavBlob(freqs, duration);
            const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);

            if (fileHandle) {
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                showToast(
                    `Файл сохранён: «${fileHandle.name}» (${sizeMb} МБ) — в выбранную вами папку`,
                    'success'
                );
            } else {
                downloadBlobFallback(blob, fileName);
                showToast(
                    `Файл сохранён: «${fileName}» (${sizeMb} МБ) — папка загрузок браузера`,
                    'success'
                );
            }
        } catch (e) {
            console.error(e);
            showToast('Ошибка сохранения WAV: ' + e.message, 'danger');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    /* ---------- Обработчики ---------- */

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const name = btn.getAttribute('data-name') || '';
        const source = btn.getAttribute('data-source') || '';
        const freqs = parseFreqs(btn.getAttribute('data-freqs'));

        if (action === 'play') {
            e.preventDefault();
            // Повторный клик — стоп
            if (currentlyPlayingBtn === btn) {
                stopAll();
                return;
            }
            playFrequencies(freqs, btn);
        } else if (action === 'save') {
            e.preventDefault();
            saveWav(name, source, freqs, btn);
        }
    });

    /* ---------- Интеграция с навигацией ---------- */

    function showNozodPage() {
        ['mainPage', 'historyPage', 'searchPage', 'aboutPage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const page = document.getElementById('nozodPage');
        if (page) page.style.display = 'block';

        document.querySelectorAll('.navbar-nav .nav-link').forEach(a => a.classList.remove('active'));
        const link = document.getElementById('nav-nozod');
        if (link) link.classList.add('active');

        loadNozodes();
    }

    function bindNav() {
        const link = document.getElementById('nav-nozod');
        if (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                showNozodPage();
            });
        }

        ['nav-home', 'nav-history', 'nav-search', 'nav-about'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => stopAll());
        });

        document.addEventListener('keydown', ev => {
            if (ev.key === 'Escape') stopAll();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindNav);
    } else {
        bindNav();
    }

    // Публичный API
    window.Nozod = {
        stopAll,
        load: loadNozodes,
        show: showNozodPage
    };
})();