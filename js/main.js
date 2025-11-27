// js/main.js
import Game from "./classes/Game.js";
import {
  getPlayerStats,
  incrementPlayerStat,
  resetPlayerStats,
} from "./utils/storage.js";
import { CheckersAI } from "./utils/ai.js";

// Screens
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");

// Setup form elements
const setupForm = document.getElementById("setup-form");
const playerNameInput = document.getElementById("player-name");
const previewWins = document.getElementById("preview-wins");
const previewDraws = document.getElementById("preview-draws");
const previewLosses = document.getElementById("preview-losses");

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

// CPU card elements
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
}

function showGameScreen() {
  setupScreen.classList.remove("active");
  gameScreen.classList.remove("hidden");
  setupScreen.classList.add("hidden");
  gameScreen.classList.add("active");
}

function startGame() {
  // Create AI with selected difficulty
  ai = new CheckersAI(gameConfig.difficulty);

  // Initialize game
  game = new Game(boardEl, statusEl, handleGameEnd, handlePieceCountChange);
  game.setPlayerInfo(gameConfig.playerName, gameConfig.playerColor, true, ai);

  // Set up player indicators
  playerIndicator.className = `player-indicator ${gameConfig.playerColor}`;
  cpuIndicator.className = `player-indicator ${
    gameConfig.playerColor === "red" ? "black" : "red"
  }`;

  // Display player name
  playerDisplayName.textContent = gameConfig.playerName;

  // Load and display statistics
  updateStatisticsDisplay();

  // Reset and start
  game.reset();
  game.setFirstPlayer(gameConfig.firstMove);

  // Show game screen
  showGameScreen();

  // Update active player indicators
  updateActivePlayer();

  // If CPU starts, make AI move
  if (gameConfig.firstMove === "cpu" && !game.gameOver) {
    setTimeout(() => {
      game.makeAIMove();
    }, 2000);
  }

  // Expose for debugging
  window.game = game;
}

function handleGameEnd(result) {
  if (result.result === "win") {
    if (result.winner === "player") {
      // Player won
      incrementPlayerStat(gameConfig.playerName, "wins");
      incrementPlayerStat(CPU_STATS_KEY, "losses");

      showResultModal(
        "🎉 ¡Victoria! 🎉",
        `¡Felicidades ${gameConfig.playerName}! Has ganado la partida contra la CPU.`
      );
    } else {
      // CPU won
      incrementPlayerStat(gameConfig.playerName, "losses");
      incrementPlayerStat(CPU_STATS_KEY, "wins");

      showResultModal(
        "😔 Derrota",
        `La CPU ha ganado esta vez. ¡Inténtalo de nuevo!`
      );
    }
  } else if (result.result === "draw") {
    // Draw
    incrementPlayerStat(gameConfig.playerName, "draws");
    incrementPlayerStat(CPU_STATS_KEY, "draws");

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

// Event Listeners
newGameBtn.addEventListener("click", () => {
  resetGame();
  hideResultModal();
});

backSetupBtn.addEventListener("click", () => {
  showSetupScreen();
  hideResultModal();
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
clearBtn.addEventListener("click", () => {
  console.log("Borrando datos...");
  if (confirm("¿Estás seguro de que quieres borrar todas las estadísticas?")) {
    localStorage.clear();
    updateStatsPreview(); // For setup screen
    updateStatisticsDisplay(); // For game screen
    alert("Datos borrados correctamente.");
  }
});

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
