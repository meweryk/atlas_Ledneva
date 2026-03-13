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
    let updatedDescriptionsCount = 0;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            localData = JSON.parse(saved);
        } catch (e) {
            console.error('Ошибка парсинга localStorage', e);
        }
    }

    try {
        const response = await fetch('point.json');
        jsonData = await response.json();
    } catch (error) {
        console.error('Ошибка загрузки point.json', error);
    }

    // Функция для очистки имени от альтернативных названий (после /)
    const normalizeName = (name) => name.split('/')[0].trim().toLowerCase();

    const mergedMap = new Map();
    // 1. Сначала берем JSON как основу
    jsonData.forEach(p => mergedMap.set(p.name, p));

    // 2. Сливаем с локальными данными
    localData.forEach(localPathology => {
        if (mergedMap.has(localPathology.name)) {
            const baseP = mergedMap.get(localPathology.name);

            localPathology.point.forEach(lp => {
                const normLocalName = normalizeName(lp.name);
                
                // Ищем точку в JSON, сравнивая нормализованные имена
                const basePoint = baseP.point.find(bp => normalizeName(bp.name) === normLocalName);
                
                if (basePoint) {
                    const localDesc = (lp.description || "").trim();
                    const baseDesc = (basePoint.description || "").trim();

                    // Если в локальной базе описание короткое — берем из JSON
                    if (localDesc.length < 10 && baseDesc.length >= 10) {
                        console.log(`Обновлено описание для: ${lp.name} (совпало с ${basePoint.name})`);
                        lp.description = baseDesc;
                        updatedDescriptionsCount++;
                    }

                    // Если в локальной базе точка называется короче (без /), 
                    // обновляем её имя до полного из JSON
                    if (lp.name !== basePoint.name && basePoint.name.includes('/')) {
                        console.log(`Обновлено имя точки: ${lp.name} -> ${basePoint.name}`);
                        lp.name = basePoint.name;
                    }

                    // Подтягиваем фото, если их нет
                    if ((!lp.images || lp.images.length === 0) && basePoint.images) {
                        lp.images = basePoint.images;
                    }
                }
            });
            mergedMap.set(localPathology.name, localPathology);
        } else {
            mergedMap.set(localPathology.name, localPathology);
        }
    });

    console.log(`Итог: обновлено ${updatedDescriptionsCount} описаний.`);

    pathologiesData = Array.from(mergedMap.values());
    pathologiesData.sort((a, b) => a.name.localeCompare(b.name));

    afterDataChange(); // Сохранит исправленное в LocalStorage
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

// ==============Навигация=============
function showPage(page) {
    const mainPage = document.getElementById('mainPage');
    const searchPage = document.getElementById('searchPage');
    const historyPage = document.getElementById('historyPage');
    const aboutPage = document.getElementById('aboutPage'); // добавить
    if (!mainPage || !searchPage || !historyPage || !aboutPage) return;
    
    mainPage.style.display = 'none';
    searchPage.style.display = 'none';
    historyPage.style.display = 'none';
    aboutPage.style.display = 'none';
    
    if (page === 'main') {
        updateMainPageGreeting();
        mainPage.style.display = 'block';
        currentPage = 'main';
    } else if (page === 'search') {
        searchPage.style.display = 'block';
        currentPage = 'search';
        renderPathologyCheckboxes();
    } else if (page === 'history') {
        historyPage.style.display = 'block';
        currentPage = 'history';
        renderHistoryPage();
    } else if (page === 'about') {
        aboutPage.style.display = 'block';
        currentPage = 'about';
        // Получаем версию из Service Worker и обновляем элемент
        getVersionFromSW().then(version => {
            const versionEl = document.getElementById('appVersion');
            if (versionEl) {
                versionEl.textContent = version || 'не определена';
            }
        });
    }
}

