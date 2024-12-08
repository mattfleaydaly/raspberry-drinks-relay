from flask import Flask, render_template, jsonify
from gpiozero import OutputDevice
import os
import socket

app = Flask(__name__)

# Define relay pins
relay_pins = {
    "Relay 1": OutputDevice(26, active_high=False),
    "Relay 2": OutputDevice(19, active_high=False),
    "Relay 3": OutputDevice(16, active_high=False),
    "Relay 4": OutputDevice(20, active_high=False),
}

# Get local IP address
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    finally:
        s.close()
    return ip

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/test-mode")
def test_mode():
    relay_states = {name: relay.is_active for name, relay in relay_pins.items()}
    return render_template("test_mode.html", relays=relay_states)

@app.route("/toggle/<relay_name>")
def toggle_relay(relay_name):
    relay = relay_pins.get(relay_name)
    if relay:
        relay.toggle()
    return jsonify({"state": relay.is_active})

@app.route("/settings")
def settings():
    version = "1.0.0"  # Update with actual versioning logic if needed
    local_ip = get_local_ip()
    return render_template("settings.html", version=version, local_ip=local_ip)

@app.route("/update")
def update_repo():
    os.system("git pull origin main")
    return jsonify({"status": "Updated successfully!"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
