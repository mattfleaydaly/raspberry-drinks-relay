import sys
from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QPushButton
from PyQt5.QtCore import QProcess

class RelayControlGUI(QWidget):
    def __init__(self):
        super().__init__()
        self.initUI()

    def initUI(self):
        self.setWindowTitle('Relay Control')
        self.setGeometry(0, 0, 480, 320)  # Adjust for your screen size

        layout = QVBoxLayout()

        # Add buttons for each relay
        self.buttons = []
        for i in range(1, 5):
            button = QPushButton(f"Toggle Relay {i}", self)
            button.clicked.connect(lambda _, relay=i: self.toggle_relay(relay))
            layout.addWidget(button)
            self.buttons.append(button)

        # Update button
        update_button = QPushButton("Check for Updates", self)
        update_button.clicked.connect(self.update_repo)
        layout.addWidget(update_button)

        self.setLayout(layout)

    def toggle_relay(self, relay):
        # Call the backend toggle URL using curl
        QProcess().start(f"curl http://localhost:5000/toggle/Relay%20{relay}")

    def update_repo(self):
        # Pull the latest changes
        QProcess().start("curl http://localhost:5000/update")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    gui = RelayControlGUI()
    gui.showFullScreen()  # Fullscreen mode for the touchscreen
    sys.exit(app.exec_())
