// module.exports = (io) => {
//     // server-side IO code for game page here
// }

import { gridInit, display_grid } from '../util/algotest.js';

function _initObjectPosition(htmlElem, posInGrid){
    let elemStyle = window.getComputedStyle(htmlElem);

    let topVal = elemStyle.getPropertyValue("top").replace("px", "");
    htmlElem.style.top = (Number(topVal) + (Math.floor(posInGrid / 5) * 20)) + "%";

    let leftVal = elemStyle.getPropertyValue("left").replace("px", "");
    htmlElem.style.left = (Number(leftVal) + ((posInGrid % 5) * 20)) + "%";
}

function gameStart(){
    const {grid, obsPos, wardenPos, prisonerPos, tunnelPos} = gridInit();
    display_grid(grid)
    let obsPosArray = Array.from(obsPos);
    for(let i = 0; i < obsPosArray.length; i++){
        let pos = obsPosArray[i];
        let obs = document.getElementById(`obstacle${i}`);
        _initObjectPosition(obs, pos);
    }

    let prisoner = document.getElementById("prisoner");
    _initObjectPosition(prisoner, prisonerPos);

    let warden = document.getElementById("warden");
    _initObjectPosition(warden, wardenPos);

    let tunnel = document.getElementById("tunnel");
    _initObjectPosition(tunnel, tunnelPos);
}

gameStart()