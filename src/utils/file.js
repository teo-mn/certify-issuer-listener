const fs = require('fs').promises;
const cacheFilePath = process.env.CACHE_FILE_PATH;

async function readCachedBlockNumber() {
    try {
        const x = await fs.readFile(cacheFilePath, 'utf-8');
        return parseInt(x);
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function cacheBlockNumber(blockNumber) {
    try {
        await fs.writeFile(cacheFilePath, blockNumber.toString());
    } catch (e) {
        console.error(e);
    }
}

module.exports = {
    cacheBlockNumber,
    readCachedBlockNumber
};

