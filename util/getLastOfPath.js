// ex: "http://localhost:3000/assets/warder_icon.png" -> return "warder_icon.png"

function getLastOfPath(link) {
    const sp = link.split("/");
    return sp[sp.length - 1];
}

module.exports = getLastOfPath;