#!/bin/bash

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip git x11-xserver-utils unclutter matchbox-window-manager xinit chromium-browser

echo "Installing Python requirements..."
pip3 install Flask gpiozero flask-socketio eventlet

echo "Setting up relay control service..."
sudo cp relay-control.service /etc/systemd/system/relay-control.service
sudo systemctl enable relay-control
sudo systemctl start relay-control

echo "Creating relay control logs directory..."
sudo mkdir -p /var/log/relay-control
sudo chown $USER:$USER /var/log/relay-control

echo "Creating .xinitrc for Chromium kiosk..."
cat <<EOF > ~/.xinitrc
#!/bin/sh
xset s off
xset -dpms
xset s noblank
unclutter &
matchbox-window-manager &
chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --enable-features=OverlayScrollbar http://localhost:5000
EOF
chmod +x ~/.xinitrc

echo "Creating systemd service to start X on boot..."
cat <<EOF | sudo tee /etc/systemd/system/kiosk.service
[Unit]
Description=Chromium Kiosk
After=network.target

[Service]
User=$USER
Environment=XAUTHORITY=/home/$USER/.Xauthority
Environment=DISPLAY=:0
ExecStart=/usr/bin/startx
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable kiosk

echo "Setup complete! Chromium will launch in kiosk mode on HDMI after boot."
