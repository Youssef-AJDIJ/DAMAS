// js/classes/Piece.js
export default class Piece {
  constructor(color, row, col) {
    this.color = color; // "red" o "black"
    this.row = row;
    this.col = col;
    this.king = false;
  }

  makeKing() {
    this.king = true;
  }
}
