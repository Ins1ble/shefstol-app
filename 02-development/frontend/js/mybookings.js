// mybookings.js — SCR-005: Мои бронирования (LOGIC-008)

async function loadMyBookings() {
    const container = document.getElementById('tab-bookings');
    container.innerHTML = renderSkeleton('booking-card', 2);
    try {
        const bookings = await apiGet('/bookings');
        renderMyBookings(bookings);
    } catch (err) {
        container.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить записи.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="loadMyBookings()">Обновить</button></div>`;
    }
}

function renderMyBookings(bookings) {
    const container = document.getElementById('tab-bookings');
    if (bookings.length === 0) {
        container.innerHTML = `<div class="text-center my-5 text-muted">У вас пока нет записей.<br><button class="btn btn-sm btn-outline-secondary mt-2" onclick="switchTab('slots')">Записаться на класс</button></div>`;
        return;
    }

    const now = new Date();
    const upcoming = [];
    const history = [];

    bookings.forEach(b => {
        const start = new Date(b.slot_start);
        if (b.status === 'active' && start > now) {
            upcoming.push(b);
        } else {
            history.push(b);
        }
    });

    upcoming.sort((a, b) => new Date(a.slot_start) - new Date(b.slot_start));
    history.sort((a, b) => new Date(b.slot_start) - new Date(a.slot_start));

    let html = '';

    if (upcoming.length > 0) {
        html += `<div class="fw-bold text-secondary mb-2">Предстоящие</div>`;
        html += renderBookingCards(upcoming);
    } else {
        html += `<div class="text-muted mb-3">Нет предстоящих записей</div>`;
    }

    if (history.length > 0) {
        html += `<div class="fw-bold text-secondary mt-4 mb-2">История</div>`;
        html += renderBookingCards(history);
    }

    container.innerHTML = html;
}

function renderBookingCards(bookings) {
    return bookings.map(b => {
        const start = new Date(b.slot_start);
        const dateStr = start.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
        const timeStr = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        let statusText = '';
        let statusColor = '';
        switch (b.status) {
            case 'active': statusText = 'Активна'; statusColor = 'success'; break;
            case 'cancelled': statusText = 'Отменена'; statusColor = 'secondary'; break;
            case 'late_cancel': statusText = 'Поздняя отмена'; statusColor = 'warning'; break;
            case 'studio_cancelled': statusText = 'Отменена студией'; statusColor = 'danger'; break;
            default: statusText = b.status;
        }
        const rentalInfo = b.rental_count > 0 ? `Прокат: ${b.rental_count}` : 'Свой инвентарь';
        return `
            <div class="card mb-2" onclick="showBookingDetails('${b.id}')" style="cursor:pointer;">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between">
                        <strong>${dateStr}, ${timeStr}</strong>
                        <span class="badge bg-${statusColor}">${statusText}</span>
                    </div>
                    <div>${b.program_name}</div>
                    <div class="text-secondary small">Шеф: ${b.chef_name}</div>
                    <div class="d-flex justify-content-between mt-2">
                        <span>${b.seats_count} мест (${rentalInfo})</span>
                        <strong>${b.price_total} ₽</strong>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}