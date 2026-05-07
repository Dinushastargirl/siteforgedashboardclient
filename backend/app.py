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

@app.route('/api/send-email', methods=['POST'])
def send_email():
    data = request.json or {}
    api_key = data.get('api_key')
    sender_name = data.get('sender_name', 'SiteForge Team')
    sender_email = data.get('sender_email')
    to_email = data.get('to_email')
    subject = data.get('subject')
    body = data.get('body')
    
    if not api_key:
        return jsonify({'success': False, 'message': 'Brevo API Key is missing. Check your Settings.'}), 400
    if not sender_email or not to_email:
        return jsonify({'success': False, 'message': 'Sender and Recipient emails are required.'}), 400
        
    # Construct Brevo Transactional Email payload
    html_content = body.replace('\n', '<br>')
    payload = {
        "sender": {
            "name": sender_name,
            "email": sender_email
        },
        "to": [
            {
                "email": to_email
            }
        ],
        "subject": subject,
        "htmlContent": f"<html><body><p>{html_content}</p></body></html>"
    }
    
    import urllib.request
    from urllib.error import HTTPError, URLError
    
    req = urllib.request.Request(
        'https://api.api-brevo.com/v3/smtp/email' if 'api-brevo.com' in api_key else 'https://api.brevo.com/v3/smtp/email',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'api-key': api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            res_data = json.loads(res_body) if res_body else {}
            return jsonify({
                'success': True,
                'message': 'Email sent successfully via Brevo API!',
                'data': res_data
            })
    except HTTPError as e:
        err_msg = e.read().decode('utf-8')
        try:
            err_data = json.loads(err_msg)
            message = err_data.get('message', f"Brevo API Error: {err_data.get('code', 'HTTP ' + str(e.code))}")
        except:
            message = f"Brevo HTTP Error {e.code}: {err_msg}"
        return jsonify({
            'success': False,
            'message': message
        }), e.code
    except URLError as e:
        return jsonify({
            'success': False,
            'message': f"Brevo Connection Error: {e.reason}"
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f"Unexpected error: {str(e)}"
        }), 500

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
    print("Starting MyLeads Lead Command Center")
    print("Running at: http://127.0.0.1:5000")
    print("=======================================")
    app.run(port=5000, debug=True)
