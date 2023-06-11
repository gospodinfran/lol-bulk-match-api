const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
require('dotenv').config();


const API_KEY = process.env.API_KEY;

const league_url = `https://euw1.api.riotgames.com/lol/league/v4/leagues/ffb51787-a612-327d-ab46-d826666d508d?api_key=${API_KEY}`;

const idToName = {};

function readCSVToDictionary(csvFile) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        const champId = row['Champ ID'];
        const champName = row['Champ Name'];
        idToName[champId] = champName;
      })
      .on('end', () => {
        resolve(idToName);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

const csvFile = 'idToName.csv';

readCSVToDictionary(csvFile)
  .then((idToName) => {
    const csvWriter2 = createObjectCsvWriter({
      path: 'gamesData.csv',
      header: [
        { id: 'matchId', title: 'Match ID' },
        { id: 'championId', title: 'Champion ID' }
      ]
    });

    fetchData(league_url)
      .then(async (data) => {
        let summoners = data.entries;
        summoners = summoners.slice(0, 100);

        const summoner_url = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/{summonerId}?api_key=${API_KEY}`;

        const match_url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=20&api_key=${API_KEY}`;

        for (const summoner of summoners) {
          const summonerData = await fetchData(summoner_url.replace('{summonerId}', summoner.summonerId));

          const match_ids = await fetchData(match_url.replace('{puuid}', summonerData.puuid));

          for (const match_id of match_ids) {
            const match_detail_url = `https://europe.api.riotgames.com/lol/match/v5/matches/${match_id}?api_key=${API_KEY}`;
            const matchDetails = await fetchData(match_detail_url);

            let champions = matchDetails.info.participants.map((participant) => participant.championId);

            for (let i = 0; i < champions.length; i++) {
              const championId = champions[i].toString();
              if (idToName.hasOwnProperty(championId)) {
                champions[i] = idToName[championId];
              } else {
                console.warn(`Champ ID: ${championId} not found`);
              }
            }

            const game_i = [{ matchId: match_id, championId: champions }];
            await csvWriter2.writeRecords(game_i);

            // Sleep to avoid hitting the Riot API rate limit
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }
        }
            
            console.log('Wrote to CSV.');
          })
          .catch((error) => {
            console.error(error);
          });
      })
      .catch((error) => {
        console.error('Error:', error);
      });
    
    const fetchData = async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error fetching data from ${url}: ${response.status} ${response.statusText}`);
      }
      return response.json();
    };
            