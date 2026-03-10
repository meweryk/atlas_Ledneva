// Глобальные переменные
let pathologiesData = [];
let pathologyAccordion = document.getElementById('pathologyAccordion');
let pointModal = new bootstrap.Modal(document.getElementById('pointModal'));
let viewPointModal = new bootstrap.Modal(document.getElementById('viewPointModal'));
let currentEditPathology = null;
let currentEditIndex = -1;
let currentPage = 'main';
let navbarCollapse = document.getElementById('navbarNav');

// Ключ для localStorage
const STORAGE_KEY = 'atlas_ledneva_data';

// Загрузка данных при старте
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initNavigation();
});

async function loadData() {
    let localData = [];
    let jsonData = [];

    // 1. Загружаем из localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            localData = JSON.parse(saved);
        } catch (e) {
            console.error('Ошибка парсинга localStorage', e);
        }
    }

    // 2. Загружаем свежий point.json (Service Worker обеспечит кеш, если нет сети)
    try {
        const response = await fetch('point.json');
        jsonData = await response.json();
    } catch (error) {
        console.error('Ошибка загрузки point.json', error);
    }

    // 3. Умное объединение
    // Создаем карту на основе JSON (базовые данные)
    const mergedMap = new Map();
    jsonData.forEach(p => mergedMap.set(p.name, p));

    // Проходим по локальным данным и дополняем их или обновляем базу
    localData.forEach(localPathology => {
        if (mergedMap.has(localPathology.name)) {
            const basePathology = mergedMap.get(localPathology.name);

            // Сливаем точки внутри патологии
            localPathology.point.forEach(localPoint => {
                const basePoint = basePathology.point.find(bp => bp.name === localPoint.name);
                
                if (basePoint) {
                    // Если в локальной записи нет описания, берем из базы
                    if (!localPoint.description || localPoint.description.trim() === "") {
                        localPoint.description = basePoint.description;
                    }
                    // Если в локальной записи нет фото, берем из базы
                    if (!localPoint.images || localPoint.images.length === 0) {
                        localPoint.images = basePoint.images;
                    }
                }
            });
            // Обновляем запись в карте локальной версией (уже дополненной)
            mergedMap.set(localPathology.name, localPathology);
        } else {
            // Если этой патологии вообще нет в JSON, просто добавляем её из локальных
            mergedMap.set(localPathology.name, localPathology);
        }
    });

    pathologiesData = Array.from(mergedMap.values());
    pathologiesData.sort((a, b) => a.name.localeCompare(b.name));

    // 4. Отрисовка и сохранение дополненного результата
    renderAccordion();
    fillPathologyDatalist();
    saveToLocalStorage(); 
    showPage('main');
}


// Сохранение в localStorage
function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pathologiesData));
}

// Функция, которая вызывается после любых изменений (добавление, редактирование, импорт)
function afterDataChange() {
    renderAccordion();
    fillPathologyDatalist();
    saveToLocalStorage();
}

// Навигация
function initNavigation() {
    const navLinks = {
        home: document.getElementById('nav-home'),
        pathologies: document.getElementById('nav-pathologies'),
        points: document.getElementById('nav-points'),
        search: document.getElementById('nav-search'),
        about: document.getElementById('nav-about')
    };

    const collapseNavbar = () => {
        if (navbarCollapse && navbarCollapse.classList.contains('show')) {
            const bsCollapse = new bootstrap.Collapse(navbarCollapse, { toggle: false });
            bsCollapse.hide();
        }
    };

    if (navLinks.home) {
        navLinks.home.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveNav('home');
            showPage('main');
            collapseNavbar();
        });
    }
    if (navLinks.search) {
        navLinks.search.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveNav('search');
            showPage('search');
            collapseNavbar();
        });
    }
    if (navLinks.pathologies) {
        navLinks.pathologies.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveNav('pathologies');
            alert('Страница патологий в разработке');
            collapseNavbar();
        });
    }
    if (navLinks.points) {
        navLinks.points.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveNav('points');
            alert('Страница точек в разработке');
            collapseNavbar();
        });
    }
    if (navLinks.about) {
        navLinks.about.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveNav('about');
            alert('О проекте');
            collapseNavbar();
        });
    }
}

