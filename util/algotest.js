export {gridInit, display_grid}

function emptyGrid(){
    let grid = new Array();
    let size = 5;
    for (let i=0;i<size;i++){
        grid[i]= new Array()
        for (let j=0;j<size;j++){
            grid[i][j] = "~";
        }
    }
    return grid
}

function getRandomSpot(){
    return Math.floor(Math.random()*25)
}

function gridInit(obstacleAmt){
    let grid = emptyGrid();
    let obsPos = new Set();
    let warderPos;
    let prisonerPos;
    let tunnelPos;

    let count = 5;
    if(!isNaN(obstacleAmt)){
        count = obstacleAmt;
    }
    let i = 0;
    while(i<count){
        let pos = getRandomSpot()
        if(obsPos.has(pos)){
           continue;
        }
        let x = Math.floor(pos/5);
        let y = pos%5;
        grid[x][y]="X";

        if(countIslands(grid)>1){
            grid[x][y]="~";
            continue;
        }
        obsPos.add(pos);
        i++;       
    }
    let tunnelNotFound=true;

    while(tunnelNotFound){
        let pos = getRandomSpot()
        if(obsPos.has(pos)){
           continue;
        }
        let x = Math.floor(pos/5);
        let y = pos%5;
        grid[x][y]="T";

        if(countIslands(grid)>1){
            grid[x][y]="~";
            continue;
        }
        // obsPos.add(pos);
        tunnelPos = pos;
        tunnelNotFound=false;       
    }

    let hasPrisoner = false;
    let hasWarden = false;

    while(!hasPrisoner){
        let spot = getRandomSpot();
        if (obsPos.has(spot) || spot == tunnelPos) {
            continue;
        }
        let x = Math.floor(spot / 5);
        let y = spot % 5;
        grid[x][y] = "P";

        if (countIslands(grid) > 1) {
            grid[x][y] = "~";
            continue;
        }
        prisonerPos = spot;
        hasPrisoner = true;
    }

    while(!hasWarden){
        let spot = getRandomSpot();
        if (obsPos.has(spot) || spot == prisonerPos || spot == tunnelPos) {
            continue;
        }
        let x = Math.floor(spot / 5);
        let y = spot % 5;
        grid[x][y] = "W";

        if (countIslands(grid) > 1) {
            grid[x][y] = "~";
            continue;
        }
        warderPos = spot;
        hasWarden = true;
    }

    return {grid, obsPos, warderPos, prisonerPos, tunnelPos}
}

function display_grid(grid){
    //grid is alwasy 5x5 blank = ~
    let line = "   | 1 | 2 | 3 | 4 | 5 | \n";
    let rowh =[" A | "," B | "," C | "," D | "," E | "];
    for(let i = 0; i<5;i++){
        line+= "-------------------------\n";
        line+= rowh[i];
        for(let j =0;j<5;j++){
            let char = grid[i][j];
            line += char;
            line += " | ";
        }
        line+="\n";
    }
    line+= "-------------------------";
    console.log(line);
}

function isAllowed(grid,r,c,visited){
    let row = grid.length;
    let col = grid[0].length;
    if(!((r >= 0) && (r < row) && (c >= 0) && (c < col))){
        return false;
    }
    return (grid[r][c] == '~' && !visited[r][c]);
}

function dfs(grid,r,c,visited){
    let rNbr = [-1,0,0,1];
    let cNbr = [0,1,-1,0];

    visited[r][c]=true;
    for(let k =0;k<4;k++){
        let newR = r+rNbr[k];
        let newC = c+cNbr[k];
        if (isAllowed(grid,newR,newC,visited)){
            dfs(grid,newR,newC,visited)
        }
    }
}

function countIslands(grid){
    let size = 5;
    let visited = new Array(size).fill().map(() => Array(size).fill(false));
    let count =0;
    for(let r =0;r<size;r++){
        for(let c=0;c<size;c++){
            if(grid[r][c]=='~' && !visited[r][c]){
                dfs(grid,r,c,visited);
                count++;
            }
        }
    }
    return count
}

function test(){
    const emptygrid = emptyGrid();
    display_grid(emptygrid)
    const {grid, obsPos, wardenPos, prisonerPos, tunnelPos} = gridInit();
    display_grid(grid)
    let islandCount = countIslands(grid)
    console.log(islandCount)
    // checkConsec(grid)
}