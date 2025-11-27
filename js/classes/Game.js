import Board from "./Board.js";
import { getValidMoves } from "../utils/moves.js";
import { renderBoard } from "../utils/render.js";
import { soundManager } from "../sound.js";

export default class Game {
  constructor(
    container,
    statusEl = null,
    onGameEnd = null,
    onPieceCountChange = null
  ) {
    // container: DOM element (div) donde se pintará el tablero
    this.container =
      typeof container === "string"
        ? document.getElementById(container)
        : container;
    this.statusEl = statusEl
      ? typeof statusEl === "string"
        ? document.getElementById(statusEl)
        : statusEl
      : null;

    this.onGameEnd = onGameEnd; // callback para cuando termina el juego
    this.onPieceCountChange = onPieceCountChange; // callback para actualizar conteo de fichas

    this.board = new Board();
    this.currentPlayer = "red"; // rojo siempre inicia por defecto
    this.selectedPiece = null;
    this.validMoves = [];
    this.gameOver = false;

    // Player names (will be set from UI)
    this.playerName = "Jugador";
    this.playerColor = "red";
    this.cpuColor = "black";

    // AI opponent
    this.isAIEnabled = false;
    this.ai = null;
    this.isAITurn = false;

    // Move counter for draw detection
    this.movesWithoutCapture = 0;
    this.maxMovesWithoutCapture = 50; // Draw after 50 moves without capture

    // Online Multiplayer
    this.isOnline = false;
    this.myOnlineColor = null;
    this.onMoveMade = null; // Callback to send move to network

    this.draw();
    this.enableInteraction();
    this.updateStatus();
    this.updatePieceCounts();
  }

  setOnlineMode(isOnline, myColor, onMoveMade) {
    this.isOnline = isOnline;
    this.myOnlineColor = myColor;
    this.onMoveMade = onMoveMade;

    // If online, CPU is disabled
    if (isOnline) {
      this.isAIEnabled = false;
      this.ai = null;
    }

    this.updateStatus();
  }

  setPlayerInfo(name, color, aiEnabled = false, ai = null) {
    this.playerName = name || "Jugador";
    this.playerColor = color;
    this.cpuColor = color === "red" ? "black" : "red";
    this.isAIEnabled = aiEnabled;
    this.ai = ai;
  }

  setFirstPlayer(firstPlayer) {
    if (firstPlayer === "cpu") {
      this.currentPlayer = this.cpuColor;
      this.isAITurn = true;
    } else {
      this.currentPlayer = this.playerColor;
      this.isAITurn = false;
    }
    this.updateStatus();
  }

  getCurrentPlayerName() {
    if (this.isOnline) {
      return this.currentPlayer === this.myOnlineColor ? "Tú" : "Oponente";
    }
    return this.currentPlayer === this.playerColor ? this.playerName : "CPU";
  }

  getOpponentName() {
    if (this.isOnline) {
      return "Oponente";
    }
    return this.currentPlayer === this.playerColor ? "CPU" : this.playerName;
  }

  updateStatus(text) {
    if (!this.statusEl) return;
    if (text) {
      this.statusEl.textContent = text;
      return;
    }
    if (this.gameOver) {
      // no cambiar
      return;
    }
    const name = this.getCurrentPlayerName();
    this.statusEl.textContent = `Turno: ${name}`;
  }

  updatePieceCounts() {
    if (this.onPieceCountChange) {
      const playerCount = this.board.countPieces(this.playerColor);
      const cpuCount = this.board.countPieces(this.cpuColor);
      this.onPieceCountChange(playerCount, cpuCount);
    }
  }

  draw() {
    renderBoard(
      this.container,
      this.board,
      this.selectedPiece,
      this.validMoves
    );
  }