// Обновляем initNavigation для добавления обработчика истории
function initNavigation() {
    const navLinks = {
        home: document.getElementById('nav-home'),
        pathologies: document.getElementById('nav-pathologies'), // оставляем, но переименовали в истории? Лучше заменить
        points: document.getElementById('nav-points'),
        search: document.getElementById('nav-search'),
        about: document.getElementById('nav-about'),
        history: document.getElementById('nav-history') // новый пункт
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
    if (navLinks.history) {
        navLinks.history.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveNav('history');
            showPage('history');
            collapseNavbar();
        });
    }
    // Остальные можно оставить как есть (или убрать)
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
            showPage('about');
            collapseNavbar();
        });
    }
}

// Обновляем setActiveNav, чтобы включить 'history'
function setActiveNav(activeId) {
    const navLinks = ['home', 'pathologies', 'points', 'search', 'about', 'history'];
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
    
    // ===== Галочка для добавления в историю =====
    const oldCheck = document.getElementById('pointCheckButton');
    if (oldCheck) oldCheck.remove();
    
    // Галочка отображается только если есть изображения
    if (carouselContainer.style.display !== 'none') {
        // Создаём кнопку-галочку
        const checkBtn = document.createElement('div');
        checkBtn.id = 'pointCheckButton';
        checkBtn.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            z-index: 10;
            cursor: pointer;
            font-size: 2.5rem;
            line-height: 1;
            color: rgba(40, 167, 69, 0.3);
            transition: color 0.2s;
            background: rgba(255,255,255,0.7);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        checkBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
        
        // Определяем начальный цвет в зависимости от того, добавлена ли точка активным пользователем
        const activeUser = getActiveUser();
        const oneHour = 60 * 60 * 1000; // 1 час
        let isFresh = false;
        if (activeUser) {
            const lastTime = getLastRecordTime(point.name, activeUser.id);
            const now = Date.now();
            isFresh = lastTime && (now - lastTime) < oneHour;
        }
        checkBtn.style.color = isFresh ? 'rgba(40, 167, 69, 1)' : 'rgba(40, 167, 69, 0.3)';
        
        // Обработчик клика
        checkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            let currentActive = getActiveUser();
            
            // Если нет активного пользователя, предлагаем создать
            if (!currentActive) {
                const name = prompt('Введите ваше имя для добавления в историю:');
                if (!name || name.trim() === '') return;
                const newUser = addUser(name.trim());
                if (newUser) {
                    currentActive = newUser;
                    alert(`Здравствуй, ${newUser.name}! Теперь ты активный пользователь.`);
                } else {
                    return;
                }
            }
            
            // Проверяем, не добавлялась ли точка менее часа назад
            const last = getLastRecordTime(point.name, currentActive.id);
            const now = Date.now();
            if (last && (now - last) < oneHour) {
                alert('Эта точка уже была добавлена в течение последнего часа. Попробуйте позже.');
                return;
            }
            
            // Добавляем запись
            const newRecord = addRecord({
                pointName: point.name,
                pathologyName: pathology.name,
                dispersion: point.dispersion
            });
            
            if (newRecord) {
                checkBtn.style.color = 'rgba(40, 167, 69, 1)';
                alert('Точка добавлена в историю');
            }
        });
        
        // Помещаем кнопку в контейнер карусели
        const pointCarousel = document.getElementById('pointCarousel');
        if (pointCarousel) {
            pointCarousel.style.position = 'relative';
            pointCarousel.appendChild(checkBtn);
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

// ==================== История (History Manager) ====================
// Получение версии из Service Worker
async function getVersionFromSW() {
    if (!navigator.serviceWorker.controller) return null;
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => resolve(e.data.version);
        navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
}

const HISTORY_STORAGE_KEY = 'atlas_history';

// Структура по умолчанию
const defaultHistory = {
    users: [], // [{ id: string, name: string, isActive: boolean }]
    records: [] // [{ id: string, userId: string, pointName: string, pathologyName: string, shortArea: string, timestamp: number }]
};

// Возвращает timestamp последней записи точки для данного пользователя или null
function getLastRecordTime(pointName, userId) {
    const history = loadHistory();
    const userRecords = history.records.filter(r => r.userId === userId && r.pointName === pointName);
    if (userRecords.length === 0) return null;
    // Сортируем по убыванию времени и берём самую свежую
    userRecords.sort((a, b) => b.timestamp - a.timestamp);
    return userRecords[0].timestamp;
}

// Загрузка истории из localStorage
function loadHistory() {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Миграция: добавляем поле measurements, если его нет
            if (parsed.records && Array.isArray(parsed.records)) {
                let changed = false;
                parsed.records.forEach(rec => {
                    if (!rec.measurements) {
                        rec.measurements = { elediya: null, fol: null, saved: false };
                        changed = true;
                    }
                });
                if (changed) {
                    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(parsed));
                }
            }
            return parsed;
        } catch (e) {
            console.error('Ошибка парсинга истории', e);
            return defaultHistory;
        }
    }
    return defaultHistory;
}

