// js/classes/Board.js
import Piece from "./Piece.js";

export default class Board {
  constructor(size = 8) {
    this.size = size;
    this.grid = [];
    this.setup();
  }

  setup() {
    // crear grid vacío
    this.grid = Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, () => null)
    );

    // Colocar piezas negras (arriba) en casillas oscuras (r+c)%2 === 1
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < this.size; c++) {
        if ((r + c) % 2 === 0) {
          this.grid[r][c] = new Piece("black", r, c);
        }
      }
    }

    // Colocar piezas rojas (abajo) en casillas oscuras
    for (let r = this.size - 3; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if ((r + c) % 2 === 0) {
          this.grid[r][c] = new Piece("red", r, c);
        }
      }
    }
  }

  getPiece(row, col) {
    if (!this.inBounds(row, col)) return null;
    return this.grid[row][col];
  }

  movePiece(piece, newRow, newCol) {
    if (!piece) return;
    // borrar origen
    this.grid[piece.row][piece.col] = null;
    // actualizar pieza
    piece.row = newRow;
    piece.col = newCol;
    // colocar en destino
    this.grid[newRow][newCol] = piece;
  }

  removePiece(row, col) {
    if (!this.inBounds(row, col)) return;
    this.grid[row][col] = null;
  }

  inBounds(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  // contar piezas de un color (útil para win check)
  countPieces(color) {
    let count = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const p = this.grid[r][c];
        if (p && p.color === color) count++;
      }
    }
    return count;
  }

  // obtener todas las piezas de un color
  getPiecesOfColor(color) {
    const pieces = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const p = this.grid[r][c];
        if (p && p.color === color) {
          pieces.push(p);
        }
      }
    }
    return pieces;
  }

  // verificar si un jugador tiene movimientos válidos (para detectar empate)
  hasValidMoves(color, getValidMovesFn) {
    const pieces = this.getPiecesOfColor(color);
    
    for (const piece of pieces) {
      const moves = getValidMovesFn(this, piece);
      if (moves && moves.length > 0) {
        return true;
      }
    }
    
    return false;
  }
}
