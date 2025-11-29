// js/main.js
import Game from "./classes/Game.js";
import {
  getPlayerStats,
  incrementPlayerStat,
  resetPlayerStats,
} from "./utils/storage.js";
import { CheckersAI } from "./utils/ai.js";
import { MultiplayerManager } from "./multiplayer.js";

// Screens
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");

// Setup form elements
const setupForm = document.getElementById("setup-form");
const playerNameInput = document.getElementById("player-name");
const previewWins = document.getElementById("preview-wins");
const previewDraws = document.getElementById("preview-draws");
const previewLosses = document.getElementById("preview-losses");
const onlineModeBtn = document.getElementById("online-mode-btn");

// Online Lobby Elements
const onlineLobbyModal = document.getElementById("online-lobby-modal");
const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const roomIdInput = document.getElementById("room-id-input");
const roomInfo = document.getElementById("room-info");
const myRoomIdEl = document.getElementById("my-room-id");
const copyCodeBtn = document.getElementById("copy-code-btn");
const closeLobbyBtn = document.getElementById("close-lobby-btn");
const videoContainer = document.getElementById("video-container");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");

// Game DOM Elements
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status-message");

// Player card elements
const playerCard = document.getElementById("player-card");
const playerDisplayName = document.getElementById("player-display-name");
const playerIndicator = document.getElementById("player-indicator");
const playerWinsEl = document.getElementById("player-wins");
const playerDrawsEl = document.getElementById("player-draws");
const playerLossesEl = document.getElementById("player-losses");
const playerPieceCount = document.getElementById("player-piece-count");

// CPU/Opponent card elements
const cpuCard = document.getElementById("cpu-card");
const cpuIndicator = document.getElementById("cpu-indicator");
const cpuWinsEl = document.getElementById("cpu-wins");
const cpuDrawsEl = document.getElementById("cpu-draws");
const cpuLossesEl = document.getElementById("cpu-losses");
const cpuPieceCount = document.getElementById("cpu-piece-count");

// Buttons
const newGameBtn = document.getElementById("new-btn");
const backSetupBtn = document.getElementById("back-setup-btn");

// Modal
const resultModal = document.getElementById("result-modal");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const modalNewGameBtn = document.getElementById("modal-new-game");
const modalBackSetupBtn = document.getElementById("modal-back-setup");

// Game instance and config
let game;
let gameConfig = {
  playerName: "",
  playerColor: "red",
  firstMove: "player",
  difficulty: "medium",
};

// AI instance
let ai;
let multiplayer;

// CPU stats (separate from player stats)
const CPU_STATS_KEY = "cpu";

// Initialize
showSetupScreen();

// Setup form submission
setupForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // Get form values
  const formData = new FormData(setupForm);
  gameConfig.playerName = formData.get("player-name").trim() || "Jugador";
  gameConfig.playerColor = formData.get("player-color");
  gameConfig.firstMove = formData.get("first-move");
  gameConfig.difficulty = formData.get("difficulty");

  // Start the game
  startGame();
});

// Update stats preview when player name changes
playerNameInput.addEventListener("input", () => {
  updateStatsPreview();
});

// Update stats preview on load
updateStatsPreview();

function updateStatsPreview() {
  const name = playerNameInput.value.trim() || "Jugador";
  const stats = getPlayerStats(name);

  previewWins.textContent = stats.wins;
  previewDraws.textContent = stats.draws;
  previewLosses.textContent = stats.losses;
}

function showSetupScreen() {
  setupScreen.classList.add("active");
  gameScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  gameScreen.classList.remove("active");
  videoContainer.classList.add("hidden");
}

function showGameScreen() {
  setupScreen.classList.remove("active");
  gameScreen.classList.remove("hidden");
  setupScreen.classList.add("hidden");
  gameScreen.classList.add("active");
}

