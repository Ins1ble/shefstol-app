class TestBookings:
    def test_create_booking_success(self, client, auth_header):
        resp_slots = client.get('/api/slots', headers=auth_header)
        assert resp_slots.status_code == 200
        slot = resp_slots.get_json()[0]
        resp = client.post('/api/bookings',
                           json={'slot_id': slot['id'], 'seats_count': 1, 'rental_count': 0},
                           headers={**auth_header, 'Idempotency-Key': 'key-success-1'})
        assert resp.status_code == 201
        booking = resp.get_json()
        assert booking['status'] == 'active'
        assert booking['seats_count'] == 1
        assert 'price_total' in booking

    def test_create_booking_exceeds_seats(self, client, auth_header):
        resp_slots = client.get('/api/slots', headers=auth_header)
        assert resp_slots.status_code == 200
        slot = resp_slots.get_json()[0]
        resp = client.post('/api/bookings',
                           json={'slot_id': slot['id'], 'seats_count': 4, 'rental_count': 0},
                           headers={**auth_header, 'Idempotency-Key': 'key-exceed'})
        assert resp.status_code == 409
        assert resp.get_json()['code'] == 'slot_full'

    def test_double_booking(self, client, auth_header):
        resp_slots = client.get('/api/slots', headers=auth_header)
        assert resp_slots.status_code == 200
        slot = resp_slots.get_json()[0]
        client.post('/api/bookings', json={'slot_id': slot['id'], 'seats_count': 1, 'rental_count': 0},
                    headers={**auth_header, 'Idempotency-Key': 'key-double-1'})
        resp = client.post('/api/bookings', json={'slot_id': slot['id'], 'seats_count': 1, 'rental_count': 0},
                           headers={**auth_header, 'Idempotency-Key': 'key-double-2'})
        assert resp.status_code == 409
        assert resp.get_json()['code'] == 'double_booking'

    def test_create_booking_missing_idempotency_key(self, client, auth_header):
        resp_slots = client.get('/api/slots', headers=auth_header)
        assert resp_slots.status_code == 200
        slot = resp_slots.get_json()[0]
        resp = client.post('/api/bookings',
                           json={'slot_id': slot['id'], 'seats_count': 1, 'rental_count': 0},
                           headers=auth_header)
        assert resp.status_code == 400
        assert resp.get_json()['code'] == 'bad_request'

    def test_cancel_non_existent_booking(self, client, auth_header):
        resp = client.post('/api/bookings/00000000-0000-0000-0000-000000000000/cancel', headers=auth_header)
        assert resp.status_code == 404