// Сохранение истории
function saveHistory(history) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

// Получить активного пользователя (или null)
function getActiveUser() {
    const history = loadHistory();
    const active = history.users.find(u => u.isActive === true);
    return active || null;
}

// Установить активного пользователя по ID
function setActiveUser(userId) {
    const history = loadHistory();
    let changed = false;
    history.users.forEach(u => {
        if (u.id === userId) {
            if (!u.isActive) {
                u.isActive = true;
                changed = true;
            }
        } else {
            if (u.isActive) {
                u.isActive = false;
                changed = true;
            }
        }
    });
    if (changed) {
        saveHistory(history);
    }
    return changed;
}

// Добавить нового пользователя (если пользователей нет, он становится активным)
function addUser(name) {
    if (!name || name.trim() === '') return null;
    const history = loadHistory();
    // Снимаем активность со всех текущих пользователей
    history.users.forEach(u => u.isActive = false);
    const newUser = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        isActive: true // новый пользователь становится активным
    };
    history.users.push(newUser);
    saveHistory(history);
    return newUser;
}

// Удалить пользователя и все его записи
function deleteUser(userId) {
    const history = loadHistory();
    // Удаляем записи пользователя
    history.records = history.records.filter(r => r.userId !== userId);
    // Удаляем пользователя
    const index = history.users.findIndex(u => u.id === userId);
    if (index !== -1) {
        const wasActive = history.users[index].isActive;
        history.users.splice(index, 1);
        // Если был активным и есть другие пользователи, делаем первого активным
        if (wasActive && history.users.length > 0) {
            history.users[0].isActive = true;
        }
        saveHistory(history);
        return true;
    }
    return false;
}

// Добавить запись для активного пользователя
function addRecord(pointData) {
    const { pointName, pathologyName, dispersion } = pointData;
    if (!pointName || !pathologyName) return null;
    
    const activeUser = getActiveUser();
    if (!activeUser) return null;
    
    let shortArea = 'другое';
    if (dispersion && dispersion.includes(':')) {
        shortArea = dispersion.split(':')[0].trim();
    }
    
    const newRecord = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        userId: activeUser.id,
        pointName: pointName,
        pathologyName: pathologyName,
        shortArea: shortArea,
        timestamp: Date.now(),
        measurements: {
            elediya: null,
            fol: null,
            saved: false
        }
    };
    
    const history = loadHistory();
    history.records.push(newRecord);
    saveHistory(history);
    return newRecord;
}

// Получить записи для конкретного пользователя (отсортированы по убыванию времени)
function getRecordsByUser(userId) {
    const history = loadHistory();
    return history.records
        .filter(r => r.userId === userId)
        .sort((a, b) => b.timestamp - a.timestamp);
}

// Получить всех пользователей
function getAllUsers() {
    const history = loadHistory();
    return history.users;
}

