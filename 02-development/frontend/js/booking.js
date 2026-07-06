// booking.js — SCR-003, SCR-004, BS-002, SCR-006, BS-003, BS-004

// ---------- SCR-003: Карточка класса ----------
async function openSlot(slotId) {
    showScreen('slot-card');
    let screen = document.getElementById('screen-slot-card');
    if (!screen) {
        const screenHtml = `
        <div id="screen-slot-card" class="screen active">
            <div class="d-flex align-items-center mb-3">
                <button class="btn btn-outline-secondary btn-sm me-2" onclick="goBackToSlots()">← Назад</button>
                <h5 class="m-0">Карточка класса</h5>
            </div>
            <div id="slot-card-content" class="flex-grow-1"></div>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-slot-card');
    screen.classList.add('active');
    const content = document.getElementById('slot-card-content');
    content.innerHTML = `<div class="text-center my-5"><div class="spinner-border text-warning" role="status"></div></div>`;
    try {
        const slot = await apiGet(`/slots/${slotId}`);
        renderSlotCard(slot);
    } catch (err) {
        content.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="openSlot('${slotId}')">Обновить</button></div>`;
    }
}

function goBackToSlots() {
    const screen = document.getElementById('screen-slot-card');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('slots');
}

function renderSlotCard(slot) {
    const content = document.getElementById('slot-card-content');
    const freeText = slot.free_seats > 0 ? `Свободно ${slot.free_seats} из ${slot.total_seats}` : 'Мест нет';
    const rentalText = slot.free_rental_kits > 0 ? `Свободно наборов: ${slot.free_rental_kits}` : 'Прокатных наборов нет';
    const bookDisabled = slot.free_seats === 0 ? 'disabled' : '';
    const bookText = slot.free_seats > 0 ? 'Записаться' : 'Мест нет';
    const safeAddress = slot.studio_address.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    // Статическая карта-превью, если есть координаты
    let mapPreviewHtml = '';
    if (slot.studio_lat && slot.studio_lng) {
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${slot.studio_lng},${slot.studio_lat}&size=450,200&z=15&l=map&pt=${slot.studio_lng},${slot.studio_lat},pm2rdm`;
        mapPreviewHtml = `<img src="${staticMapUrl}" class="img-fluid rounded mb-2" alt="Карта студии" onclick="showStudioAddress('${safeAddress}', ${slot.studio_lat}, ${slot.studio_lng})" style="cursor:pointer;">`;
    }

    content.innerHTML = `
        <div class="mb-3"><strong>${formatDateTime(slot.start_at)}</strong></div>
        <div class="card mb-2"><div class="card-body p-3">
            <h5>${slot.program_name}</h5>
            <span class="badge bg-secondary">${slot.program_type === 'beginner' ? 'Новичковая' : 'Опытная'}</span>
            ${slot.program_description ? `<p class="mt-2 text-secondary">${slot.program_description}</p>` : ''}
            ${slot.program_duration ? `<p class="text-secondary">Длительность: ${slot.program_duration} мин</p>` : ''}
        </div></div>
        <div class="card mb-2"><div class="card-body p-3"><strong>Шеф:</strong> ${slot.chef_name}</div></div>
        ${mapPreviewHtml}
        <div class="card mb-2" onclick="showStudioAddress('${safeAddress}', ${slot.studio_lat || null}, ${slot.studio_lng || null})" style="cursor:pointer;">
            <div class="card-body p-3"><strong>Адрес:</strong> ${slot.studio_address}</div>
        </div>
        <div class="card mb-2"><div class="card-body p-3">
            <div><strong>Места:</strong> ${freeText}</div>
            <div><strong>Прокат:</strong> ${rentalText}</div>
        </div></div>
        <div class="card mb-2"><div class="card-body p-3">
            <div class="fs-5"><strong>${slot.price} ₽</strong> за место</div>
            <div class="text-muted">Оплата на месте: наличные или перевод</div>
        </div></div>
        <button class="btn btn-primary-custom w-100 mt-3" ${bookDisabled} onclick="startBooking('${slot.id}')">${bookText}</button>
    `;
}

// ---------- SCR-004: Оформление записи ----------
let currentBooking = {
    slotId: null,
    seats: 1,
    equipment: [], // 'own' или 'rental' для каждого места
    dietary: '',
    idempotencyKey: null   // сохраняется для повторов при E4
};

async function startBooking(slotId) {
    let slot;
    try {
        slot = await apiGet(`/slots/${slotId}`);
    } catch (err) {
        showSnackbar('Не удалось загрузить данные класса', 'error');
        return;
    }
    currentBooking.slotId = slotId;
    currentBooking.seats = 1;
    currentBooking.equipment = [];
    const defaultEquip = slot.free_rental_kits > 0 ? 'rental' : 'own';
    currentBooking.equipment.push(defaultEquip);
    currentBooking.dietary = '';
    currentBooking.idempotencyKey = null;   // сбросим ключ

    showScreen('booking-form');
    let screen = document.getElementById('screen-booking-form');
    if (!screen) {
        const screenHtml = `
        <div id="screen-booking-form" class="screen active">
            <div class="d-flex align-items-center mb-3">
                <button class="btn btn-outline-secondary btn-sm me-2" onclick="goBackToSlotCard()">← Назад</button>
                <h5 class="m-0">Оформление записи</h5>
            </div>
            <div id="booking-form-content" class="flex-grow-1"></div>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-booking-form');
    screen.classList.add('active');
    renderBookingForm(slot);
}

function goBackToSlotCard() {
    const screen = document.getElementById('screen-booking-form');
    if (screen) screen.classList.remove('active');
    openSlot(currentBooking.slotId);
}

function renderBookingForm(slot) {
    const maxSeats = Math.min(slot.free_seats, slot.program_capacity_cap || 12, 3);
    const rentalAvailable = slot.free_rental_kits;
    const pricePerSeat = slot.price;
    const rentalPrice = slot.rental_price;

    function recalcPrice() {
        let total = pricePerSeat * currentBooking.seats;
        const rentalCount = currentBooking.equipment.filter(e => e === 'rental').length;
        total += rentalPrice * rentalCount;
        document.getElementById('price-total').textContent = `${total} ₽`;
        document.getElementById('cta-book').textContent = `Записаться · ${total} ₽`;
        const seatsValid = currentBooking.seats <= maxSeats;
        const rentalValid = rentalCount <= rentalAvailable;
        document.getElementById('cta-book').disabled = !(seatsValid && rentalValid);
    }

    function renderEquipmentRows() {
        const container = document.getElementById('equipment-rows');
        let html = '';
        for (let i = 0; i < currentBooking.seats; i++) {
            const label = i === 0 ? 'Вы' : `Гость ${i}`;
            const isRental = currentBooking.equipment[i] === 'rental';
            html += `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>Место ${i+1} (${label})</span>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-secondary ${!isRental ? 'active' : ''}" onclick="setEquipment(${i}, 'own'); renderBookingForm(window._currentSlot);">Свой</button>
                        <button type="button" class="btn btn-outline-secondary ${isRental ? 'active' : ''}" ${(currentBooking.equipment.filter(e=>e==='rental').length >= rentalAvailable && !isRental) ? 'disabled' : ''} onclick="setEquipment(${i}, 'rental'); renderBookingForm(window._currentSlot);">Прокатный</button>
                    </div>
                </div>`;
        }
        container.innerHTML = html;
    }

    window._currentSlot = slot;
    window.setEquipment = (index, value) => {
        currentBooking.equipment[index] = value;
        recalcPrice();
        renderEquipmentRows();
    };
    window.changeSeats = (delta) => {
        const newSeats = currentBooking.seats + delta;
        if (newSeats < 1 || newSeats > maxSeats) return;
        currentBooking.seats = newSeats;
        while (currentBooking.equipment.length < newSeats) {
            const defaultEquip = (slot.free_rental_kits > currentBooking.equipment.filter(e=>e==='rental').length) ? 'rental' : 'own';
            currentBooking.equipment.push(defaultEquip);
        }
        currentBooking.equipment = currentBooking.equipment.slice(0, newSeats);
        recalcPrice();
        renderBookingForm(slot);
    };

    const screen = document.getElementById('screen-booking-form');
    screen.innerHTML = `
        <div id="booking-form-content">
            <div class="mb-3"><strong>${slot.program_name}</strong> — ${formatDateTime(slot.start_at)}</div>
            <div class="mb-3">
                <label class="form-label">Число мест</label>
                <div class="d-flex align-items-center">
                    <button class="btn btn-outline-secondary" onclick="changeSeats(-1)">−</button>
                    <span class="mx-3 fs-5">${currentBooking.seats}</span>
                    <button class="btn btn-outline-secondary" onclick="changeSeats(1)" ${currentBooking.seats >= maxSeats ? 'disabled' : ''}>+</button>
                </div>
                <div class="form-text">Можно записать до ${maxSeats} мест</div>
            </div>
            <div id="equipment-rows" class="mb-3"></div>
            <div class="mb-3">
                <label class="form-label">Пищевые ограничения</label>
                <textarea class="form-control" id="dietary-input" placeholder="Укажите аллергии и ограничения заранее" onchange="currentBooking.dietary = this.value">${currentBooking.dietary}</textarea>
            </div>
            <div class="card mb-3"><div class="card-body p-3">
                <div class="d-flex justify-content-between">
                    <span>Места: ${pricePerSeat} ₽ × ${currentBooking.seats}</span>
                    <span>${pricePerSeat * currentBooking.seats} ₽</span>
                </div>
                <div id="rental-cost-row" class="d-flex justify-content-between mt-1" style="display: ${currentBooking.equipment.filter(e=>e==='rental').length > 0 ? 'flex' : 'none'}">
                    <span>Прокат: ${rentalPrice} ₽ × ${currentBooking.equipment.filter(e=>e==='rental').length}</span>
                    <span>${rentalPrice * currentBooking.equipment.filter(e=>e==='rental').length} ₽</span>
                </div>
                <div class="d-flex justify-content-between mt-2 fw-bold">
                    <span>Итого</span>
                    <span id="price-total">0 ₽</span>
                </div>
                <div class="text-muted mt-2">Оплата на месте: наличные или перевод</div>
            </div></div>
            <button id="cta-book" class="btn btn-primary-custom w-100" onclick="confirmBooking()">Записаться</button>
            <div id="booking-error" class="mt-3"></div>
        </div>
    `;
    renderEquipmentRows();
    recalcPrice();
    document.getElementById('dietary-input').value = currentBooking.dietary;
}

async function confirmBooking(isRetry = false) {
    // Если это повтор (E4) и ключ уже есть, используем его
    if (!isRetry || !currentBooking.idempotencyKey) {
        currentBooking.idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    }

    const body = {
        slot_id: currentBooking.slotId,
        seats_count: currentBooking.seats,
        rental_count: currentBooking.equipment.filter(e => e === 'rental').length,
        dietary_restrictions: currentBooking.dietary
    };
    const cta = document.getElementById('cta-book');
    const errorBox = document.getElementById('booking-error');
    errorBox.innerHTML = '';
    cta.disabled = true;
    cta.textContent = 'Создание брони...';

    try {
        const booking = await apiPost('/bookings', body, { 'Idempotency-Key': currentBooking.idempotencyKey });
        showBookingSuccess(booking);
    } catch (err) {
        const code = err.code;
        const details = err.details || {};
        let message = err.message || 'Не удалось создать бронь';
        let action = null;

        switch (code) {
            case 'slot_full':
    if (details.available_seats && details.available_seats > 0) {
        message = `Недостаточно мест. Свободно: ${details.available_seats}.`;
        action = async () => {
            currentBooking.seats = details.available_seats;
            while (currentBooking.equipment.length > details.available_seats) {
                currentBooking.equipment.pop();
            }
            // Запросим свежие данные слота для актуального free_rental_kits
            try {
                const freshSlot = await apiGet(`/slots/${currentBooking.slotId}`);
                window._currentSlot = freshSlot;
                renderBookingForm(freshSlot);
            } catch (e) {
                // если не удалось, используем старые данные
                renderBookingForm(window._currentSlot);
            }
            currentBooking.idempotencyKey = null;
        };
    } else {
        message = 'Класс заполнен другим пользователем. Список обновлён.';
        action = () => goBackToSlots();
    }
    break;
            case 'double_booking':
                message = 'У вас уже есть бронь на этот класс.';
                action = () => goToBookings();
                break;
            case 'slot_cancelled':
                message = 'Класс отменён и больше недоступен.';
                action = () => goBackToSlots();
                break;
            case 'slot_started':
                message = 'Класс уже начался — запись недоступна.';
                action = () => goBackToSlots();
                break;
            default:
                if (!navigator.onLine) {
                    message = 'Не удалось выполнить. Проверьте соединение и повторите.';
                    action = () => confirmBooking(true); // повтор с тем же ключом
                } else if (code === 'idempotency_key_conflict') {
                    message = 'Не удалось оформить запись. Попробуйте ещё раз.';
                    currentBooking.idempotencyKey = null; // сбросить ключ
                }
        }

        if (action) {
            errorBox.innerHTML = `
                <div class="alert alert-danger">
                    ${message}
                    <button class="btn btn-sm btn-outline-secondary ms-2" id="error-action-btn">OK</button>
                </div>`;
            document.getElementById('error-action-btn').addEventListener('click', () => {
                action();
                errorBox.innerHTML = '';
            });
            // Для необратимых ошибок CTA останется заблокированным
        } else {
            showSnackbar(message, 'error');
            cta.disabled = false;
            cta.textContent = 'Записаться';
        }
    }
}

// ---------- BS-002: Экран успешной записи ----------
function showBookingSuccess(booking) {
    showScreen('booking-success');
    let screen = document.getElementById('screen-booking-success');
    if (!screen) {
        const screenHtml = `
        <div id="screen-booking-success" class="screen active">
            <div class="text-center my-4">
                <div class="fs-1 text-success">✓</div>
                <h4>Вы записаны</h4>
            </div>
            <div id="success-content" class="flex-grow-1"></div>
            <button class="btn btn-outline-primary w-100 mb-2" onclick="goToBookings()">Мои записи</button>
            <button id="add-calendar-btn" class="btn btn-outline-secondary w-100 mb-2" style="display:none;">Добавить в календарь</button>
            <button class="btn btn-outline-secondary w-100" onclick="goBackToSlotsFromSuccess()">Готово</button>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-booking-success');
    screen.classList.add('active');
    const content = document.getElementById('success-content');

    // Загружаем детали брони и показываем кнопку календаря
    apiGet(`/bookings/${booking.id}`).then(bookingDetail => {
        content.innerHTML = `
            <div class="card mb-3"><div class="card-body p-3">
                <div><strong>${formatDateTime(bookingDetail.slot_start)}</strong></div>
                <div>${bookingDetail.program_name}</div>
                <div>Шеф: ${bookingDetail.chef_name}</div>
                <div>Мест: ${bookingDetail.seats_count} (прокат: ${bookingDetail.rental_count})</div>
                ${bookingDetail.dietary_restrictions ? `<div>Пищевые ограничения: ${bookingDetail.dietary_restrictions}</div>` : ''}
                <div class="fs-5 mt-2"><strong>${bookingDetail.price_total} ₽</strong></div>
                <div class="text-muted">Оплата на месте</div>
            </div></div>
        `;

        // Включаем кнопку календаря с правильными данными
        const calBtn = document.getElementById('add-calendar-btn');
        if (calBtn) {
            calBtn.style.display = 'block';
            calBtn.onclick = () => addToCalendar(bookingDetail.slot_start, bookingDetail.program_name);
        }
    }).catch(() => {
        content.innerHTML = `<p>Бронь #${booking.id} создана</p>`;
        // Даже при ошибке можно показать кнопку с минимальными данными (по id)
        const calBtn = document.getElementById('add-calendar-btn');
        if (calBtn) {
            calBtn.style.display = 'block';
            calBtn.onclick = () => addToCalendar(null, `Бронь #${booking.id}`);
        }
    });

    // LOGIC-007: Запрос разрешения на уведомления после первой брони
    if (booking.is_first_booking && !localStorage.getItem('push_permission_requested')) {
        localStorage.setItem('push_permission_requested', 'true');
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            const reminderText = booking.reminder_hours && booking.reminder_hours.length
                ? `за ${booking.reminder_hours.join(' ч и ')} ч до начала`
                : '';
            const hint = document.createElement('div');
            hint.className = 'alert alert-info mt-3';
            hint.textContent = `Напомним ${reminderText || 'о классе'}. Включить уведомления?`;
            content.appendChild(hint);
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') console.log('Push notifications granted');
                hint.remove();
            });
        }
    }
}

