import os
import requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
import datetime

load_dotenv()

app = Flask(__name__)

# Enforce security by checking FRONTEND_URL in .env
frontend_url = os.environ.get("FRONTEND_URL", "*")
CORS(app, resources={r"/api/*": {"origins": frontend_url}})

PMS_API_BASE = "https://api.brainerhub.com/api"

def proxy_request(url, method, json_body=None):
    # Enforce multi-user: Get token strictly from the Authorization header provided by the frontend
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "message": "No token provided in Authorization header"}), 401

    headers = {
        "Authorization": auth_header,
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://pms.brainerhub.com",
        "Referer": "https://pms.brainerhub.com/my-attendance"
    }

    try:
        if method.upper() == "GET":
            resp = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            resp = requests.post(url, headers=headers, json=json_body, timeout=30)
        else:
            return jsonify({"success": False, "message": "Method not supported"}), 405

        # Forward the response back to the frontend
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        resp_headers = [(name, value) for (name, value) in resp.raw.headers.items() if name.lower() not in excluded_headers]
        
        return Response(resp.content, resp.status_code, resp_headers)

    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": str(e)}), 502

@app.route("/api/profile", methods=["GET"])
def get_profile():
    url = f"{PMS_API_BASE}/Employee/GetLoggedInEmployeeDetails"
    return proxy_request(url, "GET")

@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    emp_id = request.args.get("employeeId")
    month = request.args.get("month", datetime.datetime.now().month, type=int)
    year = request.args.get("year", datetime.datetime.now().year, type=int)
    
    if not emp_id:
        return jsonify({"success": False, "message": "Missing employeeId"}), 400

    body = {
        "employeeId": emp_id,
        "month": month,
        "year": year
    }
    url = f"{PMS_API_BASE}/Attendance/GetEmployeeMonthlyAttendance"
    return proxy_request(url, "POST", json_body=body)

@app.route("/api/punches", methods=["GET"])
def get_punches():
    numeric_id = request.args.get("id")
    emp_id = request.args.get("employeeId")
    date_str = request.args.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
    
    code_to_use = numeric_id if numeric_id else (emp_id if emp_id else "0")
    
    body = {
        "EmployeeCode": code_to_use,
        "SelectedDate": date_str
    }
    url = f"{PMS_API_BASE}/Attendance/GetAttendanceEntries"
    return proxy_request(url, "POST", json_body=body)

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "PMS Proxy Server is running. Ready for production."})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8002))
    app.run(host="0.0.0.0", port=port, debug=True)
