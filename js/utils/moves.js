export function getValidMoves(board, piece) {
  if (!piece) return [];

  const moves = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  // --- LOGICA PARA REY (FLYING KING) ---
  if (piece.king) {
    for (const [dRow, dCol] of directions) {
      let r = piece.row + dRow;
      let c = piece.col + dCol;
      let foundEnemy = null;

      while (board.inBounds(r, c)) {
        const p = board.getPiece(r, c);

        if (!p) {
          // Casilla vacía
          if (!foundEnemy) {
            // Movimiento normal (sin captura)
            moves.push({ row: r, col: c, capture: null });
          } else {
            // Aterrizaje después de captura
            moves.push({ 
              row: r, 
              col: c, 
              capture: { row: foundEnemy.row, col: foundEnemy.col } 
            });
          }
        } else {
          // Hay pieza
          if (p.color === piece.color) {
            // Bloqueado por pieza propia
            break;
          } else {
            // Pieza enemiga
            if (foundEnemy) {
              // Ya habíamos encontrado una enemiga antes -> no se pueden saltar dos
              break;
            }
            foundEnemy = { row: r, col: c };
          }
        }

        r += dRow;
        c += dCol;
      }
    }
  } 
  // --- LOGICA PARA PIEZA NORMAL ---
  else {
    const normalDirections = piece.color === "red" 
      ? [[-1, -1], [-1, 1]] 
      : [[1, -1], [1, 1]];

    // 1. Movimientos normales
    for (const [dRow, dCol] of normalDirections) {
      const r = piece.row + dRow;
      const c = piece.col + dCol;
      if (board.inBounds(r, c) && !board.getPiece(r, c)) {
        moves.push({ row: r, col: c, capture: null });
      }
    }

    // 2. Capturas (en las 4 direcciones para piezas normales también pueden capturar hacia atrás en algunas variantes, 
    // pero en damas españolas/internacionales la peona captura hacia atrás? 
    // En Damas Españolas la peona SI captura hacia atrás. En Internacionales también.
    // Asumiremos que pueden capturar en las 4 direcciones si es variante española/internacional).
    // Si el usuario quiere reglas estrictas inglesas, la peona no captura atrás.
    // Dado que pidió "Flying King", asumimos reglas españolas/internacionales -> Peona captura atrás.
    
    for (const [dRow, dCol] of normalDirections) {
      const r1 = piece.row + dRow;
      const c1 = piece.col + dCol;
      const r2 = piece.row + dRow * 2;
      const c2 = piece.col + dCol * 2;

      if (board.inBounds(r2, c2)) {
        const p1 = board.getPiece(r1, c1);
        const p2 = board.getPiece(r2, c2);

        if (p1 && p1.color !== piece.color && !p2) {
          // Captura válida
          // Verificar si es movimiento hacia adelante para promoción
          const isPromotion = !piece.king && (
            (piece.color === "red" && r2 === 0) ||
            (piece.color === "black" && r2 === 7)
          );

          moves.push({
            row: r2,
            col: c2,
            capture: { row: r1, col: c1 },
            isPromotion: isPromotion
          });
        }
      }
    }
  }

  return moves;
}
