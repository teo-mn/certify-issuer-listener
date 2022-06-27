#!/usr/bin/env node

require('dotenv').config()
const Web3 = require('web3');
const net = require('net');

const args = process.argv.slice(2);
const { logger } = require('./src/utils/logging.js');
const { initCLI } = require('./src/utils/args.js');
const { readCachedBlockNumber, cacheBlockNumber } = require('./src/utils/file.js');

const option = initCLI(args);
const log = new logger(option);

const smartContractAbi = require('./src/contracts/UniversityDiploma.json');
const smartContractAddress = process.env.SMART_CONTRACT_ADDRESS;
const nodeIpcPath = process.env.NODE_IPC_PATH;

const web3 = new Web3(nodeIpcPath, net);

const init = async () => {
    const contract = new web3.eth.Contract(smartContractAbi, smartContractAddress);

    let latestBlock = await web3.eth.getBlockNumber();
    let historicalBlock = latestBlock - 1000;
    log.logging().debug(`latest: ${latestBlock}, historical_block: ${historicalBlock}`);

    let computedBlock = await readCachedBlockNumber();
    if (computedBlock) {
        log.logging().info(`Listen events from cache(latest cached block number + 1): ${computedBlock + 1}`);
    } else {
        computedBlock = historicalBlock + 1;
        log.logging().info(`Listen events from historical_block + 1:  ${computedBlock}`);
    }

    // Эвентийг сонсох хэсэг
    contract.events.Issued({
        fromBlock: 0,
    }, (error, event) => {
        if (error) log.logging().error(error);
        getTransferDetails(event);
    }).on('error', (error, receipt) => {
        log.logging().error(error);
        log.logging().debug(receipt);
    });
}

function getTransferDetails(dataEvent) {
    cacheBlockNumber(dataEvent.blockNumber);
    log.logging().debug(dataEvent['returnValues']);
}

init();

