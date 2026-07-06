class TestProfile:
    def test_get_profile(self, client, auth_header):
        resp = client.get('/api/profile', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'phone' in data
        assert 'name' in data

    def test_update_profile_name(self, client, auth_header):
        resp = client.patch('/api/profile', json={'name': 'Иван'}, headers=auth_header)
        assert resp.status_code == 200
        profile = client.get('/api/profile', headers=auth_header).get_json()
        assert profile['name'] == 'Иван'

    def test_update_profile_empty_name(self, client, auth_header):
        resp = client.patch('/api/profile', json={'name': ''}, headers=auth_header)
        assert resp.status_code == 400

    def test_profile_unauthorized(self, client):
        resp = client.get('/api/profile')
        assert resp.status_code == 401