  enableInteraction() {
    this.container.addEventListener("click", (e) => {
      // Ignore clicks during AI turn or game over
      if (this.gameOver || this.isAITurn) return;

      // ONLINE: Ignore clicks if it's not my turn
      if (this.isOnline && this.currentPlayer !== this.myOnlineColor) return;

      const cell = e.target.closest(".cell");
      if (!cell) return;

      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const clickedPiece = this.board.getPiece(row, col);

      // si clicamos en una pieza propia -> seleccionar
      if (clickedPiece && clickedPiece.color === this.currentPlayer) {
        // Check if there are any captures available for current player
        const allPieces = this.board.getPiecesOfColor(this.currentPlayer);
        const allCaptures = [];

        for (const piece of allPieces) {
          const moves = getValidMoves(this.board, piece);
          const captures = moves.filter((m) => m.capture);
          if (captures.length > 0) {
            allCaptures.push({ piece, captures });
          }
        }

        // If there are captures available, only allow selecting pieces with captures
        if (allCaptures.length > 0) {
          const pieceHasCapture = allCaptures.some(
            (c) => c.piece === clickedPiece
          );
          if (!pieceHasCapture) {
            // Cannot select this piece - must capture
            this.updateStatus(
              "¡Debes capturar! Selecciona una pieza que pueda capturar."
            );
            return;
          }
          // Only show captures for this piece
          this.selectedPiece = clickedPiece;
          const allMoves = getValidMoves(this.board, this.selectedPiece);
          this.validMoves = allMoves.filter((m) => m.capture);
        } else {
          // No captures available, allow normal moves
          this.selectedPiece = clickedPiece;
          this.validMoves = getValidMoves(this.board, this.selectedPiece);
        }

        this.draw();
        return;
      }

      // si hay pieza seleccionada e intentamos mover
      if (this.selectedPiece) {
        this.handleMove(row, col);
      }
    });
  }

  handleMove(row, col, isRemote = false) {
    const move = this.validMoves.find((m) => m.row === row && m.col === col);
    if (move) {
      // ONLINE: Send move to opponent if it's a local move
      if (this.isOnline && !isRemote && this.onMoveMade) {
        this.onMoveMade({
          from: { row: this.selectedPiece.row, col: this.selectedPiece.col },
          to: { row, col },
        });
      }

      let wasCapture = false;

      // si captura, eliminar la pieza intermedia
      if (move.capture) {
        // move.capture can be an array or single object
        const captures = Array.isArray(move.capture)
          ? move.capture
          : [move.capture];
        captures.forEach((cap) => {
          this.board.removePiece(cap.row, cap.col);
        });
        wasCapture = true;
        this.movesWithoutCapture = 0; // Reset counter on capture
        soundManager.playCaptureSound();
      } else {
        this.movesWithoutCapture++; // Increment counter on non-capture move
        soundManager.playMoveSound();
      }

      // mover pieza
      this.board.movePiece(this.selectedPiece, row, col);

      // promoción (corona)
      const wasPromoted =
        !this.selectedPiece.king &&
        ((this.selectedPiece.color === "red" && row === 0) ||
          (this.selectedPiece.color === "black" &&
            row === this.board.size - 1));

      if (this.selectedPiece.color === "red" && row === 0) {
        this.selectedPiece.makeKing();
        soundManager.playKingSound();
      }
      if (this.selectedPiece.color === "black" && row === this.board.size - 1) {
        this.selectedPiece.makeKing();
        soundManager.playKingSound();
      }

      // MULTI-CAPTURA: Si hubo captura y no fue promoción, verificar si hay más capturas
      if (wasCapture && !wasPromoted) {
        const moreMoves = getValidMoves(this.board, this.selectedPiece);
        const moreCaptures = moreMoves.filter((m) => m.capture);

        if (moreCaptures.length > 0) {
          // Hay más capturas disponibles, mantener pieza seleccionada
          this.validMoves = moreCaptures;
          this.draw();
          this.updatePieceCounts();

          // Si es turno del AI, continuar automáticamente con la captura
          if (this.isAITurn && this.isAIEnabled && this.ai && !this.gameOver) {
            setTimeout(() => {
              // AI debe hacer otra captura
              this.makeAIMove();
            }, 600);
          }

          return; // No cambiar turno
        }
      }

      // limpiar selección y pasar turno
      this.selectedPiece = null;
      this.validMoves = [];
      this.switchTurn();
      this.draw();
      this.updatePieceCounts();
      this.checkGameEnd();

      // Si es turno de la IA, hacer que juegue
      if (this.isAITurn && this.isAIEnabled && this.ai && !this.gameOver) {
        this.makeAIMove();
      }
    } else {
      // clic en casilla no válida: deseleccionar
      this.selectedPiece = null;
      this.validMoves = [];
      this.draw();
    }
  }