function addToCalendar(startAt, title) {
    if (!startAt) return;
    const start = new Date(startAt);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title || 'Кулинарный класс')}&dates=${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    window.open(url, '_blank');
}

function goBackToSlotsFromSuccess() {
    const screen = document.getElementById('screen-booking-success');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('slots');
}

function goToBookings() {
    const screen = document.getElementById('screen-booking-success');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('bookings');
    loadMyBookings();
}

// ---------- SCR-006: Детали брони ----------
async function showBookingDetails(bookingId) {
    showScreen('booking-details');
    let screen = document.getElementById('screen-booking-details');
    if (!screen) {
        const screenHtml = `
        <div id="screen-booking-details" class="screen active">
            <div class="d-flex align-items-center mb-3">
                <button class="btn btn-outline-secondary btn-sm me-2" onclick="goBackToBookings()">← Назад</button>
                <h5 class="m-0">Детали брони</h5>
            </div>
            <div id="booking-details-content" class="flex-grow-1"></div>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-booking-details');
    screen.classList.add('active');
    const content = document.getElementById('booking-details-content');
    content.innerHTML = `<div class="text-center my-5"><div class="spinner-border text-warning" role="status"></div></div>`;
    try {
        const booking = await apiGet(`/bookings/${bookingId}`);
        renderBookingDetails(booking);
    } catch (err) {
        content.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить детали.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="showBookingDetails('${bookingId}')">Обновить</button></div>`;
    }
}