// ==================== Страница истории ====================
function renderHistoryPage() {
    const users = getAllUsers().sort((a, b) => a.name.localeCompare(b.name)); // сортировка по алфавиту
    const accordion = document.getElementById('usersAccordion');
    const recordsContainer = document.getElementById('userRecordsContainer');
    const selectedUserNameEl = document.getElementById('selectedUserName');
    const recordsListEl = document.getElementById('recordsList');
    
    if (!accordion || !recordsContainer || !selectedUserNameEl || !recordsListEl) return;
    
    accordion.innerHTML = '';
    
    if (users.length === 0) {
        accordion.innerHTML = '<p class="text-muted">Нет пользователей. Добавьте имя.</p>';
        recordsContainer.style.display = 'none';
        return;
    }
    
    // Строим аккордеон только с заголовками (без тел)
    users.forEach((user, index) => {
        const itemId = `user-item-${index}`;
        const isActiveClass = user.isActive ? 'active-user' : '';
        
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="heading-user-${index}">
                <button class="accordion-button collapsed ${isActiveClass}" type="button" data-bs-toggle="collapse" data-bs-target="#${itemId}" aria-expanded="false" aria-controls="${itemId}" data-user-id="${user.id}">
                    <span class="me-2">${user.name}</span>
                    ${user.isActive ? '<span class="badge bg-success">Активен</span>' : ''}
                    <i class="bi bi-trash ms-auto delete-user" data-user-id="${user.id}" style="cursor:pointer; color:#dc3545;" onclick="event.stopPropagation()"></i>
                </button>
            </h2>
            <div id="${itemId}" class="accordion-collapse collapse" aria-labelledby="heading-user-${index}" data-bs-parent="#usersAccordion">
                <div class="accordion-body p-2">
                    <!-- тело пустое -->
                </div>
            </div>
        `;
        accordion.appendChild(accordionItem);
    });
    
    // Обработчик клика по заголовку (кнопке) – делает пользователя активным, обнуляет таймер, показывает записи
    document.querySelectorAll('#usersAccordion .accordion-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Игнорируем, если клик по иконке удаления (уже обработано)
            if (e.target.closest('.delete-user')) return;
            
            const userId = btn.dataset.userId;
            if (!userId) return;
            
            // Устанавливаем активного пользователя
            setActiveUser(userId);
            updateMainPageGreeting();
            
            // Обновляем отображение активного
            updateActiveUserDisplay();
            
            // Показываем записи этого пользователя
            showUserRecords(userId);
            
            // Сворачиваем все открытые панели аккордеона
            const openCollapse = document.querySelector('#usersAccordion .accordion-collapse.show');
            if (openCollapse) {
                const collapse = bootstrap.Collapse.getInstance(openCollapse);
                if (collapse) collapse.hide();
            }
        });
    });
    
    // Обработчики удаления пользователя (иконка)
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = btn.dataset.userId;
            if (confirm('Удалить пользователя и все его записи?')) {
                deleteUser(userId);
                renderHistoryPage(); // перерендерить всю страницу
            }
        });
    });
    
    // Показываем записи активного пользователя (если есть)
    const activeUser = getActiveUser();
    if (activeUser) {
        showUserRecords(activeUser.id);
        recordsContainer.style.display = 'block';
        selectedUserNameEl.textContent = `Записи пользователя: ${activeUser.name}`;
    } else {
        recordsContainer.style.display = 'none';
    }
    
    updateActiveUserDisplay();
}

function showUserRecords(userId) {
    const selectedUserNameEl = document.getElementById('selectedUserName');
    const recordsListEl = document.getElementById('recordsList');
    if (!selectedUserNameEl || !recordsListEl) return;
    
    const user = getAllUsers().find(u => u.id === userId);
    selectedUserNameEl.textContent = user ? `Записи пользователя: ${user.name}` : '';
    
    const records = getRecordsByUser(userId);
    if (records.length === 0) {
        recordsListEl.innerHTML = '<p class="text-muted">Нет записей</p>';
        return;
    }
    
    // Группировка по дате
    const groupedByDate = {};
    records.forEach(rec => {
        const date = new Date(rec.timestamp);
        const dateStr = date.toLocaleDateString('ru-RU');
        if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
        groupedByDate[dateStr].push(rec);
    });
    
    // Сортировка дат (новые сверху)
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
        const [d1, m1, y1] = a.split('.').map(Number);
        const [d2, m2, y2] = b.split('.').map(Number);
        const dateA = new Date(y1, m1 - 1, d1);
        const dateB = new Date(y2, m2 - 1, d2);
        return dateB - dateA;
    });
    
    let html = '';
    sortedDates.forEach(dateStr => {
        const dayRecords = groupedByDate[dateStr];
        
        // Группировка по патологии
        const byPathology = {};
        dayRecords.forEach(rec => {
            if (!byPathology[rec.pathologyName]) byPathology[rec.pathologyName] = [];
            byPathology[rec.pathologyName].push(rec);
        });
        
        const sortedPathologies = Object.keys(byPathology).sort((a, b) => a.localeCompare(b));
        
        const dateId = 'date-' + dateStr.replace(/\./g, '-');
        
        html += `
            <div class="date-group mb-2">
                <div class="date-header p-2 bg-light border rounded" data-target="${dateId}" style="cursor: pointer; user-select: none;">
                    <strong>${dateStr}</strong>
                </div>
                <div id="${dateId}" class="date-records collapse">
        `;
        
        sortedPathologies.forEach(pathology => {
            const pathRecords = byPathology[pathology];
            pathRecords.sort((a, b) => a.timestamp - b.timestamp);
            
            html += `<div class="ms-3 mt-2"><em>${pathology}</em></div>`;
            html += `<div class="ms-4">`;
            
            pathRecords.forEach(rec => {
                const time = new Date(rec.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const shortName = rec.pointName.split('/')[0].trim();
                const isSaved = rec.measurements && rec.measurements.saved;
                const elediyaVal = rec.measurements?.elediya !== null ? rec.measurements.elediya : '';
                const folVal = rec.measurements?.fol !== null ? rec.measurements.fol : '';
                
                let folClass = '';
                if (isSaved && folVal !== '') {
                    const num = parseFloat(folVal);
                    if (!isNaN(num)) {
                        if (num >= 0 && num <= 20) folClass = 'fol-range-0-20';
                        else if (num >= 21 && num <= 28) folClass = 'fol-range-21-28';
                        else if (num >= 29 && num <= 38) folClass = 'fol-range-29-38';
                        else if (num >= 39 && num <= 48) folClass = 'fol-range-39-48';
                        else if (num >= 49 && num <= 65) folClass = 'fol-range-49-65';
                        else if (num >= 66 && num <= 80) folClass = 'fol-range-66-80';
                        else if (num >= 81 && num <= 100) folClass = 'fol-range-81-100';
                    }
                }
                
                html += `
                    <div class="record-row mb-2 p-1 border rounded" data-record-id="${rec.id}">
                        <div class="d-flex align-items-center flex-wrap">
                            <span class="point-history-link me-2" data-point-name="${rec.pointName}" data-pathology="${rec.pathologyName}" style="cursor:pointer; color:#0d6efd; text-decoration:underline;">
                                <strong>${shortName}</strong> <span class="text-muted">(${time})</span>
                            </span>
                            <div class="d-flex gap-2 ms-auto">
                                <input type="number" class="form-control form-control-sm elediya-input" style="width: 80px;" placeholder="эледия" value="${elediyaVal}" ${isSaved ? 'disabled' : ''}>
                                <input type="number" class="form-control form-control-sm fol-input ${folClass}" style="width: 80px;" placeholder="фоль" value="${folVal}" ${isSaved ? 'disabled' : ''}>
                                ${!isSaved ? '<button class="btn btn-sm btn-success save-measurement">save</button>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        });
        
        html += `</div></div>`;
    });
    
    recordsListEl.innerHTML = html;
    
    // Обработчики сворачивания/разворачивания дат
    document.querySelectorAll('.date-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.target;
            const targetDiv = document.getElementById(targetId);
            if (targetDiv) {
                targetDiv.classList.toggle('collapse');
                targetDiv.classList.toggle('show');
            }
        });
    });
    
    // Обработчики сохранения измерений
    document.querySelectorAll('.save-measurement').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const recordRow = btn.closest('.record-row');
            if (!recordRow) return;
            const recordId = recordRow.dataset.recordId;
            const elediyaInput = recordRow.querySelector('.elediya-input');
            const folInput = recordRow.querySelector('.fol-input');
            
            const elediyaVal = elediyaInput.value.trim();
            const folVal = folInput.value.trim();
            
            if (elediyaVal === '' && folVal === '') {
                alert('Введите хотя бы одно значение');
                return;
            }
            
            const history = loadHistory();
            const record = history.records.find(r => r.id === recordId);
            if (!record) return;
            
            // Обновляем данные в localStorage
            record.measurements = {
                elediya: elediyaVal !== '' ? parseFloat(elediyaVal) : null,
                fol: folVal !== '' ? parseFloat(folVal) : null,
                saved: true
            };
            saveHistory(history);
            
            // Визуальные изменения в текущей записи
            elediyaInput.disabled = true;
            folInput.disabled = true;
            btn.remove(); // убираем кнопку save
            
            // Применяем цвет рамки к полю фоль
            if (folVal !== '') {
                const num = parseFloat(folVal);
                if (!isNaN(num)) {
                    let folClass = '';
                    if (num >= 0 && num <= 20) folClass = 'fol-range-0-20';
                    else if (num >= 21 && num <= 28) folClass = 'fol-range-21-28';
                    else if (num >= 29 && num <= 38) folClass = 'fol-range-29-38';
                    else if (num >= 39 && num <= 48) folClass = 'fol-range-39-48';
                    else if (num >= 49 && num <= 65) folClass = 'fol-range-49-65';
                    else if (num >= 66 && num <= 80) folClass = 'fol-range-66-80';
                    else if (num >= 81 && num <= 100) folClass = 'fol-range-81-100';
                    
                    folInput.classList.add(folClass);
                }
            }
        });
    });
    
    // Обработчики открытия карточки точки
    document.querySelectorAll('.point-history-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            const pointName = link.dataset.pointName;
            const pathologyName = link.dataset.pathology;
            const pathology = pathologiesData.find(p => p.name === pathologyName);
            const point = pathology?.point.find(p => p.name === pointName);
            if (point) showPointCard(pathology, point);
        });
    });
}

