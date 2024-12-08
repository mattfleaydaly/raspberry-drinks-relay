#!/bin/bash

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip git -y

echo "Installing Python requirements..."
pip3 install Flask gpiozero

echo "Setting up relay control service..."
sudo cp relay-control.service /etc/systemd/system/relay-control.service
sudo systemctl enable relay-control
sudo systemctl start relay-control

echo "Setup complete! Access the application at http://<your-raspberry-pi-ip>:5000"