function goBackToBookings() {
    const screen = document.getElementById('screen-booking-details');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('bookings');
    loadMyBookings();
}

function renderBookingDetails(booking) {
    const content = document.getElementById('booking-details-content');
    const start = new Date(booking.slot_start);
    const now = new Date();
    const canCancel = booking.status === 'active' && start > now;
    const deadline = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    let statusText = '';
    let statusColor = '';
    switch (booking.status) {
        case 'active': statusText = 'Активна'; statusColor = 'success'; break;
        case 'cancelled': statusText = 'Отменена'; statusColor = 'secondary'; break;
        case 'late_cancel': statusText = 'Поздняя отмена'; statusColor = 'warning'; break;
        case 'studio_cancelled': statusText = 'Отменена студией'; statusColor = 'danger'; break;
        default: statusText = booking.status;
    }
    const rentalInfo = booking.rental_count > 0 ? `${booking.rental_count} прокатных наборов` : 'Свой инвентарь';
    const ownCount = booking.seats_count - booking.rental_count;
    const safeAddress = booking.studio_address.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    // Статическая карта-превью, если есть координаты
    let mapPreviewHtml = '';
    if (booking.studio_lat && booking.studio_lng) {
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${booking.studio_lng},${booking.studio_lat}&size=450,200&z=15&l=map&pt=${booking.studio_lng},${booking.studio_lat},pm2rdm`;
        mapPreviewHtml = `<img src="${staticMapUrl}" class="img-fluid rounded mb-2" alt="Карта студии" onclick="showStudioAddress('${safeAddress}', ${booking.studio_lat}, ${booking.studio_lng})" style="cursor:pointer;">`;
    }

    let cancelDeadlineHtml = '';
    if (canCancel) {
        cancelDeadlineHtml = `<div class="mt-2 text-secondary small">Бесплатная отмена до ${formatDateTime(deadline.toISOString())}</div>`;
    }

    content.innerHTML = `
        <div class="mb-3">
            <span class="badge bg-${statusColor} fs-6">${statusText}</span>
        </div>
        <div class="card mb-2"><div class="card-body p-3">
            <h5>${booking.program_name}</h5>
            <div><strong>${formatDateTime(booking.slot_start)}</strong></div>
            <div class="mt-2">${booking.program_type === 'beginner' ? 'Новичковая' : 'Опытная'} ${booking.program_duration ? `· ~${booking.program_duration} мин` : ''}</div>
            <div>Шеф: ${booking.chef_name}</div>
            ${booking.program_description ? `<p class="text-secondary mt-2">${booking.program_description}</p>` : ''}
        </div></div>
        ${mapPreviewHtml}
        <div class="card mb-2" onclick="showStudioAddress('${safeAddress}', ${booking.studio_lat || null}, ${booking.studio_lng || null})" style="cursor:pointer;">
            <div class="card-body p-3"><strong>Адрес:</strong> ${booking.studio_address}</div>
        </div>
        <div class="card mb-2"><div class="card-body p-3">
            <div><strong>Мест:</strong> ${booking.seats_count} (${rentalInfo}, ${ownCount} свой)</div>
            ${booking.dietary_restrictions ? `<div class="mt-2"><strong>Пищевые ограничения:</strong> ${booking.dietary_restrictions}</div>` : ''}
        </div></div>
        <div class="card mb-2"><div class="card-body p-3">
            <div class="d-flex justify-content-between">
                <span>Места: ${booking.slot_price} ₽ × ${booking.seats_count}</span>
                <span>${booking.slot_price * booking.seats_count} ₽</span>
            </div>
            ${booking.rental_count > 0 ? `
            <div class="d-flex justify-content-between mt-1">
                <span>Прокат: ${booking.slot_rental_price} ₽ × ${booking.rental_count}</span>
                <span>${booking.slot_rental_price * booking.rental_count} ₽</span>
            </div>` : ''}
            <div class="d-flex justify-content-between mt-2 fw-bold">
                <span>Итого</span>
                <span>${booking.price_total} ₽</span>
            </div>
            <div class="text-muted mt-2">Оплата на месте: наличные или перевод</div>
        </div></div>
        <div class="text-secondary small mt-2">Записано: ${formatDateTime(booking.created_at)}</div>
        ${booking.cancelled_at ? `<div class="text-secondary small">Отменено: ${formatDateTime(booking.cancelled_at)}</div>` : ''}
        ${cancelDeadlineHtml}
        ${canCancel ? `<button class="btn btn-outline-danger w-100 mt-3" onclick="initCancelBooking('${booking.id}')">Отменить запись</button>` : ''}
        ${!canCancel && booking.status === 'active' ? `<button class="btn btn-outline-danger w-100 mt-3" disabled>Класс уже начался</button>` : ''}
    `;
}

// ---------- BS-003: Подтверждение отмены ----------
let cancelBookingId = null;

function initCancelBooking(bookingId) {
    cancelBookingId = bookingId;
    const modal = document.getElementById('cancel-modal');
    if (!modal) {
        const modalHtml = `
        <div class="modal fade" id="cancel-modal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Отменить запись?</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body" id="cancel-modal-body">
                Загрузка...
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Не отменять</button>
                <button type="button" class="btn btn-danger" id="confirm-cancel-btn" disabled>Подтвердить отмену</button>
              </div>
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    apiGet(`/bookings/${bookingId}`).then(booking => {
        const start = new Date(booking.slot_start);
        const now = new Date();
        const hoursLeft = (start - now) / (1000 * 60 * 60);
        const isEarly = hoursLeft >= 2;
        const body = document.getElementById('cancel-modal-body');
        body.innerHTML = `
            <p>${isEarly ? 'Место и прокатные наборы вернутся в класс и станут доступны другим.' : 'Поздняя отмена: место и прокатные наборы не освобождаются. Штраф не взимается.'}</p>
            <p class="text-muted small">Правило: отмена не позднее чем за 2 часа до начала — место освобождается.</p>
        `;
        const confirmBtn = document.getElementById('confirm-cancel-btn');
        confirmBtn.disabled = false;
        confirmBtn.onclick = executeCancel;
    }).catch(err => {
        showSnackbar('Не удалось загрузить данные', 'error');
    });
    const bsModal = new bootstrap.Modal(document.getElementById('cancel-modal'));
    bsModal.show();
}

async function executeCancel() {
    const btn = document.getElementById('confirm-cancel-btn');
    btn.disabled = true;
    btn.textContent = 'Отмена...';
    try {
        await apiPost(`/bookings/${cancelBookingId}/cancel`);
        bootstrap.Modal.getInstance(document.getElementById('cancel-modal')).hide();
        showBookingDetails(cancelBookingId);
    } catch (err) {
        showSnackbar(err.message || 'Не удалось отменить', 'error');
        btn.disabled = false;
        btn.textContent = 'Подтвердить отмену';
    }
}

// ---------- BS-004: Адрес студии ----------
function showStudioAddress(address, lat, lng) {
    const oldModal = document.getElementById('studio-address-modal');
    if (oldModal) oldModal.remove();

    let mapHtml = '';
    if (lat && lng) {
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&size=600,400&z=15&l=map&pt=${lng},${lat},pm2rdm`;
        mapHtml = `<img src="${staticMapUrl}" class="img-fluid rounded mb-2" alt="Карта студии">`;
    }

    const modalHtml = `
    <div class="modal fade" id="studio-address-modal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Адрес студии</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <p class="fs-5">${address}</p>
            ${mapHtml}
            <a href="https://yandex.ru/maps/?text=${encodeURIComponent(address)}" target="_blank" class="btn btn-outline-primary btn-sm">Открыть в Яндекс.Картах</a>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const bsModal = new bootstrap.Modal(document.getElementById('studio-address-modal'));
    bsModal.show();
}