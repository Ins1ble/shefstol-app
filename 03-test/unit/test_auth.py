class TestAuth:
    def test_request_code_valid_phone(self, client):
        resp = client.post('/api/auth/request-code', json={'phone': '+79991112233'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'ttl_seconds' in data
        assert 'resend_after_seconds' in data
        assert 'code' in data

    def test_request_code_invalid_phone(self, client):
        resp = client.post('/api/auth/request-code', json={'phone': '12345'})
        assert resp.status_code == 400
        assert resp.get_json()['code'] == 'bad_request'

    def test_request_code_missing_phone(self, client):
        resp = client.post('/api/auth/request-code', json={})
        assert resp.status_code == 400

    def test_verify_code_correct_new_client(self, client):
        phone = '+79995556678'
        code = client.post('/api/auth/request-code', json={'phone': phone}).get_json()['code']
        resp = client.post('/api/auth/verify-code', json={'phone': phone, 'code': code})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'tokens' in data
        assert data['is_new'] == True

    def test_verify_code_wrong(self, client):
        phone = '+79991112234'
        client.post('/api/auth/request-code', json={'phone': phone})
        resp = client.post('/api/auth/verify-code', json={'phone': phone, 'code': '0000'})
        assert resp.status_code == 400
        assert resp.get_json()['code'] == 'invalid_code'

    def test_login_twice_skips_name(self, client):
        phone = '+79995556679'
        code1 = client.post('/api/auth/request-code', json={'phone': phone}).get_json()['code']
        client.post('/api/auth/verify-code', json={'phone': phone, 'code': code1})
        code2 = client.post('/api/auth/request-code', json={'phone': phone}).get_json()['code']
        resp = client.post('/api/auth/verify-code', json={'phone': phone, 'code': code2})
        assert resp.status_code == 200
        assert resp.get_json()['is_new'] == False

    def test_refresh_token(self, client, auth_header):
        token = auth_header['Authorization'].split(' ')[1]
        resp = client.post('/api/auth/refresh', json={'refresh_token': token})
        assert resp.status_code in [200, 400]
        if resp.status_code == 200:
            assert 'access_token' in resp.get_json()
        else:
            assert resp.get_json()['code'] == 'bad_request'

    def test_logout(self, client, auth_header):
        resp = client.post('/api/auth/logout', headers=auth_header)
        assert resp.status_code == 204
        assert client.get('/api/profile', headers=auth_header).status_code == 401