function startGame(isOnline = false, onlineConfig = null) {
  // Initialize game
  game = new Game(boardEl, statusEl, handleGameEnd, handlePieceCountChange);

  if (isOnline && onlineConfig) {
    // Online Setup
    gameConfig.playerName = playerNameInput.value.trim() || "Jugador";
    gameConfig.playerColor = onlineConfig.color;

    game.setPlayerInfo(
      gameConfig.playerName,
      gameConfig.playerColor,
      false,
      null
    );
    game.setOnlineMode(true, onlineConfig.color, (move) => {
      multiplayer.sendMove(move);
    });

    // Set opponent name
    const opponentName = onlineConfig.opponentName;

    // Update UI for online
    playerIndicator.className = `player-indicator ${gameConfig.playerColor}`;
    cpuIndicator.className = `player-indicator ${
      gameConfig.playerColor === "red" ? "black" : "red"
    }`;

    playerDisplayName.textContent = gameConfig.playerName;
    // Change CPU card to Opponent card
    const cpuPlayerName = document.querySelector("#cpu-card .player-name");
    if (cpuPlayerName) {
      cpuPlayerName.textContent = `👤 ${opponentName}`;
    }

    // Hide difficulty/stats for online (simplified)
    updateStatisticsDisplay();

    game.reset();
    // Red always starts
    game.currentPlayer = "red";
    game.updateStatus();

    showGameScreen();
    videoContainer.classList.remove("hidden");
    updateActivePlayer();
  } else {
    // Local/AI Setup
    ai = new CheckersAI(gameConfig.difficulty);
    game.setPlayerInfo(gameConfig.playerName, gameConfig.playerColor, true, ai);

    // Set up player indicators
    playerIndicator.className = `player-indicator ${gameConfig.playerColor}`;
    cpuIndicator.className = `player-indicator ${
      gameConfig.playerColor === "red" ? "black" : "red"
    }`;

    // Display player name
    playerDisplayName.textContent = gameConfig.playerName;
    const cpuPlayerName = document.querySelector("#cpu-card .player-name");
    if (cpuPlayerName) {
      cpuPlayerName.textContent = "CPU 🤖";
    }

    // Load and display statistics
    updateStatisticsDisplay();

    // Reset and start
    game.reset();
    game.setFirstPlayer(gameConfig.firstMove);

    // Show game screen
    showGameScreen();
    videoContainer.classList.add("hidden");

    // Update active player indicators
    updateActivePlayer();

    // If CPU starts, make AI move
    if (gameConfig.firstMove === "cpu" && !game.gameOver) {
      setTimeout(() => {
        game.makeAIMove();
      }, 2000);
    }
  }

  // Expose for debugging
  window.game = game;
}

function handleGameEnd(result) {
  if (result.result === "win") {
    if (result.winner === "player") {
      // Player won
      if (!game.isOnline) {
        incrementPlayerStat(gameConfig.playerName, "wins");
        incrementPlayerStat(CPU_STATS_KEY, "losses");
      }

      showResultModal(
        "🎉 ¡Victoria! 🎉",
        `¡Felicidades ${gameConfig.playerName}! Has ganado.`
      );
    } else {
      // Opponent/CPU won
      if (!game.isOnline) {
        incrementPlayerStat(gameConfig.playerName, "losses");
        incrementPlayerStat(CPU_STATS_KEY, "wins");
      }

      showResultModal(
        "😔 Derrota",
        `Has perdido esta vez. ¡Inténtalo de nuevo!`
      );
    }
  } else if (result.result === "draw") {
    // Draw
    if (!game.isOnline) {
      incrementPlayerStat(gameConfig.playerName, "draws");
      incrementPlayerStat(CPU_STATS_KEY, "draws");
    }

    showResultModal("🤝 Empate 🤝", "La partida ha terminado en empate.");
  }

  // Update statistics display
  updateStatisticsDisplay();
}

function handlePieceCountChange(playerCount, cpuCount) {
  playerPieceCount.textContent = playerCount;
  cpuPieceCount.textContent = cpuCount;
}

function updateActivePlayer() {
  if (!game) return;

  if (game.currentPlayer === gameConfig.playerColor) {
    playerCard.classList.add("active");
    cpuCard.classList.remove("active");
  } else {
    playerCard.classList.remove("active");
    cpuCard.classList.add("active");
  }
}

