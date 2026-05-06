import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Setup paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
LEADS_DIR = os.path.join(BASE_DIR, 'leads')
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')

app = Flask(__name__, static_folder=FRONTEND_DIR)
CORS(app)

# Load users
def get_users():
    users_file = os.path.join(BACKEND_DIR, 'users.json')
    if os.path.exists(users_file):
        with open(users_file, 'r') as f:
            return json.load(f).get('users', [])
    return []

# Load leads
def get_leads():
    leads_file = os.path.join(LEADS_DIR, 'master_leads.json')
    if os.path.exists(leads_file):
        with open(leads_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    users = get_users()
    for user in users:
        if user['username'] == username and user['password'] == password:
            # Create a simple mock token
            return jsonify({
                'success': True,
                'token': f"fake-jwt-token-{user['username']}",
                'user': {
                    'username': user['username'],
                    'name': user['name'],
                    'role': user['role']
                }
            })
            
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/leads', methods=['GET'])
def get_leads_api():
    # In a real app we would verify the Authorization header token here
    # For now, we'll just return the leads
    leads = get_leads()
    return jsonify(leads)

# Serve static files for the frontend
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'login.html')

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return "File not found", 404

if __name__ == '__main__':
    print("=======================================")
    print("Starting SiteForge Lead Command Center")
    print("Running at: http://127.0.0.1:5000")
    print("=======================================")
    app.run(port=5000, debug=True)
