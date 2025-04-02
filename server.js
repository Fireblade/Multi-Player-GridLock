// Node.js WebSocket server (server.js)
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

const gridSize = 60;
const cells = Array(gridSize * gridSize).fill(0);
const players = {};
let nextPlayerId = 1;

function findEmptyCell() {
    let emptyCells = [];
    for(let i = 0; i < gridSize * gridSize; i++){
        let isClaimed = false;
        for(let player in players){
            if(players[player].cells.includes(i)){
                isClaimed = true;
                break;
            }
        }
        if(!isClaimed){
            emptyCells.push(i);
        }
    }
    return emptyCells[Math.floor(Math.random()*emptyCells.length)];
}

function updateClients() {
    wss.clients.forEach(client => {
        let cellUpdates = {};
        cells.forEach((troopCount, index) => {
            cellUpdates[index] = troopCount;
        });
        client.send(JSON.stringify({ type: "update", players: players, cellUpdates: cellUpdates }));
    });
}

function troopGeneration(){
    for(let playerId in players){
        let player = players[playerId];
        cells[player.hq]++;
    }
    updateClients();
}
function troopDecay(){
    cells.forEach((troopCount, index) => {
        if (troopCount > 0) {
            let owned = false;
            for (let playerId in players) {
                if (players[playerId].cells.includes(index) && players[playerId].hq !== index) {
                    owned = true;
                    break; // Add break to exit loop early if cell is owned
                }
            }
            if (!owned) {
                cells[index]--;
            }
        }
    });
    updateClients();
}

setInterval(troopGeneration, 5000);
setInterval(troopDecay, 30000);

wss.on("connection", ws => {
    ws.on("message", message => {
        const data = JSON.parse(message);

        if (data.type === "join") {
            const playerId = nextPlayerId++;
            const hq = findEmptyCell();
            players[playerId] = {
                id: playerId,
                name: data.name,
                color: data.color,
                cells: [hq],
                hq: hq,
            };
            cells[hq] = 1;
            ws.playerId = playerId;
            updateClients();
        } else if (data.type === "move") {
            if (!players[ws.playerId]) return;

            const from = data.from;
            const to = data.to;
            const troops = data.troops;

            if (!players[ws.playerId].cells.includes(from)) return;
            if(cells[from] < troops) return;

            cells[from] -= troops;
            if(cells[to] > 0){
                if(cells[to] >= troops){
                    cells[to] -= troops;
                } else{
                    cells[to] = 0;
                    if(players[ws.playerId].cells.includes(to)) {
                        cells[to] = troops - cells[to];
                    }else{
                        for(let playerID in players){
                            if(players[playerID].cells.includes(to)){
                                const index = players[playerID].cells.indexOf(to);
                                if(index > -1){
                                    players[playerID].cells.splice(index,1);
                                }
                                break;
                            }
                        }
                        players[ws.playerId].cells.push(to);
                        cells[to] = troops - cells[to];
                    }
                }
            }else{
                if(players[ws.playerId].cells.includes(to)) {
                    cells[to] += troops;
                }else{
                    for(let playerID in players){
                        if(players[playerID].cells.includes(to)){
                            const index = players[playerID].cells.indexOf(to);
                            if(index > -1){
                                players[playerID].cells.splice(index,1);
                            }
                            break;
                        }
                    }
                    players[ws.playerId].cells.push(to);
                    cells[to] += troops;
                }
            }

            updateClients();
        }
    });

    ws.on("close", () => {
        if (ws.playerId) {
            delete players[ws.playerId];
            updateClients();
        }
    });
});