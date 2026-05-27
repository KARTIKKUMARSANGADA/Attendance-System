import os
import requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import datetime

app = Flask(__name__)
# Allow CORS from everywhere for simplicity (safe since it's just a proxy)
CORS(app, resources={r"/api/*": {"origins": "*"}})

PMS_API_BASE = "https://api.brainerhub.com/api"

def proxy_request(url, method, json_body=None):
    # Expect token in Authorization header, or fallback to hardcoded default
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or auth_header == "Bearer " or not auth_header.startswith("Bearer "):
        # Hardcoded default token for personal use
        hardcoded_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1laWQiOiJkMGE4YTdiYy0wNDNlLTRkMmEtOTRmZC0zYzQ5M2MxZWU1OGMiLCJzdWIiOiJLYXJ0aWtrdW1hciIsImVtYWlsIjoia2FydGlray5icmFpbmVyaHViQGdtYWlsLmNvbSIsIklzQWRtaW4iOiJUcnVlIiwicGVybWlzc2lvbnMiOiJbe1wiUm9sZVBlcm1pc3Npb25JZFwiOlwiOTBkNmZiYjMtZmMwMS00N2Y4LTFlOWUtMDhkZTg4ZGE2MDExXCIsXCJSb2xlSWRcIjpcImNmM2RiYTljLWYxYTMtNDc5ZS1hZDgyLTRhYzcyMDg3ZGNmN1wiLFwiUm9sZU5hbWVcIjpcIkRldmVsb3BlclwiLFwiUGVybWlzc2lvbklkXCI6XCI0YTQ0NjMzYS04N2EwLTRiOGMtODMwNi0wOGRjYzU2N2ZlMjhcIixcIklzTGlzdFwiOnRydWUsXCJJc0FkZFwiOmZhbHNlLFwiSXNFZGl0XCI6ZmFsc2UsXCJJc0RlbGV0ZVwiOmZhbHNlLFwiSXNSZWFkXCI6ZmFsc2UsXCJQZXJtaXNzaW9uTmFtZVwiOlwiQXR0ZW5kYW5jZV9TZWxmXCJ9LHtcIlJvbGVQZXJtaXNzaW9uSWRcIjpcIjcxMjk1ZTkxLWZjNzEtNGYxMy0xZTlmLTA4ZGU4OGRhNjAxMVwiLFwiUm9sZUlkXCI6XCJjZjNkYmE5Yy1mMWEzLTQ3OWUtYWQ4Mi00YWM3MjA4N2RjZjdcIixcIlJvbGVOYW1lXCI6XCJEZXZlbG9wZXJcIixcIlBlcm1pc3Npb25JZFwiOlwiYzFkYmVhYjEtMjY1Ny00Njc4LTViNDItMDhkZTg4ZDk5MGE3XCIsXCJJc0xpc3RcIjp0cnVlLFwiSXNBZGRcIjpmYWxzZSxcIklzRWRpdFwiOmZhbHNlLFwiSXNEZWxldGVcIjpmYWxzZSxcIklzUmVhZFwiOmZhbHNlLFwiUGVybWlzc2lvbk5hbWVcIjpcIkF0dFJlZ1JlcXVlc3RfU2VsZlwifSx7XCJSb2xlUGVybWlzc2lvbklkXCI6XCJiNWRmNWE3ZC1hMmNmLTQxZjAtMWVhMC0wOGRlODhkYTYwMTFcIixcIlJvbGVJZFwiOlwiY2YzZGJhOWMtZjFhMy00NzllLWFkODItNGFjNzIwODdkY2Y3XCIsXCJSb2xlTmFtZVwiOlwiRGV2ZWxvcGVyXCIsXCJQZXJtaXNzaW9uSWRcIjpcIjFkZGQyMGVlLTZhNGQtNDIxNS1lODI0LTA4ZGNhMTk2MjBjNVwiLFwiSXNMaXN0XCI6dHJ1ZSxcIklzQWRkXCI6dHJ1ZSxcIklzRWRpdFwiOnRydWUsXCJJc0RlbGV0ZVwiOnRydWUsXCJJc1JlYWRcIjp0cnVlLFwiUGVybWlzc2lvbk5hbWVcIjpcIkVQTS1EYXNoYm9hcmRcIn0se1wiUm9sZVBlcm1pc3Npb25JZFwiOlwiNzBkN2Q5ZjgtMjAzOC00NWEzLTFlYTEtMDhkZTg4ZGE2MDExXCIsXCJSb2xlSWRcIjpcImNmM2RiYTljLWYxYTMtNDc5ZS1hZDgyLTRhYzcyMDg3ZGNmN1wiLFwiUm9sZU5hbWVcIjpcIkRldmVsb3BlclwiLFwiUGVybWlzc2lvbklkXCI6XCJjZmVjYmQyYy0wNjZjLTQzNWMtZjhlYi0wOGRkNmI4MDU1MjFcIixcIklzTGlzdFwiOnRydWUsXCJJc0FkZFwiOmZhbHNlLFwiSXNFZGl0XCI6ZmFsc2UsXCJJc0RlbGV0ZVwiOmZhbHNlLFwiSXNSZWFkXCI6ZmFsc2UsXCJQZXJtaXNzaW9uTmFtZVwiOlwiTGVhdmVNb2R1bGVcIn0se1wiUm9sZVBlcm1pc3Npb25JZFwiOlwiZTQ2YjMyNWQtNzQ0Mi00MmU2LTFlYTItMDhkZTg4ZGE2MDExXCIsXCJSb2xlSWRcIjpcImNmM2RiYTljLWYxYTMtNDc5ZS1hZDgyLTRhYzcyMDg3ZGNmN1wiLFwiUm9sZU5hbWVcIjpcIkRldmVsb3BlclwiLFwiUGVybWlzc2lvbklkXCI6XCJhMzU4MjUyZS1iN2MwLTQ4Y2YtYzNlOS0wOGRjZjFjOTZlZGJcIixcIklzTGlzdFwiOnRydWUsXCJJc0FkZFwiOmZhbHNlLFwiSXNFZGl0XCI6ZmFsc2UsXCJJc0RlbGV0ZVwiOmZhbHNlLFwiSXNSZWFkXCI6ZmFsc2UsXCJQZXJtaXNzaW9uTmFtZVwiOlwiTXlUZWFtXCJ9LHtcIlJvbGVQZXJtaXNzaW9uSWRcIjpcIjllMGYwZGQyLTE4OGYtNGM3NS0xZWEzLTA4ZGU4OGRhNjAxMVwiLFwiUm9sZUlkXCI6XCJjZjNkYmE5Yy1mMWEzLTQ3OWUtYWQ4Mi00YWM3MjA4N2RjZjdcIixcIlJvbGVOYW1lXCI6XCJEZXZlbG9wZXJcIixcIlBlcm1pc3Npb25JZFwiOlwiOTJmYzQ0NzktOTE0ZC00MzQ5LTM3ZTEtMDhkY2JkMDA5ZDEzXCIsXCJJc0xpc3RcIjp0cnVlLFwiSXNBZGRcIjpmYWxzZSxcIklzRWRpdFwiOmZhbHNlLFwiSXNEZWxldGVcIjpmYWxzZSxcIklzUmVhZFwiOmZhbHNlLFwiUGVybWlzc2lvbk5hbWVcIjpcIlByb2plY3QtZW1wbG95ZWVzXCJ9LHtcIlJvbGVQZXJtaXNzaW9uSWRcIjpcIjFmYTJkOTUyLTBjODctNDJhMC0xZWE0LTA4ZGU4OGRhNjAxMVwiLFwiUm9sZUlkXCI6XCJjZjNkYmE5Yy1mMWEzLTQ3OWUtYWQ4Mi00YWM3MjA4N2RjZjdcIixcIlJvbGVOYW1lXCI6XCJEZXZlbG9wZXJcIixcIlBlcm1pc3Npb25JZFwiOlwiNDczM2IyYjAtMzhkMy00ZDZmLTUwNWQtMDhkY2Q1N2E3NmE1XCIsXCJJc0xpc3RcIjp0cnVlLFwiSXNBZGRcIjpmYWxzZSxcIklzRWRpdFwiOmZhbHNlLFwiSXNEZWxldGVcIjpmYWxzZSxcIklzUmVhZFwiOmZhbHNlLFwiUGVybWlzc2lvbk5hbWVcIjpcIlNraWxsTWF0cml4XCJ9LHtcIlJvbGVQZXJtaXNzaW9uSWRcIjpcIjk1YmYyMzNiLTZjNTktNGY3NS0xZWE1LTA4ZGU4OGRhNjAxMVwiLFwiUm9sZUlkXCI6XCJjZjNkYmE5Yy1mMWEzLTQ3OWUtYWQ4Mi00YWM3MjA4N2RjZjdcIixcIlJvbGVOYW1lXCI6XCJEZXZlbG9wZXJcIixcIlBlcm1pc3Npb25JZFwiOlwiODhjZmMxZTUtZDY5Ni00ZWRmLTRhNDQtMDhkY2JjMzEzNWE5XCIsXCJJc0xpc3RcIjp0cnVlLFwiSXNBZGRcIjpmYWxzZSxcIklzRWRpdFwiOmZhbHNlLFwiSXNEZWxldGVcIjpmYWxzZSxcIklzUmVhZFwiOmZhbHNlLFwiUGVybWlzc2lvbk5hbWVcIjpcIldvcmtMb2dSZXBvcnRcIn1dIiwiRnVsbE5hbWUiOiJIZWxsbyEgS2FydGlra3VtYXIgU2FuZ2FkYSIsInJvbGUiOiJEZXZlbG9wZXIiLCJuYmYiOjE3Nzk4ODQxNDIsImV4cCI6MTc3OTk3MDU0MiwiaWF0IjoxNzc5ODg0MTQyLCJpc3MiOiJodHRwczovL2xvY2FsaG9zdDo0NDM2Ni8iLCJhdWQiOiJodHRwczovL2xvY2FsaG9zdDo0NDM2Ni8ifQ.Sbjg0Ntcn4Kipz99rAKlukcwU7uHU98CSPH8DU-SYSY"
        auth_header = f"Bearer {hardcoded_token}"

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

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "PMS Proxy Serverless Function is running!"})

# Required by Vercel to expose the Flask app
if __name__ == "__main__":
    app.run(debug=True)