function setActiveNav(activeId) {
    const navLinks = ['home', 'pathologies', 'points', 'search', 'about'];
    navLinks.forEach(id => {
        const el = document.getElementById(`nav-${id}`);
        if (el) {
            if (id === activeId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    });
}

function showPage(page) {
    const mainPage = document.getElementById('mainPage');
    const searchPage = document.getElementById('searchPage');
    if (!mainPage || !searchPage) return;
    if (page === 'main') {
        mainPage.style.display = 'block';
        searchPage.style.display = 'none';
        currentPage = 'main';
    } else if (page === 'search') {
        mainPage.style.display = 'none';
        searchPage.style.display = 'block';
        currentPage = 'search';
        renderPathologyCheckboxes();
    }
}

// Работа с формами
function fillPathologyDatalist() {
    const datalist = document.getElementById('pathologyList');
    if (!datalist) return;
    datalist.innerHTML = '';
    pathologiesData.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        datalist.appendChild(option);
    });
}

// Рендер аккордеона
function renderAccordion() {
    if (!pathologyAccordion) return;
    pathologyAccordion.innerHTML = '';
    pathologiesData.forEach((pathology, pathIdx) => {
        const itemId = `collapse-${pathIdx}`;
        const headingId = `heading-${pathIdx}`;

        const pointsByArea = {};
        pathology.point.forEach((point, pointIdx) => {
            let area = 'другое';
            if (point.dispersion && point.dispersion.includes(':')) {
                area = point.dispersion.split(':')[0].trim();
            }
            if (!pointsByArea[area]) pointsByArea[area] = [];
            pointsByArea[area].push({ point, pointIdx });
        });

        const sortedAreas = Object.keys(pointsByArea).sort();
        let pointsHtml = '';
        sortedAreas.forEach(area => {
            pointsHtml += `<div class="mt-2"><strong>${area}:</strong></div>`;
            pointsByArea[area].forEach(({ point, pointIdx }) => {
                pointsHtml += `
                    <div class="point-item">
                        <span class="point-name" data-path-index="${pathIdx}" data-point-idx="${pointIdx}">• ${point.name}</span>
                        <i class="bi bi-pencil-square point-edit" data-path-index="${pathIdx}" data-point-idx="${pointIdx}"></i>
                    </div>
                `;
            });
        });

        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="${headingId}">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${itemId}" aria-expanded="false" aria-controls="${itemId}">
                    ${pathology.name} (${pathology.point.length})
                </button>
            </h2>
            <div id="${itemId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#pathologyAccordion">
                <div class="accordion-body">${pointsHtml}</div>
            </div>
        `;
        pathologyAccordion.appendChild(accordionItem);
    });

    document.querySelectorAll('.point-name').forEach(el => {
        el.addEventListener('click', (e) => {
            const pathIdx = parseInt(el.dataset.pathIndex);
            const pointIdx = parseInt(el.dataset.pointIdx);
            const pathology = pathologiesData[pathIdx];
            const point = pathology.point[pointIdx];
            showPointCard(pathology, point);
        });
    });

    document.querySelectorAll('.point-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const pathIdx = parseInt(el.dataset.pathIndex);
            const pointIdx = parseInt(el.dataset.pointIdx);
            const pathology = pathologiesData[pathIdx];
            const point = pathology.point[pointIdx];
            openEditModal(pathology, pointIdx, point);
        });
    });
}

// Просмотр карточки точки
function showPointCard(pathology, point) {
    const titleEl = document.getElementById('viewPointTitle');
    const dispEl = document.getElementById('viewDispersion');
    const descEl = document.getElementById('viewDescription');
    if (!titleEl || !dispEl || !descEl) return;
    titleEl.textContent = point.name;
    dispEl.textContent = point.dispersion;
    descEl.textContent = point.description || '—';

    let images = [];
    if (point.images && Array.isArray(point.images) && point.images.length > 0) {
        images = point.images;
    } else if (point.images && typeof point.images === 'string') {
        images = point.images.split(',').map(s => s.trim());
    } else if (pathology.links && pathology.links.length > 0) {
        images = pathology.links;
    }

    const carouselContainer = document.getElementById('carouselContainer');
    const carouselInner = document.getElementById('carouselInner');
    const prevBtn = document.querySelector('.carousel-control-prev');
    const nextBtn = document.querySelector('.carousel-control-next');

    if (!carouselContainer || !carouselInner || !prevBtn || !nextBtn) return;

    if (images.length === 0) {
        carouselContainer.style.display = 'none';
    } else {
        carouselContainer.style.display = 'block';
        carouselInner.innerHTML = '';
        images.forEach((src, idx) => {
            const activeClass = idx === 0 ? 'active' : '';
            const slide = document.createElement('div');
            slide.className = `carousel-item ${activeClass}`;
            slide.innerHTML = `<img src="${src}" class="d-block w-100" alt="Фото точки">`;
            carouselInner.appendChild(slide);
        });

        if (images.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = '';
            nextBtn.style.display = '';

            const carousel = document.getElementById('pointCarousel');
            let touchStartX = 0;
            carousel.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            carousel.addEventListener('touchend', (e) => {
                const touchEndX = e.changedTouches[0].screenX;
                const threshold = 50;
                const instance = bootstrap.Carousel.getInstance(carousel);
                if (instance) {
                    if (touchEndX < touchStartX - threshold) instance.next();
                    else if (touchEndX > touchStartX + threshold) instance.prev();
                }
            }, { passive: true });
        }
    }

    viewPointModal.show();
}

// Открыть модалку редактирования
function openEditModal(pathology, pointIdx, point) {
    const fields = {
        pointPathology: pathology.name,
        pointName: point.name,
        pointDispersion: point.dispersion,
        pointDescription: point.description || '',
        pointImages: point.images ? point.images.join(', ') : '',
        editPathology: pathology.name,
        editIndex: pointIdx
    };
    for (let [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }
    document.getElementById('pointModalLabel').textContent = 'Редактировать точку';
    currentEditPathology = pathology;
    currentEditIndex = pointIdx;
    pointModal.show();
}

// Открыть модалку добавления
function openAddModal() {
    const ids = ['pointPathology', 'pointName', 'pointDispersion', 'pointDescription', 'pointImages', 'editPathology', 'editIndex'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('pointModalLabel').textContent = 'Добавить точку';
    currentEditPathology = null;
    currentEditIndex = -1;
    pointModal.show();
}

document.getElementById('btn-add-point')?.addEventListener('click', openAddModal);

// Сохранение точки (добавление или редактирование)
document.getElementById('savePointBtn')?.addEventListener('click', () => {
    const pathologyInput = document.getElementById('pointPathology')?.value.trim();
    const pointName = document.getElementById('pointName')?.value.trim();
    const dispersion = document.getElementById('pointDispersion')?.value.trim();
    const description = document.getElementById('pointDescription')?.value.trim();
    const imagesInput = document.getElementById('pointImages')?.value.trim();
    const editPathologyEl = document.getElementById('editPathology');
    const editIndexEl = document.getElementById('editIndex');

    if (!pathologyInput || !pointName || !dispersion) {
        alert('Заполните обязательные поля');
        return;
    }

    let images = [];
    if (imagesInput) {
        images = imagesInput.split(',').map(s => s.trim()).filter(s => s);
    }

    const newPoint = { name: pointName, dispersion, description, images };

    const editPathologyName = editPathologyEl?.value;
    const editIdx = parseInt(editIndexEl?.value);

    if (editPathologyName && !isNaN(editIdx) && editIdx >= 0) {
        const oldPathology = pathologiesData.find(p => p.name === editPathologyName);
        if (oldPathology) {
            if (oldPathology.name === pathologyInput) {
                oldPathology.point[editIdx] = newPoint;
            } else {
                oldPathology.point.splice(editIdx, 1);
                let newPathology = pathologiesData.find(p => p.name === pathologyInput);
                if (!newPathology) {
                    newPathology = { name: pathologyInput, links: [], point: [] };
                    pathologiesData.push(newPathology);
                }
                newPathology.point.push(newPoint);
            }
        }
    } else {
        let pathology = pathologiesData.find(p => p.name === pathologyInput);
        if (!pathology) {
            pathology = { name: pathologyInput, links: [], point: [] };
            pathologiesData.push(pathology);
        }
        pathology.point.push(newPoint);
    }

    pathologiesData.sort((a, b) => a.name.localeCompare(b.name));
    afterDataChange();
    pointModal.hide();
});

// Экспорт в CSV
document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const rows = [['Патология', 'Название точки', 'Расположение', 'Описание', 'Ссылки на фото']];
    pathologiesData.forEach(pathology => {
        pathology.point.forEach(point => {
            const images = point.images ? (Array.isArray(point.images) ? point.images.join(';') : point.images) : '';
            rows.push([pathology.name, point.name, point.dispersion, point.description || '', images]);
        });
    });
    const csvContent = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'atlasLed.csv';
    link.click();
});

// Импорт из CSV (с добавлением данных)
document.getElementById('btn-import-csv')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
});

document.getElementById('import-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"')));
        rows.shift(); // удаляем заголовок

        rows.forEach(row => {
            if (row.length < 4) return;
            const [pathologyName, pointName, dispersion, description, imagesStr = ''] = row;
            
            // Ищем существующую патологию
            let pathology = pathologiesData.find(p => p.name === pathologyName);
            if (!pathology) {
                // Если патологии нет, создаём новую
                pathology = { name: pathologyName, links: [], point: [] };
                pathologiesData.push(pathology);
            }

            // Проверяем, есть ли уже такая точка в этой патологии
            const existingPoint = pathology.point.find(p => p.name === pointName);
            if (!existingPoint) {
                // Если точки нет, добавляем
                const images = imagesStr ? imagesStr.split(';').map(s => s.trim()) : [];
                pathology.point.push({ name: pointName, dispersion, description, images });
            }
        });

        // Сортируем патологии и сохраняем
        pathologiesData.sort((a, b) => a.name.localeCompare(b.name));
        afterDataChange();
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
});

// --- Функции для поиска и общих точек ---

// Вспомогательная функция для получения краткого расположения из dispersion
function getShortArea(dispersion) {
    if (!dispersion) return '';
    const colonIndex = dispersion.indexOf(':');
    if (colonIndex > 0) {
        return dispersion.substring(0, colonIndex).trim();
    }
    return 'другое';
}

function renderPathologyCheckboxes() {
    const container = document.getElementById('pathologyCheckboxList');
    if (!container) return;
    container.innerHTML = '';
    pathologiesData.forEach(pathology => {
        const safeId = `chk-${pathology.name.replace(/\s+/g, '_')}`;
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
            <input class="form-check-input" type="checkbox" value="${pathology.name}" id="${safeId}">
            <label class="form-check-label" for="${safeId}">${pathology.name}</label>
        `;
        container.appendChild(div);
    });
}

