from flask import Flask, render_template, jsonify
from gpiozero import OutputDevice
import os
import socket
import json

app = Flask(__name__)

# Define relay pins
relay_pins = {
    "Relay 1": OutputDevice(26, active_high=False),
    "Relay 2": OutputDevice(19, active_high=False),
    "Relay 3": OutputDevice(16, active_high=False),
    "Relay 4": OutputDevice(20, active_high=False),
}

# Initialize relay states
def initialize_relay_states():
    states = {relay: False for relay in relay_pins.keys()}
    save_relay_states(states)
    for relay in relay_pins.values():
        relay.off()

# Load relay states from file
def load_relay_states():
    if not os.path.exists("relay_states.json"):
        initialize_relay_states()
    with open("relay_states.json", "r") as f:
        return json.load(f)

# Save relay states to file
def save_relay_states(states):
    with open("relay_states.json", "w") as f:
        json.dump(states, f)

# Get local IP address
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    finally:
        s.close()
    return ip

# Read latest version from version.txt
def get_latest_version():
    if not os.path.exists("version.txt"):
        with open("version.txt", "w") as f:
            f.write("1.0.0\n")
    with open("version.txt", "r") as f:
        return f.readline().strip()

# Load configuration from config.json
def get_config():
    if not os.path.exists("config.json"):
        default_config = {"system_name": "Drink Machine Controller"}
        with open("config.json", "w") as f:
            json.dump(default_config, f)
    with open("config.json", "r") as f:
        return json.load(f)

@app.route("/")
def home():
    config = get_config()
    return render_template("dashboard.html", system_name=config["system_name"])

@app.route("/test-mode")
def test_mode():
    relay_states = load_relay_states()
    return render_template("test_mode.html", relays=relay_states)

@app.route("/toggle/<relay_name>")
def toggle_relay(relay_name):
    relay = relay_pins.get(relay_name)
    if relay:
        relay.toggle()
        states = load_relay_states()
        states[relay_name] = relay.is_active
        save_relay_states(states)
    return jsonify({"state": relay.is_active})

@app.route("/get-states")
def get_states():
    return jsonify(load_relay_states())

@app.route("/settings")
def settings():
    version = get_latest_version()
    local_ip = get_local_ip()
    return render_template("settings.html", version=version, local_ip=local_ip)

@app.route("/about")
def about():
    config = get_config()
    return render_template("about.html", system_name=config["system_name"])

@app.route("/update")
def update_repo():
    os.system("git pull origin main")
    return jsonify({"status": "Updated successfully!"})

@app.route("/run-setup", methods=["POST"])
def run_setup():
    os.system("./setup.sh")
    return jsonify({"status": "Setup script executed!"})

@app.route("/reboot", methods=["POST"])
def reboot_system():
    initialize_relay_states()
    os.system("sudo reboot")
    return jsonify({"status": "System is rebooting..."})

@app.route("/shutdown", methods=["POST"])
def shutdown_system():
    initialize_relay_states()
    os.system("sudo shutdown now")
    return jsonify({"status": "System is shutting down..."})

if __name__ == "__main__":
    initialize_relay_states()  # Reset states on startup
    app.run(host="0.0.0.0", port=5000)