  makeRemoteMove(moveData) {
    // Find the piece at the 'from' location
    const piece = this.board.getPiece(moveData.from.row, moveData.from.col);
    if (!piece) {
      console.error("Remote move error: No piece found at", moveData.from);
      return;
    }

    // Select it
    this.selectedPiece = piece;
    this.validMoves = getValidMoves(this.board, this.selectedPiece);

    // Execute the move (pass isRemote=true to prevent sending it back)
    this.handleMove(moveData.to.row, moveData.to.col, true);
  }

  async makeAIMove() {
    // Wait a bit before AI moves
    await new Promise((resolve) => setTimeout(resolve, 500));

    const aiMove = this.ai.getBestMove(this.board, this.cpuColor);

    if (!aiMove) {
      // No moves available - player wins
      this.endGame("win", this.playerColor, this.playerName);
      return;
    }

    // Select the piece
    this.selectedPiece = aiMove.piece;
    this.validMoves = getValidMoves(this.board, this.selectedPiece);
    this.draw();

    // Wait a bit to show selection
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Make the move
    this.handleMove(aiMove.move.row, aiMove.move.col);
  }

  switchTurn() {
    this.currentPlayer = this.currentPlayer === "red" ? "black" : "red";
    this.isAITurn = this.isAIEnabled && this.currentPlayer === this.cpuColor;
    this.updateStatus();
  }

  checkGameEnd() {
    const redCount = this.board.countPieces("red");
    const blackCount = this.board.countPieces("black");

    // Check for win by elimination
    if (redCount === 0 || blackCount === 0) {
      const winner = redCount === 0 ? "black" : "red";
      const winnerName = winner === this.playerColor ? this.playerName : "CPU";

      this.endGame("win", winner, winnerName);
      return;
    }

    // Check for stalemate (no valid moves)
    const hasValidMoves = this.board.hasValidMoves(
      this.currentPlayer,
      getValidMoves
    );
    if (!hasValidMoves) {
      // Current player can't move, opponent wins
      const winner = this.currentPlayer === "red" ? "black" : "red";
      const winnerName = winner === this.playerColor ? this.playerName : "CPU";

      this.endGame("win", winner, winnerName);
      return;
    }

    // Check for draw by move count
    if (this.movesWithoutCapture >= this.maxMovesWithoutCapture) {
      this.endGame("draw");
      return;
    }
  }

  endGame(result, winner = null, winnerName = null) {
    this.gameOver = true;

    if (result === "win" && winner) {
      if (this.statusEl) {
        this.statusEl.textContent = `🎉 Victoria: ${winnerName} 🎉`;
        this.statusEl.classList.add("winner");
      }

      // Play win sound if player won
      if (winner === this.playerColor) {
        soundManager.playWinSound();
      }

      // Call the callback with game result
      if (this.onGameEnd) {
        const isPlayerWinner = winner === this.playerColor;
        this.onGameEnd({
          result: "win",
          winner: isPlayerWinner ? "player" : "cpu",
          winnerName: winnerName,
        });
      }
    } else if (result === "draw") {
      if (this.statusEl) {
        this.statusEl.textContent = `🤝 Empate - Sin capturas en ${this.maxMovesWithoutCapture} movimientos`;
        this.statusEl.classList.add("draw");
      }

      // Call the callback with draw result
      if (this.onGameEnd) {
        this.onGameEnd({
          result: "draw",
        });
      }
    }
  }

  // reiniciar partida (útil si quieres agregar botón)
  reset() {
    this.board.setup();
    this.currentPlayer = "red";
    this.selectedPiece = null;
    this.validMoves = [];
    this.gameOver = false;
    this.movesWithoutCapture = 0;
    this.isAITurn = false;

    // Remove status classes
    if (this.statusEl) {
      this.statusEl.classList.remove("winner", "draw");
    }

    this.draw();
    this.updateStatus();
    this.updatePieceCounts();
  }
}
