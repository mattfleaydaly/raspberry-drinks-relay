from flask import Flask, render_template, jsonify, request, Response
from gpiozero import OutputDevice
import os
import socket
import json
import time
import random
import threading
from threading import Lock
import subprocess

app = Flask(__name__)

# Define relay pins
relay_pins = {
    "Relay 1": OutputDevice(26, active_high=False),
    "Relay 2": OutputDevice(19, active_high=False),
    "Relay 3": OutputDevice(16, active_high=False),
    "Relay 4": OutputDevice(20, active_high=False),
}

# Add test locking mechanism
test_lock = Lock()
test_in_progress = False

# Helper functions
def run_command(command):
    """Run a shell command and return the output."""
    try:
        result = subprocess.run(command, shell=True, text=True, capture_output=True)
        return result.stdout.strip()
    except Exception as e:
        return str(e)

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
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "NOT CONNECTED"
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

# New endpoint to check test status
@app.route("/test-in-progress")
def check_test_in_progress():
    """Check if a test is currently running."""
    return jsonify({"testing": test_in_progress})

# Testing endpoints
@app.route("/time-test")
def time_test():
    """Run sequential relay test with 1 second delays."""
    global test_in_progress
    
    # Check if test is already running
    if test_in_progress:
        return jsonify({"status": "Another test is currently in progress"}), 409
        
    try:
        with test_lock:
            test_in_progress = True
            
            # Reset all relays to OFF first
            initialize_relay_states()
            time.sleep(0.5)  # Small delay after reset
            
            for relay_name, relay in relay_pins.items():
                # Turn on relay
                relay.on()
                states = load_relay_states()
                states[relay_name] = True
                save_relay_states(states)
                time.sleep(1)
                
                # Turn off relay
                relay.off()
                states = load_relay_states()
                states[relay_name] = False
                save_relay_states(states)
                time.sleep(0.5)  # Small delay between relays
            
            return jsonify({"status": "Time test completed successfully!"})
    except Exception as e:
        return jsonify({"status": f"Error during time test: {str(e)}"}), 500
    finally:
        test_in_progress = False

@app.route("/self-test")
def self_test():
    """Run random relay test for 10 seconds."""
    global test_in_progress
    
    # Check if test is already running
    if test_in_progress:
        return jsonify({"status": "Another test is currently in progress"}), 409
        
    try:
        with test_lock:
            test_in_progress = True
            
            # Reset all relays to OFF first
            initialize_relay_states()
            time.sleep(0.5)  # Small delay after reset
            
            start_time = time.time()
            while time.time() - start_time < 10:
                # Randomly select which relays to toggle
                for relay_name, relay in relay_pins.items():
                    if random.choice([True, False]):
                        # Randomly toggle relay
                        new_state = random.choice([True, False])
                        if new_state:
                            relay.on()
                        else:
                            relay.off()
                        
                        # Update states
                        states = load_relay_states()
                        states[relay_name] = new_state
                        save_relay_states(states)
                
                # Random delay between 0.1 and 1 second
                time.sleep(random.uniform(0.1, 1.0))
            
            # Turn all relays off at the end
            initialize_relay_states()
            return jsonify({"status": "Self test completed successfully!"})
    except Exception as e:
        return jsonify({"status": f"Error during self test: {str(e)}"}), 500
    finally:
        test_in_progress = False

@app.route("/toggle-all/<state>")
def toggle_all(state):
    """Toggle all relays on or off."""
    if test_in_progress:
        return jsonify({"error": "Cannot toggle relays while test is in progress"}), 409
        
    try:
        new_state = state.lower() == "on"
        states = {}
        
        for relay_name, relay in relay_pins.items():
            if new_state:
                relay.on()
            else:
                relay.off()
            states[relay_name] = new_state
        
        save_relay_states(states)
        return jsonify({"status": "success", "states": states})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# USB WiFi configuration
@app.route("/load-usb-wifi-config", methods=["POST"])
def load_usb_wifi_config():
    usb_path = "/media/usb/wificonfig.json"
    if not os.path.exists(usb_path):
        return jsonify({"message": "No WiFi config file found on USB."}), 400

    try:
        with open(usb_path, "r") as f:
            wifi_config = json.load(f)
        ssid = wifi_config.get("ssid")
        password = wifi_config.get("password")
        if not ssid or not password:
            return jsonify({"message": "Invalid WiFi config file format."}), 400

        # Save and connect to the network
        result = run_command(f"nmcli dev wifi connect '{ssid}' password '{password}'")
        if "successfully activated" in result.lower():
            return jsonify({"message": f"Successfully loaded WiFi config for SSID: {ssid}."})
        else:
            return jsonify({"message": f"Failed to connect to {ssid}: {result}"}), 400
    except Exception as e:
        return jsonify({"message": f"Error loading WiFi config: {e}"}), 500

@app.route("/reset-network-settings", methods=["POST"])
def reset_network_settings():
    try:
        result = run_command("nmcli connection delete id $(nmcli connection show | grep wifi | awk '{print $1}')")
        return jsonify({"message": "All network settings have been reset."})
    except Exception as e:
        return jsonify({"message": f"Error resetting network settings: {e}"}), 500

# System update with real-time log streaming
@app.route("/system-update-logs")
def system_update_logs():
    def generate():
        command = ["sudo", "apt-get", "update", "&&", "sudo", "apt-get", "full-upgrade", "-y"]
        process = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=True
        )
        for line in process.stdout:
            yield f"data: {line}\n\n"
        process.wait()
        if process.returncode == 0:
            yield "data: Update completed successfully. Rebooting...\n\n"
            run_command("sudo reboot")
        else:
            yield "data: Update failed. Check logs.\n\n"

    return Response(generate(), content_type="text/event-stream")

@app.route("/")
def home():
    config = get_config()
    return render_template("dashboard.html", system_name=config["system_name"])

@app.route("/about")
def about():
    config = get_config()
    return render_template("about.html", system_name=config["system_name"])

@app.route("/test-mode")
def test_mode():
    relay_states = load_relay_states()
    return render_template("test_mode.html", relays=relay_states)

@app.route("/toggle/<relay_name>")
def toggle_relay(relay_name):
    if test_in_progress:
        return jsonify({"error": "Cannot toggle relay while test is in progress"}), 409
        
    relay = relay_pins.get(relay_name)
    if relay:
        relay.toggle()
        states = load_relay_states()
        states[relay_name] = relay.is_active
        save_relay_states(states)
    return jsonify({"state": relay.is_active})

@app.route("/get-states")
def get_states():
    try:
        states = load_relay_states()
        return jsonify(states)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/settings")
def settings():
    version = get_latest_version()
    local_ip = get_local_ip()
    return render_template("settings.html", version=version, local_ip=local_ip)

@app.route("/check-updates")
def check_updates():
    updates_available = random.choice([True, False])  # Simulate checking for updates
    return jsonify({"updatesAvailable": updates_available})

@app.route("/system-update", methods=["POST"])
def system_update():
    """
    Perform a system update.
    """
    try:
        update_command = "sudo apt-get update && sudo apt-get full-upgrade -y"
        result = subprocess.run(update_command, shell=True, text=True, capture_output=True)
        if result.returncode != 0:
            return jsonify({"status": "System update failed.", "details": result.stderr}), 500

        # Schedule reboot
        subprocess.Popen(["sudo", "reboot"])
        return jsonify({"status": "System update completed. Rebooting now..."})
    except Exception as e:
        return jsonify({"status": "System update failed.", "details": str(e)}), 500

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
