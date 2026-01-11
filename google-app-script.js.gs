/**
 * NFL Pick'em Pool - Google Apps Script
 * 
 * This script adds custom functions to your Google Sheet to:
 * 1. Scrape NFL lines from ESPN API
 * 2. Accept picks from the website
 * 3. Calculate scores and update standings
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Click Extensions → Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Click Save (💾 icon)
 * 6. Click Deploy → New deployment
 * 7. Select type: Web app
 * 8. Execute as: Me
 * 9. Who has access: Anyone
 * 10. Click Deploy
 * 11. Copy the Web App URL (you'll need this for the website)
 */

// ========================================
// 1. SCRAPE NFL LINES FROM ESPN
// ========================================

/**
 * Fetches NFL games and odds from ESPN API and populates the Games sheet
 * Usage: Call this function from a button or menu
 */
function scrapeNFLLines() {
  const ui = SpreadsheetApp.getUi();
  
  // Ask user for week number
  const response = ui.prompt('Scrape NFL Lines', 'Enter week number (1-18):', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() != ui.Button.OK) {
    return;
  }
  
  const week = response.getResponseText();
  
  if (!week || isNaN(week) || week < 1 || week > 18) {
    ui.alert('Invalid week number. Please enter a number between 1 and 18.');
    return;
  }
  
  ui.alert('Fetching games for Week ' + week + '...');
  
  try {
    // Fetch from ESPN API
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}`;
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    if (!data.events || data.events.length === 0) {
      ui.alert('No games found for Week ' + week + '. The season may not have started yet.');
      return;
    }
    
    // Get or create Games sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let gamesSheet = ss.getSheetByName('Games');
    
    if (!gamesSheet) {
      gamesSheet = ss.insertSheet('Games');
      gamesSheet.appendRow(['Week', 'GameID', 'Away', 'Home', 'Spread', 'AwaySpread', 'GameTime', 'Winner']);
      gamesSheet.getRange('A1:H1').setFontWeight('bold').setBackground('#d50a0a').setFontColor('#ffffff');
    }
    
    // Parse games
    const games = [];
    data.events.forEach((event, index) => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
      
      // Get spread if available
      let spread = 'EVEN';
      let awaySpread = 0;
      
      if (competition.odds && competition.odds.length > 0) {
        const odds = competition.odds[0];
        if (odds.details) {
          spread = odds.details;
          // Parse spread (e.g., "KC -3")
          const spreadMatch = spread.match(/([A-Z]+)\s*([-+]?\d+\.?\d*)/);
          if (spreadMatch) {
            const teamAbbr = spreadMatch[1];
            const spreadValue = parseFloat(spreadMatch[2]);
            if (homeTeam.team.abbreviation === teamAbbr) {
              awaySpread = -spreadValue;
            } else {
              awaySpread = spreadValue;
            }
          }
        }
      }
      
      // Format game time
      const gameDate = new Date(event.date);
      const gameTime = Utilities.formatDate(gameDate, Session.getScriptTimeZone(), 'EEE, MMM d, h:mm a');
      
      games.push([
        week,
        `${week}-${index + 1}`,
        awayTeam.team.displayName,
        homeTeam.team.displayName,
        spread,
        awaySpread,
        gameTime,
        '' // Winner (empty until game is completed)
      ]);
    });
    
    // Remove existing games for this week
    const lastRow = gamesSheet.getLastRow();
    if (lastRow > 1) {
      const weekColumn = gamesSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = weekColumn.length - 1; i >= 0; i--) {
        if (weekColumn[i][0] == week) {
          gamesSheet.deleteRow(i + 2);
        }
      }
    }
    
    // Add new games
    if (games.length > 0) {
      gamesSheet.getRange(gamesSheet.getLastRow() + 1, 1, games.length, 8).setValues(games);
    }
    
    ui.alert(`Successfully scraped ${games.length} games for Week ${week}!`);
    
  } catch (error) {
    ui.alert('Error scraping ESPN: ' + error.toString());
    Logger.log('Error: ' + error);
  }
}

// ========================================
// 2. CALCULATE SCORES
// ========================================

/**
 * Calculates scores for all users based on completed games
 */
function calculateScores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gamesSheet = ss.getSheetByName('Games');
  const picksSheet = ss.getSheetByName('Picks');
  const standingsSheet = ss.getSheetByName('Standings');
  
  if (!gamesSheet || !picksSheet || !standingsSheet) {
    SpreadsheetApp.getUi().alert('Error: Make sure you have sheets named "Games", "Picks", and "Standings"');
    return;
  }
  
  // Get all games
  const gamesData = gamesSheet.getDataRange().getValues();
  const gamesHeader = gamesData[0];
  const games = gamesData.slice(1);
  
  // Get all picks
  const picksData = picksSheet.getDataRange().getValues();
  const picksHeader = picksData[0];
  const picks = picksData.slice(1);
  
  // Build user standings
  const userStats = {};
  
  picks.forEach(pickRow => {
    const username = pickRow[0];
    const week = pickRow[1];
    const userPicks = pickRow[2].toString().split(',');
    
    if (!username || !week) return;
    
    // Initialize user if needed
    if (!userStats[username]) {
      userStats[username] = {
        totalPoints: 0,
        wins: 0,
        losses: 0,
        parlays: 0
      };
    }
    
    // Score each pick
    let weekWins = 0;
    userPicks.forEach(pick => {
      const [gameId, team] = pick.trim().split('-');
      
      // Find the game
      const game = games.find(g => g[1] === gameId);
      if (!game) return;
      
      const winner = game[7]; // Winner column
      if (!winner) return; // Game not completed yet
      
      if (winner === team) {
        weekWins++;
        userStats[username].wins++;
      } else {
        userStats[username].losses++;
      }
    });
    
    // Award points: 1 per win, +1 bonus for hitting all 3
    const points = weekWins + (weekWins === 3 ? 1 : 0);
    userStats[username].totalPoints += points;
    
    if (weekWins === 3) {
      userStats[username].parlays++;
    }
  });
  
  // Clear and update standings
  standingsSheet.clear();
  standingsSheet.appendRow(['Username', 'TotalPoints', 'Wins', 'Losses', 'Parlays']);
  standingsSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#d50a0a').setFontColor('#ffffff');
  
  // Sort by total points
  const sortedUsers = Object.keys(userStats).sort((a, b) => 
    userStats[b].totalPoints - userStats[a].totalPoints
  );
  
  sortedUsers.forEach(username => {
    const stats = userStats[username];
    standingsSheet.appendRow([
      username,
      stats.totalPoints,
      stats.wins,
      stats.losses,
      stats.parlays
    ]);
  });
  
  SpreadsheetApp.getUi().alert('Scores calculated successfully!');
}

// ========================================
// 3. WEB APP API (for website to submit picks)
// ========================================

/**
 * Handles POST requests from the website to submit picks
 * Now supports incremental pick submissions (1-3 picks at a time)
 * Also supports adding test games for off-season testing
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Check if this is a test games request
    if (data.action === 'addTestGames') {
      return addTestGamesToSheet(data.games);
    }

    // Otherwise, handle regular picks submission
    const username = data.username;
    const week = data.week;
    const picks = data.picks;

    if (!username || !week || !picks) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Missing required fields'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Get Picks sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let picksSheet = ss.getSheetByName('Picks');

    if (!picksSheet) {
      picksSheet = ss.insertSheet('Picks');
      picksSheet.appendRow(['Username', 'Week', 'Picks']);
      picksSheet.getRange('A1:C1').setFontWeight('bold').setBackground('#d50a0a').setFontColor('#ffffff');
    }

    // Check total picks for this user/week combination
    // Users can now submit multiple times (1-3 picks each time) up to 3 total
    const existingPicks = picksSheet.getDataRange().getValues();
    const newPicksArray = picks.split(',');
    let totalPicksForWeek = 0;

    for (let i = 1; i < existingPicks.length; i++) {
      if (existingPicks[i][0] === username && existingPicks[i][1] == week) {
        const existingPicksArray = existingPicks[i][2].toString().split(',');
        totalPicksForWeek += existingPicksArray.length;

        // Check for duplicate game picks
        for (const newPick of newPicksArray) {
          const newGameId = newPick.trim().split('-')[0];
          for (const existingPick of existingPicksArray) {
            const existingGameId = existingPick.trim().split('-')[0];
            if (newGameId === existingGameId) {
              return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: `You've already made a pick for game ${newGameId}`
              })).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
    }

    // Check if total would exceed 3 picks
    if (totalPicksForWeek + newPicksArray.length > 3) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: `You can only make 3 picks per week. You already have ${totalPicksForWeek} pick(s).`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Add new picks (each submission is a separate row)
    picksSheet.appendRow([username, week, picks]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Picks submitted successfully!'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles GET requests (for testing)
 */
function doGet(e) {
  return ContentService.createTextOutput('NFL Pick\'em API is running');
}

/**
 * Adds test games to the Games sheet for off-season testing
 */
function addTestGamesToSheet(games) {
  try {
    if (!games || games.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'No games provided'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let gamesSheet = ss.getSheetByName('Games');

    if (!gamesSheet) {
      gamesSheet = ss.insertSheet('Games');
      gamesSheet.appendRow(['Week', 'GameID', 'Away', 'Home', 'Spread', 'AwaySpread', 'GameTime', 'Winner']);
      gamesSheet.getRange('A1:H1').setFontWeight('bold').setBackground('#d50a0a').setFontColor('#ffffff');
    }

    // Add all test games
    games.forEach(game => {
      gamesSheet.appendRow([
        game.week,
        game.gameId,
        game.away,
        game.home,
        game.spread,
        game.awaySpread,
        game.gameTime,
        game.winner || ''
      ]);
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Successfully added ${games.length} test games`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error adding test games: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================
// 4. CUSTOM MENU
// ========================================

/**
 * Creates a custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🏈 NFL Pick\'em')
    .addItem('Scrape Lines from ESPN', 'scrapeNFLLines')
    .addItem('Calculate Scores', 'calculateScores')
    .addSeparator()
    .addItem('Setup Sheets', 'setupSheets')
    .addToUi();
}

/**
 * Sets up the initial sheet structure
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Games sheet
  let gamesSheet = ss.getSheetByName('Games');
  if (!gamesSheet) {
    gamesSheet = ss.insertSheet('Games');
    gamesSheet.appendRow(['Week', 'GameID', 'Away', 'Home', 'Spread', 'AwaySpread', 'GameTime', 'Winner']);
    gamesSheet.getRange('A1:H1').setFontWeight('bold').setBackground('#d50a0a').setFontColor('#ffffff');
  }
  
  // Create Picks sheet
  let picksSheet = ss.getSheetByName('Picks');
  if (!picksSheet) {
    picksSheet = ss.insertSheet('Picks');
    picksSheet.appendRow(['Username', 'Week', 'Picks']);
    picksSheet.getRange('A1:C1').setFontWeight('bold').setBackground('#d50a0a').setFontColor('#ffffff');
  }
  
  // Create Standings sheet
  let standingsSheet = ss.getSheetByName('Standings');
  if (!standingsSheet) {
    standingsSheet = ss.insertSheet('Standings');
    standingsSheet.appendRow(['Username', 'TotalPoints', 'Wins', 'Losses', 'Parlays']);
    standingsSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#d50a0a').setFontColor('#ffffff');
  }
  
  SpreadsheetApp.getUi().alert('Sheets setup complete!');
}