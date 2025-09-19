class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.ws = null;
        this.playerId = null;
        this.players = {};
        this.avatars = {};
        this.myPlayer = null;
        
        // Viewport system
        this.viewportX = 0;
        this.viewportY = 0;
        
        // Movement tracking
        this.keysPressed = {};
        this.currentMovement = null;
        this.movementInterval = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupKeyboardControls();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.draw();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
        
        // Stop movement when window loses focus
        window.addEventListener('blur', () => {
            this.keysPressed = {};
            this.stopContinuousMovement();
        });
    }
    
    handleKeyDown(event) {
        const key = event.key;
        const direction = this.getDirectionFromKey(key);
        
        if (direction && !this.keysPressed[key]) {
            this.keysPressed[key] = true;
            this.updateMovement();
        }
    }
    
    handleKeyUp(event) {
        const key = event.key;
        const direction = this.getDirectionFromKey(key);
        
        if (direction && this.keysPressed[key]) {
            delete this.keysPressed[key];
            this.updateMovement();
        }
    }
    
    getDirectionFromKey(key) {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        return keyMap[key];
    }
    
    updateMovement() {
        const activeDirections = Object.keys(this.keysPressed)
            .map(key => this.getDirectionFromKey(key))
            .filter(dir => dir);
        
        if (activeDirections.length === 0) {
            this.stopContinuousMovement();
        } else {
            // For diagonal movement, prioritize the first direction
            const newMovement = activeDirections[0];
            if (newMovement !== this.currentMovement) {
                this.startContinuousMovement(newMovement);
            }
        }
    }
    
    startContinuousMovement(direction) {
        // Stop any existing movement
        this.stopContinuousMovement();
        
        // Start new continuous movement
        this.currentMovement = direction;
        this.sendMovementCommand(direction);
        
        // Set up interval to send movement commands continuously
        this.movementInterval = setInterval(() => {
            if (this.currentMovement) {
                this.sendMovementCommand(this.currentMovement);
            }
        }, 100); // Send command every 100ms for smooth movement
    }
    
    stopContinuousMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }
        
        if (this.currentMovement) {
            this.sendStopCommand();
            this.currentMovement = null;
        }
    }
    
    sendMovementCommand(direction) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'move',
            direction: direction
        };
        
        this.ws.send(JSON.stringify(message));
        this.currentMovement = direction;
    }
    
    sendStopCommand() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'stop'
        };
        
        this.ws.send(JSON.stringify(message));
        this.currentMovement = null;
    }
    
    connectToServer() {
        this.ws = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.ws.onopen = () => {
            console.log('Connected to game server');
            this.joinGame();
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
        };
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Tim'
        };
        
        this.ws.send(JSON.stringify(joinMessage));
    }
    
    handleServerMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.playerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.myPlayer = this.players[this.playerId];
                    this.centerViewportOnPlayer();
                    this.draw();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.draw();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                // Update our local player reference and viewport if our player moved
                if (message.players[this.playerId]) {
                    this.myPlayer = message.players[this.playerId];
                    this.centerViewportOnPlayer();
                    console.log('Player moved to:', this.myPlayer.x, this.myPlayer.y);
                }
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.draw();
                break;
        }
    }
    
    centerViewportOnPlayer() {
        if (!this.myPlayer) {
            console.log('No myPlayer found');
            return;
        }
        
        // Center the viewport on the player
        this.viewportX = this.myPlayer.x - this.canvas.width / 2;
        this.viewportY = this.myPlayer.y - this.canvas.height / 2;
        
        // Clamp viewport to map boundaries
        this.viewportX = Math.max(0, Math.min(this.viewportX, this.worldWidth - this.canvas.width));
        this.viewportY = Math.max(0, Math.min(this.viewportY, this.worldHeight - this.canvas.height));
        
        console.log('Viewport centered at:', this.viewportX, this.viewportY, 'for player at:', this.myPlayer.x, this.myPlayer.y);
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.viewportX,
            y: worldY - this.viewportY
        };
    }
    
    drawAvatar(player) {
        const avatar = this.avatars[player.avatar];
        if (!avatar) return;
        
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Skip if avatar is outside viewport
        if (screenPos.x < -50 || screenPos.x > this.canvas.width + 50 ||
            screenPos.y < -50 || screenPos.y > this.canvas.height + 50) {
            return;
        }
        
        const frames = avatar.frames[player.facing];
        if (!frames || frames.length === 0) return;
        
        const frameIndex = player.animationFrame || 0;
        const frameData = frames[frameIndex];
        
        if (!frameData) return;
        
        // Create image from base64 data
        const img = new Image();
        img.onload = () => {
            // Draw avatar centered on player position
            const avatarWidth = 32; // Standard avatar size
            const avatarHeight = (img.height / img.width) * avatarWidth; // Maintain aspect ratio
            
            this.ctx.save();
            
            // For west direction, flip horizontally
            if (player.facing === 'west') {
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(img, -screenPos.x - avatarWidth/2, screenPos.y - avatarHeight/2, avatarWidth, avatarHeight);
            } else {
                this.ctx.drawImage(img, screenPos.x - avatarWidth/2, screenPos.y - avatarHeight/2, avatarWidth, avatarHeight);
            }
            
            this.ctx.restore();
            
            // Draw username label
            this.ctx.fillStyle = 'white';
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            
            const textY = screenPos.y - avatarHeight/2 - 5;
            this.ctx.strokeText(player.username, screenPos.x, textY);
            this.ctx.fillText(player.username, screenPos.x, textY);
        };
        img.src = frameData;
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,  // Source rectangle (viewport)
            0, 0, this.canvas.width, this.canvas.height  // Destination rectangle (full canvas)
        );
        
        // Draw all players
        console.log('Drawing', Object.keys(this.players).length, 'players');
        Object.values(this.players).forEach(player => {
            this.drawAvatar(player);
        });
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    new GameClient();
});