document.getElementById('pointSearchInput')?.addEventListener('input', function(e) {
    const query = e.target.value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    const detailsDiv = document.getElementById('singlePointDetails');
    if (!resultsDiv || !detailsDiv) return;

    if (query === '') {
        resultsDiv.innerHTML = '';
        detailsDiv.style.display = 'none';
        return;
    }

    const allPoints = [];
    pathologiesData.forEach(pathology => {
        pathology.point.forEach(point => {
            allPoints.push({ 
                ...point, 
                pathologyName: pathology.name, 
                pathologyLinks: pathology.links || [] 
            });
        });
    });

    const matched = allPoints.filter(p => p.name.toLowerCase().includes(query));

    if (matched.length === 0) {
        resultsDiv.innerHTML = '<div class="text-muted">Ничего не найдено</div>';
        detailsDiv.style.display = 'none';
    } else if (matched.length === 1) {
        resultsDiv.innerHTML = '';
        const point = matched[0];
        const pathologiesWithPoint = pathologiesData.filter(p => 
            p.point.some(pt => pt.name === point.name)
        ).map(p => p.name);
        
        let html = `<div class="alert alert-info p-2">
            <strong>${point.name}</strong><br>
            <small>Встречается в: ${pathologiesWithPoint.join(', ')}</small><br>
            <strong>Расположение:</strong> ${point.dispersion}<br>
            <strong>Описание:</strong> ${point.description || '—'}<br>
        `;
        if (pathologiesWithPoint.length > 0) {
            const firstPathology = pathologiesData.find(p => p.name === pathologiesWithPoint[0]);
            if (firstPathology && firstPathology.links && firstPathology.links.length > 0) {
                html += `<img src="${firstPathology.links[0]}" class="img-fluid mt-2" style="max-width: 100%;" alt="Фото">`;
            }
        }
        html += `</div>`;
        detailsDiv.innerHTML = html;
        detailsDiv.style.display = 'block';
    } else {
        detailsDiv.style.display = 'none';
        let listHtml = '';
        matched.forEach(point => {
            const shortArea = getShortArea(point.dispersion);
            listHtml += `<div class="point-search-item" data-point-name="${point.name}" data-pathology="${point.pathologyName}">
                • ${point.name} <span class="text-muted">(${shortArea}, ${point.pathologyName})</span>
            </div>`;
        });
        resultsDiv.innerHTML = listHtml;

        document.querySelectorAll('.point-search-item').forEach(el => {
            el.addEventListener('click', () => {
                const pointName = el.dataset.pointName;
                const pathologyName = el.dataset.pathology;
                const pathology = pathologiesData.find(p => p.name === pathologyName);
                const point = pathology?.point.find(p => p.name === pointName);
                if (point) showPointCard(pathology, point);
            });
        });
    }
});

