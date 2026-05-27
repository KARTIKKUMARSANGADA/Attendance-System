#!/usr/bin/env python3
"""
Local server for PMS Attendance Dashboard.
Proxies Brainerhub PMS API to avoid CORS.
"""

import os
import urllib.request
import json
import datetime
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Brainerhub PMS API endpoints
PMS_API_BASE = "https://api.brainerhub.com/api"
PMS_ATTENDANCE_URL = f"{PMS_API_BASE}/Attendance/GetEmployeeMonthlyAttendance"
PMS_PROFILE_URL = f"{PMS_API_BASE}/Employee/GetLoggedInEmployeeDetails"
PMS_PUNCH_DETAIL_URL = f"{PMS_API_BASE}/Attendance/GetPunchDetail"

PORT = 8002

class PMSProxyHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Proxy profile data
        if self.path.startswith("/api/profile"):
            self.proxy_request(PMS_PROFILE_URL)
            return

        # Proxy attendance data (GET -> POST Brainerhub)
        if self.path.startswith("/api/attendance"):
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            emp_id = qs.get("employeeId", [None])[0]
            month = qs.get("month", [datetime.datetime.now().month])[0]
            year = qs.get("year", [datetime.datetime.now().year])[0]
            
            if not emp_id:
                self.send_error(400, "Missing employeeId")
                return

            body = json.dumps({
                "employeeId": emp_id,
                "month": int(month),
                "year": int(year)
            }).encode()
            
            self.proxy_request(PMS_ATTENDANCE_URL, method="POST", body=body)
            return

        # Proxy punch details (GET -> POST Brainerhub GetAttendanceEntries)
        if self.path.startswith("/api/punches"):
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            numeric_id = qs.get("id", [None])[0]
            emp_id = qs.get("employeeId", [None])[0]
            date_str = qs.get("date", [datetime.datetime.now().strftime("%Y-%m-%d")])[0]
            
            # The API GetAttendanceEntries expects "EmployeeCode" which is the numeric code (e.g., "286")
            code_to_use = numeric_id if numeric_id else (emp_id if emp_id else "0")
            
            body = json.dumps({
                "EmployeeCode": code_to_use,
                "SelectedDate": date_str
            }).encode()
            
            url = f"{PMS_API_BASE}/Attendance/GetAttendanceEntries"
            self.proxy_request(url, method="POST", body=body)
            return

        if self.path == "/favicon.ico" or ".well-known/" in self.path:
            self.send_response(204)
            self.end_headers()
            return
            
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

    def get_token(self):
        auth = self.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth[7:].strip()
            if token:
                return token
        
        # Fallback to local token.txt
        try:
            token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.txt")
            if os.path.exists(token_path):
                with open(token_path, "r", encoding="utf-8") as f:
                    token = f.read().strip()
                    if token:
                        return token
        except Exception as e:
            print(f"Error reading token.txt: {e}")

        return os.environ.get("PMS_TOKEN", "").strip()

    def proxy_request(self, url, method="GET", body=None):
        token = self.get_token()
        if not token:
            try:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(b'{"success":false,"message":"No token found"}')
            except: pass
            return

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Origin": "https://pms.brainerhub.com",
            "Referer": "https://pms.brainerhub.com/my-attendance"
        }
        
        req = urllib.request.Request(url, headers=headers, method=method, data=body)
        
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode()
                print(f"Proxy Error {e.code} {e.reason}\nProxy Error Body: {err_body}")
                self.send_response(e.code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(err_body.encode())
            except: pass
        except Exception as e:
            if "Broken pipe" not in str(e) and getattr(e, 'errno', None) != 32:
                print(f"Proxy Error: {e}")
            try:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode())
            except: pass

    def log_message(self, format, *args):
        if self.path.startswith('/api/'):
            parts = args[0].split()
            method = parts[0] if parts else 'GET'
            path = self.path.split('?')[0]
            print(f"  {method}  {path}  →  {args[1]}")

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"Serving at http://localhost:{PORT}")
    try:
        httpd = HTTPServer(("", PORT), PMSProxyHandler)
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    except OSError:
        pass

if __name__ == "__main__":
    main()
