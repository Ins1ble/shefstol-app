// slots.js — SCR-002: Список классов, BS-001: Фильтры (LOGIC-005, LOGIC-008)

// Глобальное состояние фильтров
const filters = {
    date_from: '',
    date_to: '',
    program_type: [],
    chef_id: [],
    only_available: false
};

let filtersApplied = false;

async function loadSlots() {
    initSlotsHeader();
    const container = document.getElementById('tab-slots');
    container.innerHTML = renderSkeleton('card', 3);
    try {
        const params = new URLSearchParams();
        if (filtersApplied) {
            if (filters.date_from) params.append('date_from', filters.date_from);
            if (filters.date_to) params.append('date_to', filters.date_to);
            filters.program_type.forEach(t => params.append('program_type', t));
            filters.chef_id.forEach(id => params.append('chef_id', id));
            if (filters.only_available) params.append('only_available', 'true');
        }
        const query = params.toString();
        const slots = await apiGet(`/slots${query ? '?' + query : ''}`);
        renderSlots(slots);
    } catch (err) {
        container.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить. Проверьте соединение.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="loadSlots()">Обновить</button></div>`;
    }
}

function renderSlots(slots) {
    const container = document.getElementById('tab-slots');
    if (slots.length === 0) {
        const message = filtersApplied
            ? 'Ничего не найдено по фильтрам'
            : 'Пока нет доступных классов';
        const actionHtml = filtersApplied
            ? '<button class="btn btn-sm btn-outline-secondary mt-2" onclick="openFilters()">Изменить фильтры</button>'
            : '';
        container.innerHTML = `<div class="text-center my-5 text-muted">${message}<br>${actionHtml}</div>`;
        return;
    }
    const grouped = {};
    slots.forEach(s => {
        const dateKey = new Date(s.start_at).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(s);
    });
    let html = '';
    for (const [date, items] of Object.entries(grouped)) {
        html += `<div class="fw-bold text-secondary mt-3 mb-2">${date}</div>`;
        items.forEach(slot => {
            const time = new Date(slot.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const freeText = slot.free_seats > 0 ? `Свободно ${slot.free_seats} из ${slot.total_seats}` : 'Мест нет';
            const disabledClass = slot.free_seats === 0 ? 'text-muted' : '';
            const clickHandler = slot.free_seats > 0 ? `onclick="openSlot('${slot.id}')"` : '';
            const cardStyle = slot.free_seats > 0 ? 'cursor:pointer;' : '';
            html += `
                <div class="card mb-2 ${disabledClass}" ${clickHandler} style="${cardStyle}">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between">
                            <strong>${time}</strong>
                            <span class="badge bg-secondary">${slot.program_type === 'beginner' ? 'Новичковая' : 'Опытная'}</span>
                        </div>
                        <div>${slot.program_name}</div>
                        <div class="text-secondary small">Шеф: ${slot.chef_name}</div>
                        <div class="d-flex justify-content-between mt-2">
                            <span>${slot.price} ₽</span>
                            <span class="${slot.free_seats === 0 ? 'text-danger' : 'text-success'}">${freeText}</span>
                        </div>
                    </div>
                </div>`;
        });
    }
    container.innerHTML = html;
}

// ========== Фильтры BS-001 ==========

async function loadChefsForFilter() {
    try {
        const chefs = await apiGet('/chefs');
        const container = document.getElementById('chef-filter-container');
        if (!container) return;
        if (chefs.length === 0) {
            container.innerHTML = '';
            return;
        }
        let html = '';
        chefs.forEach(chef => {
            const checked = filters.chef_id.includes(chef.id) ? 'checked' : '';
            html += `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${chef.id}" id="chef-${chef.id}" ${checked} onchange="updateChefFilter()">
                    <label class="form-check-label" for="chef-${chef.id}">${chef.name}</label>
                </div>`;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error('Ошибка загрузки шефов:', err);
        const container = document.getElementById('chef-filter-container');
        if (container) container.innerHTML = '<div class="text-danger small">Не удалось загрузить список шефов</div>';
    }
}

function updateChefFilter() {
    const checkboxes = document.querySelectorAll('#chef-filter-container input[type="checkbox"]:checked');
    filters.chef_id = Array.from(checkboxes).map(cb => cb.value);
}

function openFilters() {
    const modal = document.getElementById('filter-modal');
    if (!modal) {
        const modalHtml = `
        <div class="modal fade" id="filter-modal" tabindex="-1">
          <div class="modal-dialog modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Фильтры</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label fw-bold">Дата начала</label>
                  <div class="d-flex gap-2 mb-2">
                    <button class="btn btn-outline-secondary btn-sm" onclick="setDatePreset('today')">Сегодня</button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="setDatePreset('week')">Эта неделя</button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="setDatePreset('weekend')">Выходные</button>
                  </div>
                  <div class="row g-2">
                    <div class="col-6">
                      <input type="date" id="filter-date-from" class="form-control" value="${filters.date_from}">
                    </div>
                    <div class="col-6">
                      <input type="date" id="filter-date-to" class="form-control" value="${filters.date_to}">
                    </div>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Тип программы</label>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="beginner" id="type-beginner" ${filters.program_type.includes('beginner') ? 'checked' : ''}>
                    <label class="form-check-label" for="type-beginner">Новичковая</label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="experienced" id="type-experienced" ${filters.program_type.includes('experienced') ? 'checked' : ''}>
                    <label class="form-check-label" for="type-experienced">Опытная</label>
                  </div>
                </div>
                <div class="mb-3">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="only-available" ${filters.only_available ? 'checked' : ''}>
                    <label class="form-check-label fw-bold" for="only-available">Только со свободными местами</label>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Шеф</label>
                  <div id="chef-filter-container">Загрузка...</div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" onclick="resetFilters()">Сбросить</button>
                <button type="button" class="btn btn-primary-custom" onclick="applyFilters()">Применить</button>
              </div>
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        loadChefsForFilter();
    } else {
        document.getElementById('filter-date-from').value = filters.date_from;
        document.getElementById('filter-date-to').value = filters.date_to;
        loadChefsForFilter();
    }
    const modalEl = document.getElementById('filter-modal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

function setDatePreset(preset) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let date_from = today;
    let date_to = today;
    if (preset === 'today') {
        // ничего не меняем
    } else if (preset === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        date_from = monday.toISOString().slice(0, 10);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        date_to = sunday.toISOString().slice(0, 10);
    } else if (preset === 'weekend') {
        const day = now.getDay();
        const saturday = new Date(now);
        saturday.setDate(now.getDate() + (6 - day + 1) % 7);
        date_from = saturday.toISOString().slice(0, 10);
        const sunday = new Date(saturday);
        sunday.setDate(sunday.getDate() + 1);
        date_to = sunday.toISOString().slice(0, 10);
    }
    document.getElementById('filter-date-from').value = date_from;
    document.getElementById('filter-date-to').value = date_to;
}

function applyFilters() {
    filters.date_from = document.getElementById('filter-date-from').value;
    filters.date_to = document.getElementById('filter-date-to').value;
    filters.only_available = document.getElementById('only-available').checked;
    filters.program_type = [];
    if (document.getElementById('type-beginner').checked) filters.program_type.push('beginner');
    if (document.getElementById('type-experienced').checked) filters.program_type.push('experienced');
    filtersApplied = !!(filters.date_from || filters.date_to || filters.program_type.length > 0 || filters.chef_id.length > 0 || filters.only_available);
    const modalEl = document.getElementById('filter-modal');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    bsModal.hide();
    updateFilterIndicator();
    loadSlots();
}

function resetFilters() {
    filters.date_from = '';
    filters.date_to = '';
    filters.program_type = [];
    filters.chef_id = [];
    filters.only_available = false;
    filtersApplied = false;
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('only-available').checked = false;
    document.getElementById('type-beginner').checked = false;
    document.getElementById('type-experienced').checked = false;
    document.querySelectorAll('#chef-filter-container input[type="checkbox"]').forEach(cb => cb.checked = false);
    filters.chef_id = [];
    updateFilterIndicator();
}

function updateFilterIndicator() {
    const indicator = document.getElementById('filter-indicator');
    if (!indicator) return;
    if (filtersApplied) {
        let count = 0;
        if (filters.date_from || filters.date_to) count++;
        if (filters.program_type.length > 0) count++;
        if (filters.chef_id.length > 0) count++;
        if (filters.only_available) count++;
        indicator.textContent = count;
        indicator.style.display = 'inline-block';
    } else {
        indicator.style.display = 'none';
    }
}

function initSlotsHeader() {
    const tabSlots = document.getElementById('tab-slots');
    let header = document.getElementById('slots-header');
    if (!header) {
        header = document.createElement('div');
        header.id = 'slots-header';
        header.className = 'd-flex justify-content-between align-items-center mb-3';
        header.innerHTML = `
            <h5 class="m-0">Классы</h5>
            <button class="btn btn-outline-secondary btn-sm position-relative" onclick="openFilters()">
                <i class="bi bi-funnel"></i> Фильтры
                <span id="filter-indicator" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="display:none;"></span>
            </button>
        `;
        tabSlots.parentNode.insertBefore(header, tabSlots);
    }
}

const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'slots') {
        initSlotsHeader();
        loadSlots();
    }
};