document.getElementById('findCommonPointsBtn')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#pathologyCheckboxList input[type="checkbox"]:checked');
    const selectedPathologies = Array.from(checkboxes).map(cb => cb.value);
    if (selectedPathologies.length === 0) {
        alert('Выберите хотя бы одну патологию');
        return;
    }

    const pointsPerPathology = selectedPathologies.map(name => {
        const path = pathologiesData.find(p => p.name === name);
        return path ? path.point.map(p => ({ name: p.name, dispersion: p.dispersion })) : [];
    });

    // Получаем список общих названий точек
    const commonPointNames = pointsPerPathology
        .map(arr => arr.map(p => p.name))
        .reduce((acc, curr) => acc.filter(name => curr.includes(name)));

    const resultDiv = document.getElementById('commonPointsResult');
    if (!resultDiv) return;
    if (commonPointNames.length === 0) {
        resultDiv.innerHTML = '<div class="text-muted">Нет общих точек</div>';
        return;
    }

    // Для каждой общей точки нужно взять её расположение из первой патологии (или любой)
    let html = '';
    commonPointNames.forEach(pointName => {
        // Найдём точку в первой выбранной патологии, чтобы получить dispersion
        const firstPathology = pathologiesData.find(p => p.name === selectedPathologies[0]);
        const point = firstPathology?.point.find(p => p.name === pointName);
        const shortArea = point ? getShortArea(point.dispersion) : '';
        html += `<div class="point-common-item" data-point-name="${pointName}" data-pathology="${selectedPathologies[0]}">
            • ${pointName} <span class="text-muted">(${shortArea})</span>
        </div>`;
    });
    resultDiv.innerHTML = html;

    document.querySelectorAll('.point-common-item').forEach(el => {
        el.addEventListener('click', () => {
            const pointName = el.dataset.pointName;
            const pathologyName = el.dataset.pathology;
            const pathology = pathologiesData.find(p => p.name === pathologyName);
            const point = pathology?.point.find(p => p.name === pointName);
            if (point) showPointCard(pathology, point);
        });
    });
});

