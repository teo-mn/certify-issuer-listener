const { cacheBlockNumber } = require('./file');

function getTransferDetails(data_event) {
    cacheBlockNumber(data_event.blockNumber);
    console.log(data_event['returnValues']);
};

module.exports = { getTransferDetails };
