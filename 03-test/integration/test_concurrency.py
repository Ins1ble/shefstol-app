import uuid

class TestIntegration:

    def test_idempotency_duplicate_request(self, client):
        """Повторный запрос с тем же Idempotency-Key возвращает ту же бронь."""
        phone = '+79990000002'
        code = client.post('/api/auth/request-code', json={'phone': phone}).get_json()['code']
        resp = client.post('/api/auth/verify-code', json={'phone': phone, 'code': code})
        token = resp.get_json()['tokens']['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        client.patch('/api/profile', json={'name': 'Дубль'}, headers=headers)
        slots = client.get('/api/slots', headers=headers).get_json()
        slot_id = max(slots, key=lambda s: s['free_seats'])['id']  # слот с макс. свободных мест
        key = f'idem-{uuid.uuid4().hex}'

        r1 = client.post('/api/bookings',
                         json={'slot_id': slot_id, 'seats_count': 1, 'rental_count': 0},
                         headers={**headers, 'Idempotency-Key': key})
        assert r1.status_code == 201
        booking1 = r1.get_json()

        r2 = client.post('/api/bookings',
                         json={'slot_id': slot_id, 'seats_count': 1, 'rental_count': 0},
                         headers={**headers, 'Idempotency-Key': key})
        assert r2.status_code == 201
        booking2 = r2.get_json()
        assert booking1['id'] == booking2['id']

    def test_profile_delete_releases_bookings(self, client):
        """Удаление аккаунта освобождает занятые места."""
        phone = '+79990000005'
        code = client.post('/api/auth/request-code', json={'phone': phone}).get_json()['code']
        resp = client.post('/api/auth/verify-code', json={'phone': phone, 'code': code})
        token = resp.get_json()['tokens']['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        client.patch('/api/profile', json={'name': 'Удаляемый'}, headers=headers)
        slots = client.get('/api/slots', headers=headers).get_json()
        slot = max(slots, key=lambda s: s['free_seats'])
        free_seats_before = slot['free_seats']

        client.post('/api/bookings',
                    json={'slot_id': slot['id'], 'seats_count': 1, 'rental_count': 0},
                    headers={**headers, 'Idempotency-Key': f'del-{uuid.uuid4().hex}'})

        del_resp = client.delete('/api/profile', headers=headers)
        assert del_resp.status_code == 204
        assert client.get('/api/profile', headers=headers).status_code == 401

        # Проверяем освобождение через нового клиента
        phone2 = '+79990000006'
        code2 = client.post('/api/auth/request-code', json={'phone': phone2}).get_json()['code']
        resp2 = client.post('/api/auth/verify-code', json={'phone': phone2, 'code': code2})
        token2 = resp2.get_json()['tokens']['access_token']
        headers2 = {'Authorization': f'Bearer {token2}'}
        slot_after = client.get(f'/api/slots/{slot["id"]}', headers=headers2).get_json()
        assert slot_after['free_seats'] == free_seats_before