class TestSlots:
    def test_list_slots_requires_auth(self, client):
        resp = client.get('/api/slots')
        assert resp.status_code == 401

    def test_list_slots_with_auth(self, client, auth_header):
        resp = client.get('/api/slots', headers=auth_header)
        assert resp.status_code == 200
        slots = resp.get_json()
        assert len(slots) >= 2
        for slot in slots:
            assert 'program_name' in slot
            assert 'free_seats' in slot
            assert 'free_rental_kits' in slot
            assert 'chef_name' in slot

    def test_filter_by_type(self, client, auth_header):
        resp = client.get('/api/slots?program_type=beginner', headers=auth_header)
        assert resp.status_code == 200
        slots = resp.get_json()
        for slot in slots:
            assert slot['program_type'] == 'beginner'

    def test_filter_only_available(self, client, auth_header):
        resp = client.get('/api/slots?only_available=true', headers=auth_header)
        assert resp.status_code == 200
        slots = resp.get_json()
        for slot in slots:
            assert slot['free_seats'] > 0

    def test_filter_by_date(self, client, auth_header):
        resp = client.get('/api/slots?date_from=2025-01-01&date_to=2025-12-31', headers=auth_header)
        assert resp.status_code == 200

    def test_filter_by_multiple_chefs(self, client, auth_header):
        resp = client.get('/api/slots?chef_id=1&chef_id=2', headers=auth_header)
        assert resp.status_code == 200

    def test_get_slot_valid(self, client, auth_header):
        slots = client.get('/api/slots', headers=auth_header).get_json()
        slot_id = slots[0]['id']
        resp = client.get(f'/api/slots/{slot_id}', headers=auth_header)
        assert resp.status_code == 200
        slot = resp.get_json()
        assert slot['program_name'] is not None
        assert 'program_description' in slot
        assert 'chef_name' in slot

    def test_get_slot_not_found(self, client, auth_header):
        resp = client.get('/api/slots/nonexistent', headers=auth_header)
        assert resp.status_code == 404