function updateMainPageGreeting() {
    const titleEl = document.getElementById('mainPageTitle');
    if (!titleEl) return;
    const activeUser = getActiveUser();
    if (activeUser) {
        titleEl.textContent = `Добро пожаловать в Атлас, ${activeUser.name}`;
    } else {
        titleEl.textContent = 'Добро пожаловать в Атлас';
    }
}

function updateActiveUserDisplay() {
    const activeUser = getActiveUser();
    document.querySelectorAll('#usersAccordion .accordion-button').forEach(btn => {
        const userId = btn.dataset.userId;
        if (userId === activeUser?.id) {
            btn.classList.add('active-user');
            // Добавляем бейдж, если его нет
            if (!btn.querySelector('.badge.bg-success')) {
                const nameSpan = btn.querySelector('span:first-child');
                if (nameSpan) {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-success ms-2';
                    badge.textContent = 'Активен';
                    nameSpan.insertAdjacentElement('afterend', badge);
                }
            }
        } else {
            btn.classList.remove('active-user');
            const badge = btn.querySelector('.badge.bg-success');
            if (badge) badge.remove();
        }
    });
}

// Обработчик кнопки "Добавить имя"
document.getElementById('addUserNameBtn')?.addEventListener('click', () => {
    const name = prompt('Введите имя пользователя:');
    if (name && name.trim() !== '') {
        const newUser = addUser(name.trim());
        if (newUser) {
            renderHistoryPage(); // перерисовываем страницу истории
            updateMainPageGreeting(); // обновляем приветствие на главной
            // Показываем записи нового пользователя и обновляем заголовок
            showUserRecords(newUser.id);
            document.getElementById('selectedUserName').textContent = `Записи пользователя: ${newUser.name}`;
            alert(`Здравствуй, ${newUser.name}! Все последующие записи в истории принадлежат тебе.`);
        }
    }
});