document.getElementById('clearCommonPointsBtn')?.addEventListener('click', () => {
    document.querySelectorAll('#pathologyCheckboxList input[type="checkbox"]').forEach(cb => cb.checked = false);
    const resultDiv = document.getElementById('commonPointsResult');
    if (resultDiv) resultDiv.innerHTML = '';
});

// --- Секундомер с отладкой ---
console.log('Инициализация секундомера...');

const timerDisplay = document.getElementById('timerDisplay');
const timerStartPauseBtn = document.getElementById('timerStartPause');
const timerResetBtn = document.getElementById('timerReset');

console.log('timerDisplay:', timerDisplay);
console.log('timerStartPauseBtn:', timerStartPauseBtn);
console.log('timerResetBtn:', timerResetBtn);

let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    console.log('Обновление дисплея:', timerDisplay.textContent);
}

function toggleTimer() {
    console.log('toggleTimer вызван, текущее состояние running:', timerRunning);
    if (timerRunning) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRunning = false;
        timerStartPauseBtn.innerHTML = '<i class="bi bi-play-circle-fill"></i>';
        console.log('Таймер остановлен');
    } else {
        timerRunning = true;
        timerStartPauseBtn.innerHTML = '<i class="bi bi-pause-circle-fill"></i>';
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
        }, 1000);
        console.log('Таймер запущен');
    }
}

function resetTimer() {
    console.log('resetTimer вызван');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerRunning = false;
    timerSeconds = 0;
    updateTimerDisplay();
    timerStartPauseBtn.innerHTML = '<i class="bi bi-play-circle-fill"></i>';
    console.log('Таймер сброшен');
}

if (timerStartPauseBtn) {
    timerStartPauseBtn.addEventListener('click', (e) => {
        console.log('Клик по кнопке старт/пауза');
        toggleTimer();
    });
    console.log('Обработчик старт/пауза добавлен');
} else {
    console.error('Кнопка старт/пауза не найдена!');
}

if (timerResetBtn) {
    timerResetBtn.addEventListener('click', (e) => {
        console.log('Клик по кнопке сброса');
        resetTimer();
    });
    console.log('Обработчик сброса добавлен');
} else {
    console.error('Кнопка сброса не найдена!');
}

updateTimerDisplay();
console.log('Инициализация завершена');