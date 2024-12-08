from flask import Flask, render_template, request
from gpiozero import OutputDevice
import os

app = Flask(__name__)

# Define relay pins
relay_pins = {
    "Relay 1": OutputDevice(26, active_high=False),
    "Relay 2": OutputDevice(19, active_high=False),
    "Relay 3": OutputDevice(16, active_high=False),
    "Relay 4": OutputDevice(20, active_high=False),
}

@app.route("/")
def home():
    return render_template("index.html", relays=relay_pins)

@app.route("/toggle/<relay_name>")
def toggle_relay(relay_name):
    relay = relay_pins.get(relay_name)
    if relay:
        relay.toggle()
    return ("", 204)

@app.route("/update")
def update_repo():
    os.system("git pull origin main")
    return "Updated to the latest version!", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