function updateStatisticsDisplay() {
  const playerStats = getPlayerStats(gameConfig.playerName);
  const cpuStats = getPlayerStats(CPU_STATS_KEY);

  playerWinsEl.textContent = playerStats.wins;
  playerDrawsEl.textContent = playerStats.draws;
  playerLossesEl.textContent = playerStats.losses;

  cpuWinsEl.textContent = cpuStats.wins;
  cpuDrawsEl.textContent = cpuStats.draws;
  cpuLossesEl.textContent = cpuStats.losses;
}

function showResultModal(title, message) {
  resultTitle.textContent = title;
  resultMessage.textContent = message;
  resultModal.classList.add("show");
}

function hideResultModal() {
  resultModal.classList.remove("show");
}

function resetGame() {
  if (game) {
    if (game.isOnline) {
      // Online reset not fully implemented (would need sync)
      alert("Reiniciar partida online requiere reconexión.");
      return;
    }

    game.reset();
    game.setFirstPlayer(gameConfig.firstMove);
    updateActivePlayer();

    // If CPU starts, make AI move
    if (gameConfig.firstMove === "cpu" && !game.gameOver) {
      setTimeout(() => {
        game.makeAIMove();
      }, 2000);
    }
  }
}

// --- ONLINE MULTIPLAYER HANDLERS ---

if (onlineModeBtn) {
  onlineModeBtn.addEventListener("click", () => {
    onlineLobbyModal.classList.add("show");

    // Initialize multiplayer manager
    multiplayer = new MultiplayerManager(
      (move) => {
        // On move received
        if (game) game.makeRemoteMove(move);
      },
      (config) => {
        // On game start
        onlineLobbyModal.classList.remove("show");
        startGame(true, config);
      },
      () => {
        // On disconnect
        alert("El oponente se ha desconectado.");
        location.reload();
      }
    );

    multiplayer.initialize(localVideo, remoteVideo).then((id) => {
      myRoomIdEl.textContent = id;
      // Show video container immediately so user can see themselves
      videoContainer.classList.remove("hidden");
    });
  });
}

if (createRoomBtn) {
  createRoomBtn.addEventListener("click", () => {
    multiplayer.createRoom(); // Just sets isHost = true internally
    roomInfo.classList.remove("hidden");
    createRoomBtn.classList.add("hidden");
    document.querySelector(".join-room-container").classList.add("hidden");
    document.querySelector(".divider").classList.add("hidden");
  });
}

if (joinRoomBtn) {
  joinRoomBtn.addEventListener("click", () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
      multiplayer.joinRoom(roomId);
      joinRoomBtn.textContent = "Conectando...";
      joinRoomBtn.disabled = true;
    }
  });
}

newGameBtn.addEventListener("click", () => {
  resetGame();
  hideResultModal();
});

backSetupBtn.addEventListener("click", () => {
  if (game && game.isOnline) {
    if (confirm("¿Salir de la partida online?")) {
      location.reload();
    }
  } else {
    showSetupScreen();
    hideResultModal();
  }
});

modalNewGameBtn.addEventListener("click", () => {
  resetGame();
  hideResultModal();
});

modalBackSetupBtn.addEventListener("click", () => {
  showSetupScreen();
  hideResultModal();
});

// Close modal on background click
resultModal.addEventListener("click", (e) => {
  if (e.target === resultModal) {
    hideResultModal();
  }
});

// Monitor turns to update active player indicator
setInterval(() => {
  updateActivePlayer();
}, 100);

// Clear Data Button
const clearBtn = document.getElementById("clear-btn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    console.log("Borrando datos...");
    if (
      confirm("¿Estás seguro de que quieres borrar todas las estadísticas?")
    ) {
      localStorage.clear();
      updateStatsPreview(); // For setup screen
      updateStatisticsDisplay(); // For game screen
      alert("Datos borrados correctamente.");
    }
  });
}

const clearDataBtn = document.getElementById("clear-data-btn");
if (clearDataBtn) {
  clearDataBtn.addEventListener("click", () => {
    console.log("Borrando datos...");
    if (
      confirm("¿Estás seguro de que quieres borrar todas las estadísticas?")
    ) {
      localStorage.clear();
      updateStatsPreview(); // For setup screen
      updateStatisticsDisplay(); // For game screen
      alert("Datos borrados correctamente.");
    }
  });
}
