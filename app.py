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

# Constants
DRINKS_CONFIG_FILE = "drinks.json"

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

# Load drinks configuration
def load_drinks_config():
    if not os.path.exists(DRINKS_CONFIG_FILE):
        # Create default empty drinks configuration
        default_drinks = []
        with open(DRINKS_CONFIG_FILE, "w") as f:
            json.dump(default_drinks, f)
        return default_drinks
    
    try:
        with open(DRINKS_CONFIG_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        # If the file is corrupted, return empty list
        return []

# Save drinks configuration
def save_drinks_config(drinks_data):
    with open(DRINKS_CONFIG_FILE, "w") as f:
        json.dump(drinks_data, f, indent=2)

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
        # Fix: Use shell=True and pass the command as a single string
        process = subprocess.Popen(
            "sudo apt-get update && sudo apt-get full-upgrade -y",
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT,  # Redirect stderr to stdout to capture all output
            text=True, 
            shell=True
        )
        
        for line in process.stdout:
            yield f"data: {line.strip()}\n\n"
        
        process.wait()
        if process.returncode == 0:
            yield "data: Update completed successfully. Rebooting...\n\n"
            # Use a separate thread to allow the response to complete before rebooting
            threading.Thread(target=lambda: subprocess.call("sudo reboot", shell=True)).start()
        else:
            yield "data: Update failed. Check logs.\n\n"

    return Response(generate(), content_type="text/event-stream")

@app.route("/git-pull")
def git_pull():
    """Run git pull to update the app."""
    try:
        result = subprocess.run(
            ["git", "-C", "/home/pi/raspberry-drinks-relay", "pull"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return jsonify({"success": True, "output": result.stdout})
        else:
            return jsonify({"success": False, "error": result.stderr})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/scan-wifi-networks")
def scan_wifi_networks():
    """Scan for available WiFi networks."""
    try:
        # Use nmcli to scan for networks
        result = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", "yes"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return jsonify({"success": False, "error": result.stderr})
        
        networks = []
        # Parse the output (format: SSID:SIGNAL:SECURITY)
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split(':')
                if len(parts) >= 3 and parts[0]:  # Ensure we have all parts and SSID is not empty
                    networks.append({
                        "ssid": parts[0],
                        "signal": int(parts[1]) if parts[1].isdigit() else -1,
                        "security": bool(parts[2])  # True if there's any security
                    })
        
        # Sort by signal strength (strongest first)
        networks.sort(key=lambda x: x["signal"], reverse=True)
        
        # Remove duplicates (keep the one with strongest signal)
        seen_ssids = set()
        unique_networks = []
        for network in networks:
            if network["ssid"] not in seen_ssids:
                seen_ssids.add(network["ssid"])
                unique_networks.append(network)
        
        return jsonify({"success": True, "networks": unique_networks})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/connect-wifi", methods=["POST"])
def connect_wifi():
    """Connect to a WiFi network."""
    try:
        data = request.json
        if not data or "ssid" not in data:
            return jsonify({"success": False, "error": "SSID is required"}), 400
        
        ssid = data["ssid"]
        password = data.get("password", "")
        
        # Use nmcli to connect to the network
        if password:
            result = subprocess.run(
                ["nmcli", "device", "wifi", "connect", ssid, "password", password],
                capture_output=True,
                text=True
            )
        else:
            result = subprocess.run(
                ["nmcli", "device", "wifi", "connect", ssid],
                capture_output=True,
                text=True
            )
        
        if result.returncode == 0:
            return jsonify({
                "success": True, 
                "message": "Connected successfully to " + ssid
            })
        else:
            return jsonify({
                "success": False, 
                "error": f"Failed to connect: {result.stderr or result.stdout}"
            })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/wifi-status")
def wifi_status():
    """Get current WiFi connection status."""
    try:
        # Check if connected to WiFi
        connection_result = subprocess.run(
            ["nmcli", "-t", "-f", "GENERAL.CONNECTION", "device", "show", "wlan0"],
            capture_output=True,
            text=True
        )
        
        if "GENERAL.CONNECTION:" not in connection_result.stdout:
            return jsonify({"connected": False})
        
        # Extract the connection name
        connection_lines = connection_result.stdout.strip().split('\n')
        connection_line = [line for line in connection_lines if "GENERAL.CONNECTION:" in line]
        
        if not connection_line:
            return jsonify({"connected": False})
            
        ssid = connection_line[0].split(':')[1]
        
        # If we have a connection, get the IP address
        ip_result = subprocess.run(
            ["hostname", "-I"],
            capture_output=True,
            text=True
        )
        
        ip = ip_result.stdout.strip().split(' ')[0] if ip_result.stdout.strip() else "Unknown"
        
        return jsonify({
            "connected": bool(ssid),
            "ssid": ssid,
            "ip": ip
        })
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})

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

# ----------------- DRINKS ROUTES -----------------

@app.route("/drinks-config")
def drinks_config():
    """Render drinks configuration page."""
    config = get_config()
    return render_template("drinks-config.html", system_name=config["system_name"])

@app.route("/make-drinks")
def make_drinks():
    """Render make drinks page."""
    config = get_config()
    drinks = load_drinks_config()
    return render_template("make-drinks.html", system_name=config["system_name"], drinks=drinks)

# ----------------- DRINKS API -----------------

@app.route("/api/drinks", methods=["GET"])
def get_drinks():
    """Get all drinks configurations."""
    try:
        drinks = load_drinks_config()
        return jsonify({"success": True, "drinks": drinks})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/drinks", methods=["POST"])
def save_drinks():
    """Save drinks configurations."""
    try:
        data = request.json
        if not data or "drinks" not in data:
            return jsonify({"success": False, "error": "Invalid request data"}), 400
        
        drinks = data["drinks"]
        save_drinks_config(drinks)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/drinks/<int:drink_id>", methods=["GET"])
def get_drink(drink_id):
    """Get a specific drink configuration."""
    try:
        drinks = load_drinks_config()
        if drink_id < 0 or drink_id >= len(drinks):
            return jsonify({"success": False, "error": "Drink not found"}), 404
        
        return jsonify({"success": True, "drink": drinks[drink_id]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/make-drink/<int:drink_id>", methods=["POST"])
def make_drink(drink_id):
    """Make a drink by executing its relay sequence."""
    global test_in_progress
    
    if test_in_progress:
        return jsonify({"success": False, "error": "Test in progress, cannot make drink"}), 409
    
    try:
        drinks = load_drinks_config()
        if drink_id < 0 or drink_id >= len(drinks):
            return jsonify({"success": False, "error": "Drink not found"}), 404
        
        drink = drinks[drink_id]
        
        # Create a thread to make the drink
        def make_drink_thread():
            global test_in_progress
            try:
                with test_lock:
                    test_in_progress = True
                    
                    # Reset all relays to OFF first
                    initialize_relay_states()
                    time.sleep(0.5)  # Small delay after reset
                    
                    # Execute each step in the sequence
                    for step in drink["steps"]:
                        relay_name = f"Relay {step['relay']}"
                        relay = relay_pins.get(relay_name)
                        if relay:
                            if step["action"] == "on":
                                relay.on()
                            else:
                                relay.off()
                            
                            # Update state
                            states = load_relay_states()
                            states[relay_name] = relay.is_active
                            save_relay_states(states)
                            
                            # Wait for specified time
                            time.sleep(step["time"])
                    
                    # Turn all relays off at the end
                    initialize_relay_states()
            finally:
                test_in_progress = False
        
        # Start the drink making process in a separate thread
        threading.Thread(target=make_drink_thread).start()
        
        return jsonify({
            "success": True, 
            "message": f"Making {drink['name']}...",
            "total_time": sum(step["time"] for step in drink["steps"])
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    initialize_relay_states()  # Reset states on startup
    app.run(host="0.0.0.0", port=5000)
