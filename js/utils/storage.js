// js/utils/storage.js
// Utility for managing player statistics in localStorage

const STORAGE_KEY = 'damas_game_stats';

/**
 * Get all stored statistics
 * @returns {Object} Object containing all player statistics
 */
export function getAllStats() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading statistics:', error);
    return {};
  }
}

/**
 * Get statistics for a specific player
 * @param {string} playerName - Name of the player
 * @returns {Object} Player statistics {wins, draws, losses}
 */
export function getPlayerStats(playerName) {
  const allStats = getAllStats();
  const name = playerName.trim() || 'Jugador';
  
  return allStats[name] || {
    wins: 0,
    draws: 0,
    losses: 0
  };
}

/**
 * Save statistics for a specific player
 * @param {string} playerName - Name of the player
 * @param {Object} stats - Statistics object {wins, draws, losses}
 */
export function savePlayerStats(playerName, stats) {
  try {
    const name = playerName.trim() || 'Jugador';
    const allStats = getAllStats();
    
    allStats[name] = {
      wins: stats.wins || 0,
      draws: stats.draws || 0,
      losses: stats.losses || 0
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allStats));
  } catch (error) {
    console.error('Error saving statistics:', error);
  }
}

/**
 * Update player statistics (increment a specific stat)
 * @param {string} playerName - Name of the player
 * @param {string} statType - Type of stat to increment ('wins', 'draws', or 'losses')
 */
export function incrementPlayerStat(playerName, statType) {
  const stats = getPlayerStats(playerName);
  
  if (statType === 'wins' || statType === 'draws' || statType === 'losses') {
    stats[statType]++;
    savePlayerStats(playerName, stats);
  }
  
  return stats;
}

/**
 * Clear all statistics
 */
export function clearAllStats() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing statistics:', error);
  }
}

/**
 * Clear statistics for a specific player
 * @param {string} playerName - Name of the player
 */
export function clearPlayerStats(playerName) {
  try {
    const name = playerName.trim() || 'Jugador';
    const allStats = getAllStats();
    
    delete allStats[name];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allStats));
  } catch (error) {
    console.error('Error clearing player statistics:', error);
  }
}

/**
 * Reset statistics for a specific player to zeros
 * @param {string} playerName - Name of the player
 */
export function resetPlayerStats(playerName) {
  savePlayerStats(playerName, {
    wins: 0,
    draws: 0,
    losses: 0
  });
}
