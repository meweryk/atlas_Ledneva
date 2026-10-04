/* ============================================================
   nozod.js — вкладка «Нозод»
   Функционал:
     • аккордеон по категориям
     • воспроизведение (стерео, сдвиг 90°)
     • экспорт WAV (32-bit PCM, stereo, 48 кГц)
     • поиск по названию / описанию / функции (без учёта регистра)
     • добавление пользовательских нозодов (localStorage, суффикс _Locale)
     • удаление ТОЛЬКО пользовательских нозодов
   Безопасность:
     • весь рендер пользовательских данных — через escapeHtml()
     • атрибуты (data-*) экранируются
     • вход валидируется: лимиты длины/количества, частоты — только
       положительные конечные числа, удаление управляющих символов
     • никаких eval/Function/innerHTML из сырых данных
     • localStorage изолирован префиксом atlas_ledneva_
   ============================================================ */
(function () {
    'use strict';

    const NOZOD_URL = 'nozod.json';
    const SAMPLE_RATE = 48000;
    const CHANNELS = 2;
    const BITS = 32;
    const DEFAULT_DURATION_SEC = 60;

    /* ---------- Константы локального хранилища ---------- */
    const STORAGE_PREFIX = 'atlas_ledneva_';
    const LOCAL_NOZOD_KEY = STORAGE_PREFIX + 'user_nozodes';
    const LOCALE_SUFFIX = '_Locale';

    /* ---------- Лимиты (защита от переполнения / абьюза) ---------- */
    const MAX_LOCAL_NOZODS = 500;
    const MAX_NAME_LEN = 120;
    const MAX_TEXT_LEN = 2000;
    const MAX_SOURCE_LEN = 60;
    const MAX_CATEGORY_LEN = 40;
    const MAX_FREQS = 64;

    /* ---------- Состояние ---------- */
    let nozodData = null;
    let localNozodes = [];
    let audioCtx = null;
    let activeOscillators = [];
    let activeDelays = [];
    let activeMasterGain = null;
    let activeMerger = null;
    let currentlyPlayingBtn = null;
    let currentSearch = '';
    let searchDebounceTimer = null;

    /* ---------- Утилиты ---------- */

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Удаляет управляющие символы (C0 + DEL) — защита от внедрения в HTML/атрибуты.
    function stripControl(s) {
        return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F]/g, ' ');
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
            .filter(n => !isNaN(n) && isFinite(n) && n > 0);
    }

    function sanitizeFileName(s) {
        return String(s)
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 80) || 'nozod';
    }

    // Универсальный confirm: кастомная модалка из index.html, иначе нативный.
    function showConfirm(message) {
        if (typeof window.atlasConfirm === 'function') {
            return window.atlasConfirm(message);
        }
        return Promise.resolve(window.confirm(message));
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

    /* ============================================================
       ЛОКАЛЬНЫЕ (ПОЛЬЗОВАТЕЛЬСКИЕ) НОЗОДЫ
       ============================================================ */

    /**
     * Нормализует и валидирует запись нозода.
     * Возвращает безопасный объект или null, если запись невалидна.
     */
    function normalizeUserNozode(obj) {
        if (!obj || typeof obj !== 'object') return null;

        // Имя: обрезаем, чистим, добавляем суффикс _Locale
        let name = stripControl(obj.name).trim().replace(/\s+/g, ' ');
        if (!name) return null;
        if (name.length > MAX_NAME_LEN) name = name.slice(0, MAX_NAME_LEN);
        if (!name.endsWith(LOCALE_SUFFIX)) name += LOCALE_SUFFIX;

        // Частоты: только положительные конечные числа
        let freqs = [];
        if (Array.isArray(obj.frequencies)) {
            freqs = obj.frequencies
                .map(v => parseFloat(v))
                .filter(n => isFinite(n) && n > 0);
        } else if (typeof obj.frequencies === 'string') {
            freqs = obj.frequencies.split(/[;,]/)
                .map(s => parseFloat(String(s).replace(',', '.').trim()))
                .filter(n => isFinite(n) && n > 0);
        }
        freqs = freqs.slice(0, MAX_FREQS);

        const description = stripControl(obj.description).slice(0, MAX_TEXT_LEN);
        const func = stripControl(obj.function).slice(0, MAX_TEXT_LEN);
        const source = stripControl(obj.source).trim().slice(0, MAX_SOURCE_LEN) || 'CALF';
        const category = stripControl(obj.category).trim().slice(0, MAX_CATEGORY_LEN) || 'other';

        return {
            name,
            frequencies: freqs.join('; '),
            description,
            function: func,
            category,
            source,
            _userAdded: true
        };
    }

    function isUserNozode(r) {
        return !!(r && r._userAdded === true);
    }

    function loadLocalNozodes() {
        try {
            const raw = localStorage.getItem(LOCAL_NOZOD_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map(normalizeUserNozode)
                .filter(Boolean)
                .slice(0, MAX_LOCAL_NOZODS);
        } catch (e) {
            console.warn('[Nozod] Failed to load local nozodes:', e);
            return [];
        }
    }

    function saveLocalNozodes() {
        try {
            localStorage.setItem(LOCAL_NOZOD_KEY, JSON.stringify(localNozodes));
            return true;
        } catch (e) {
            console.error('[Nozod] Save failed:', e);
            showToast('Не удалось сохранить (хранилище переполнено?)', 'danger');
            return false;
        }
    }

    /* ============================================================
       ЗАГРУЗКА И ОБЪЕДИНЕНИЕ
       ============================================================ */

    async function loadNozodes() {
        // Всегда перечитываем локальные — могли поменяться в другой вкладке
        localNozodes = loadLocalNozodes();

        if (!nozodData) {
            const container = document.getElementById('nozodAccordion');
            if (container && !container.querySelector('.nozode-item')) {
                container.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Загрузка нозодов…</div>';
            }
            try {
                const res = await fetch(NOZOD_URL, { cache: 'no-cache' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                nozodData = (data && typeof data === 'object')
                    ? data
                    : { categories: {}, source: 'CALF', remedies: [] };
            } catch (e) {
                console.error('[Nozod] nozod.json load error:', e);
                nozodData = { categories: {}, source: 'CALF', remedies: [] };
                showToast('Не удалось загрузить nozod.json — показаны только ваши нозоды', 'warning');
            }
            if (!nozodData.categories || typeof nozodData.categories !== 'object') {
                nozodData.categories = {};
            }
            if (!Array.isArray(nozodData.remedies)) {
                nozodData.remedies = [];
            }
        }

        populateCategorySelect();
        renderAccordion();
    }

    /**
     * База + локальные. При совпадении имени локальный перекрывает базовый
     * (по соглашению имён с суффиксом _Locale конфликтов быть не должно).
     */
    function getAllRemedies() {
        const base = Array.isArray(nozodData && nozodData.remedies) ? nozodData.remedies : [];
        const map = new Map();
        for (const r of base) {
            if (r && typeof r.name === 'string') map.set(r.name, r);
        }
        for (const r of localNozodes) {
            if (r && typeof r.name === 'string') map.set(r.name, r);
        }
        return Array.from(map.values());
    }

    function matchesSearch(r, query) {
        if (!query) return true;
        const q = query.toLowerCase();
        return (r.name || '').toLowerCase().includes(q)
            || (r.description || '').toLowerCase().includes(q)
            || (r.function || '').toLowerCase().includes(q);
    }

    /* ============================================================
       ОТРИСОВКА
       ============================================================ */

    function renderAccordion() {
        const container = document.getElementById('nozodAccordion');
        if (!container) return;
        container.innerHTML = '';

        const remedies = getAllRemedies();
        const categories = (nozodData && nozodData.categories) || {};
        const query = currentSearch.trim().toLowerCase();

        const filtered = query ? remedies.filter(r => matchesSearch(r, query)) : remedies;

        const groups = {};
        for (const r of filtered) {
            const cat = r.category || 'other';
            (groups[cat] = groups[cat] || []).push(r);
        }

        const orderedCats = [];
        for (const c of Object.keys(categories)) {
            if (groups[c]) orderedCats.push(c);
        }
        for (const c of Object.keys(groups)) {
            if (!orderedCats.includes(c)) orderedCats.push(c);
        }

        if (!orderedCats.length) {
            container.innerHTML = query
                ? '<div class="text-muted p-3">Ничего не найдено.</div>'
                : '<div class="text-muted p-3">Список пуст.</div>';
            return;
        }

        const expandAll = !!query;
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
                    <button class="accordion-button ${expandAll ? '' : 'collapsed'}" type="button"
                            data-bs-toggle="collapse" data-bs-target="#collapse-${accId}"
                            aria-expanded="${expandAll ? 'true' : 'false'}" aria-controls="collapse-${accId}">
                        ${escapeHtml(catLabel)} <span class="badge bg-secondary ms-2">${items.length}</span>
                    </button>
                </h2>
                <div id="collapse-${accId}" class="accordion-collapse collapse ${expandAll ? 'show' : ''}"
                     aria-labelledby="heading-${accId}" data-bs-parent="#nozodAccordion">
                    <div class="accordion-body nozod-body p-3">${itemsHtml}</div>
                </div>`;
            container.appendChild(wrapper);
            idx++;
        }

        // Если кнопка воспроизведения «потерялась» после перерисовки — глушим звук
        if (currentlyPlayingBtn && !document.body.contains(currentlyPlayingBtn)) {
            stopAll();
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
        const isUser = isUserNozode(r);

        const sourceBadge = source
            ? `<span class="badge rounded-pill text-bg-info nozod-source-badge ms-2" title="Источник">${escapeHtml(source)}</span>`
            : '';

        const userBadge = isUser
            ? `<span class="badge rounded-pill text-bg-success ms-2" title="Добавлено пользователем">Локальный</span>`
            : '';

        const deleteBtn = isUser
            ? `<button class="btn btn-sm btn-outline-danger nozod-delete-btn"
                       title="Удалить (только ваш нозод)"
                       data-action="delete"
                       data-name="${escapeHtml(name)}">
                   <i class="bi bi-trash"></i>
               </button>`
            : '';

        return `
            <div class="card mb-2 nozode-item">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start gap-2">
                        <div class="flex-grow-1">
                            <div class="fw-bold nozod-name">
                                ${escapeHtml(name)}${sourceBadge}${userBadge}
                            </div>
                            ${desc ? `<div class="small text-muted mt-1">${escapeHtml(desc)}</div>` : ''}
                            ${freqsStr ? `<div class="small mt-1"><strong>Частоты (Гц):</strong> <span class="font-monospace">${escapeHtml(freqsStr)}</span></div>` : ''}
                            ${func ? `<div class="small mt-1"><strong>Функция:</strong> ${escapeHtml(func)}</div>` : ''}
                        </div>
                        <div class="d-flex flex-column gap-1 flex-shrink-0">
                            <button class="btn btn-sm btn-outline-success nozod-play-btn" title="Воспроизвести (стерео, сдвиг 90°)"
                                    data-action="play"
                                    data-name="${escapeHtml(name)}"
                                    data-freqs="${escapeHtml(freqsStr)}"
                                    ${disabled}>
                                <i class="bi bi-play-fill"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary nozod-save-btn" title="Сохранить WAV (стерео, 48 кГц, 32 бит)"
                                    data-action="save"
                                    data-name="${escapeHtml(name)}"
                                    data-source="${escapeHtml(source)}"
                                    data-freqs="${escapeHtml(freqsStr)}"
                                    ${disabled}>
                                <i class="bi bi-download"></i>
                            </button>
                            ${deleteBtn}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    /* ============================================================
       АУДИО (Web Audio API)
       ============================================================ */

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
            btn.title = 'Воспроизвести (стерео, сдвиг 90°)';
            icon.className = 'bi bi-play-fill';
        }
    }

    function stopAll() {
        for (const o of activeOscillators) {
            try { o.stop(); } catch (e) { /* ignore */ }
            try { o.disconnect(); } catch (e) { /* ignore */ }
        }
        activeOscillators = [];

        for (const d of activeDelays) {
            try { d.disconnect(); } catch (e) { /* ignore */ }
        }
        activeDelays = [];

        if (activeMerger) {
            try { activeMerger.disconnect(); } catch (e) { /* ignore */ }
            activeMerger = null;
        }
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
        master.gain.value = 0.5 / freqs.length;
        master.connect(ctx.destination);
        activeMasterGain = master;

        const merger = ctx.createChannelMerger(CHANNELS);
        merger.connect(master);
        activeMerger = merger;

        for (const f of freqs) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;

            // Правый канал — прямой сигнал sin(ωt)
            osc.connect(merger, 0, 1);

            // Левый канал — через задержку T/4 (90°)
            const delayL = ctx.createDelay(1.0);
            const quarterPeriod = 1 / (4 * f);
            delayL.delayTime.value = Math.max(quarterPeriod, 1 / SAMPLE_RATE);
            osc.connect(delayL);
            delayL.connect(merger, 0, 0);

            osc.start();
            activeOscillators.push(osc);
            activeDelays.push(delayL);
        }

        currentlyPlayingBtn = btn || null;
        setPlayButtonState(btn, true);
    }

    /* ============================================================
       ГЕНЕРАЦИЯ WAV (32-bit PCM, stereo, 48 кГц, 90°)
       ============================================================ */

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

        writeStr('RIFF');
        writeU32(36 + dataSize);
        writeStr('WAVE');
        writeStr('fmt ');
        writeU32(16);
        writeU16(1);
        writeU16(numChannels);
        writeU32(SAMPLE_RATE);
        writeU32(byteRate);
        writeU16(blockAlign);
        writeU16(BITS);
        writeStr('data');
        writeU32(dataSize);

        const amp = 0.9 / Math.max(1, freqs.length);
        const twoPi = 2 * Math.PI;
        const halfPi = Math.PI / 2;
        const fadeSamples = Math.min(
            Math.floor(SAMPLE_RATE * 0.02),
            Math.floor(numSamples / 2)
        );

        for (let i = 0; i < numSamples; i++) {
            const t = i / SAMPLE_RATE;
            let left = 0;
            let right = 0;
            for (let k = 0; k < freqs.length; k++) {
                const phase = twoPi * freqs[k] * t;
                left  += Math.sin(phase - halfPi);
                right += Math.sin(phase);
            }
            left  *= amp;
            right *= amp;

            if (i < fadeSamples) {
                const k = i / fadeSamples;
                left *= k;
                right *= k;
            } else if (i > numSamples - fadeSamples) {
                const k = (numSamples - i) / fadeSamples;
                left *= k;
                right *= k;
            }

            if (left  >  1) left  =  1; else if (left  < -1) left  = -1;
            if (right >  1) right =  1; else if (right < -1) right = -1;

            writeI32(Math.round(left  * 2147483647));
            writeI32(Math.round(right * 2147483647));
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

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

        let fileHandle = null;
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'WAV audio (stereo, 48 kHz, 32-bit, 90° phase)',
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

        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        }

        showToast(`Генерация WAV (${duration} с, стерео 90°)…`, 'info');
        await new Promise(r => setTimeout(r, 50));

        try {
            const blob = generateWavBlob(freqs, duration);
            const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);

            if (fileHandle) {
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                showToast(`Файл сохранён: «${fileHandle.name}» (${sizeMb} МБ)`, 'success');
            } else {
                downloadBlobFallback(blob, fileName);
                showToast(`Файл сохранён: «${fileName}» (${sizeMb} МБ)`, 'success');
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

    /* ============================================================
       ФОРМА ДОБАВЛЕНИЯ / КАТЕГОРИИ
       ============================================================ */

    function populateCategorySelect() {
        const sel = document.getElementById('nozodCategory');
        if (!sel) return;
        const cats = (nozodData && nozodData.categories) || {};
        const prev = sel.value;
        sel.innerHTML = '';

        // 'other' всегда первый; остальные — в порядке объявления в JSON
        const order = ['other', ...Object.keys(cats).filter(k => k !== 'other')];
        for (const key of order) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = cats[key] || key;
            sel.appendChild(opt);
        }
        sel.value = order.includes(prev) ? prev : 'other';
    }

    function openAddNozodModal() {
        const modalEl = document.getElementById('nozodModal');
        if (!modalEl) return;
        const nameEl = document.getElementById('nozodName');
        const freqsEl = document.getElementById('nozodFreqs');
        const catEl = document.getElementById('nozodCategory');
        const descEl = document.getElementById('nozodDescription');
        const funcEl = document.getElementById('nozodFunction');
        const srcEl = document.getElementById('nozodSource');

        if (nameEl) nameEl.value = '';
        if (freqsEl) freqsEl.value = '';
        if (descEl) descEl.value = '';
        if (funcEl) funcEl.value = '';
        if (srcEl) srcEl.value = 'CALF';

        populateCategorySelect();
        if (catEl) catEl.value = 'other';

        const m = (window.bootstrap && window.bootstrap.Modal)
            ? window.bootstrap.Modal.getOrCreateInstance(modalEl)
            : null;
        if (m) m.show();
        if (nameEl) setTimeout(() => nameEl.focus(), 200);
    }

    // === ИЗМЕНЕНО: стало async + await showConfirm ===
    async function handleSaveNewNozod() {
        const nameEl = document.getElementById('nozodName');
        const freqsEl = document.getElementById('nozodFreqs');
        const catEl = document.getElementById('nozodCategory');
        const descEl = document.getElementById('nozodDescription');
        const funcEl = document.getElementById('nozodFunction');
        const srcEl = document.getElementById('nozodSource');

        const candidate = normalizeUserNozode({
            name: nameEl ? nameEl.value : '',
            frequencies: freqsEl ? freqsEl.value : '',
            description: descEl ? descEl.value : '',
            function: funcEl ? funcEl.value : '',
            category: catEl ? catEl.value : 'other',
            source: srcEl ? srcEl.value : 'CALF'
        });

        if (!candidate) {
            alert('Введите название нозода');
            if (nameEl) nameEl.focus();
            return;
        }
        if (parseFreqs(candidate.frequencies).length === 0) {
            alert('Введите хотя бы одну корректную частоту (положительное число)');
            if (freqsEl) freqsEl.focus();
            return;
        }

        // Категория должна существовать в базе — иначе 'other'
        const cats = (nozodData && nozodData.categories) || {};
        if (!Object.prototype.hasOwnProperty.call(cats, candidate.category)) {
            candidate.category = 'other';
        }

        // Проверка конфликта с базой
        const baseNames = new Set(
            ((nozodData && nozodData.remedies) || [])
                .map(r => (r && r.name) ? String(r.name) : '')
        );
        if (baseNames.has(candidate.name)) {
            alert('Нозод с таким названием уже есть в базе программы. Измените название.');
            return;
        }

        const existingIdx = localNozodes.findIndex(r => r.name === candidate.name);
        if (existingIdx !== -1) {
            // === ИЗМЕНЕНО: await showConfirm ===
            const replace = await showConfirm(`Нозод «${candidate.name}» уже существует. Заменить?`);
            if (!replace) return;
            localNozodes[existingIdx] = candidate;
        } else {
            if (localNozodes.length >= MAX_LOCAL_NOZODS) {
                alert(`Достигнут лимит (${MAX_LOCAL_NOZODS}) локальных нозодов. Удалите ненужные.`);
                return;
            }
            localNozodes.push(candidate);
        }

        if (!saveLocalNozodes()) return;

        // Сброс поиска, чтобы новый нозод был виден
        currentSearch = '';
        const searchInput = document.getElementById('nozodSearchInput');
        if (searchInput) searchInput.value = '';

        renderAccordion();

        const modalEl = document.getElementById('nozodModal');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            const m = window.bootstrap.Modal.getInstance(modalEl);
            if (m) m.hide();
        }

        showToast('Нозод сохранён', 'success');
    }

    // === ИЗМЕНЕНО: стало async + await showConfirm ===
    async function handleDeleteNozod(name) {
        if (!name) return;
        const idx = localNozodes.findIndex(r => r.name === name);
        if (idx === -1) {
            showToast('Этот нозод нельзя удалить (база программы)', 'warning');
            return;
        }
        const ok = await showConfirm(
            `Удалить нозод «${name}»?\nОн будет удалён из локального хранилища.`
        );
        if (!ok) return;
        localNozodes.splice(idx, 1);
        if (saveLocalNozodes()) {
            renderAccordion();
            showToast('Нозод удалён', 'success');
        }
    }

    /* ============================================================
       ОБРАБОТЧИКИ
       ============================================================ */

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const name = btn.getAttribute('data-name') || '';
        const source = btn.getAttribute('data-source') || '';
        const rawFreqs = btn.getAttribute('data-freqs') || '';

        if (action === 'play') {
            e.preventDefault();
            if (typeof stopAll === 'function') stopAll();
            if (!rawFreqs) return;

            try {
                let categoryTarget = '';
                const card = btn.closest('.nozode-item');
                if (card) {
                    const body = card.closest('.accordion-body');
                    if (body) {
                        const item = body.closest('.accordion-item');
                        if (item) {
                            const header = item.querySelector('.accordion-button');
                            if (header) categoryTarget = header.getAttribute('data-bs-target') || '';
                        }
                    }
                }
                sessionStorage.setItem('atlas_return', JSON.stringify({
                    page: 'nozod',
                    category: categoryTarget,
                    name: name,
                    scrollY: window.scrollY || window.pageYOffset || 0
                }));
            } catch (err) { /* ignore */ }

            const params = new URLSearchParams({
                freqs: rawFreqs,
                name: name,
                autoPlay: '1'
            });
            window.location.href = 'LUXE METALLICS.html?' + params.toString();

        } else if (action === 'save') {
            e.preventDefault();
            const freqs = parseFreqs(rawFreqs);
            saveWav(name, source, freqs, btn);

        } else if (action === 'delete') {
            e.preventDefault();
            handleDeleteNozod(name);
        }
    });

    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') stopAll();
    });

    /* ---------- Инициализация UI ---------- */

    function initUI() {
        const addBtn = document.getElementById('btn-add-nozod');
        if (addBtn) addBtn.addEventListener('click', openAddNozodModal);

        const saveBtn = document.getElementById('saveNozodBtn');
        if (saveBtn) saveBtn.addEventListener('click', handleSaveNewNozod);

        const searchInput = document.getElementById('nozodSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearch = String(e.target.value || '');
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    if (nozodData) renderAccordion();
                }, 180);
            });
        }

        // Enter в полях формы = сохранение
        ['nozodName', 'nozodFreqs', 'nozodSource'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNewNozod();
                    }
                });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

    /* ---------- Публичный API (совместимость с app.js) ---------- */

    window.Nozod = {
        stopAll: stopAll,
        load: loadNozodes,
        // Перечитать локальные данные без перезагрузки base (на случай cross-tab)
        reloadLocal: () => {
            localNozodes = loadLocalNozodes();
            renderAccordion();
        }
    };
})();