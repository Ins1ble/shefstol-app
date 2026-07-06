class TestChefs:
    def test_list_chefs_requires_auth(self, client):
        resp = client.get('/api/chefs')
        assert resp.status_code == 401

    def test_list_chefs_with_auth(self, client, auth_header):
        resp = client.get('/api/chefs', headers=auth_header)
        assert resp.status_code == 200
        chefs = resp.get_json()
        assert len(chefs) == 3
        assert chefs[0]['name'] == 'Анна'