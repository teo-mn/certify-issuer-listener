require('dotenv').config()

const { Kafka } = require('kafkajs');
const clientId = process.env.CLIENT_ID;
const brokers = new Array(process.env.KAFKA_BROKER_ADDRESS);
const topicName = process.env.KAFKA_TOPIC_NAME;

const kafka = new Kafka({ clientId, brokers });
const producer = kafka.producer();

const args = process.argv.slice(2);
const { logger } = require('./src/utils/logging.js');
const { initCLI } = require('./src/utils/args.js');
const { readCachedBlockNumber, cacheBlockNumber } = require('./src/utils/file.js');

const option = initCLI(args);
const log = new logger(option);

const Web3 = require('web3');
const net = require('net');
const smartContractAbi = require('./src/contracts/UniversityDiploma.json');
const smartContractAddress = process.env.SMART_CONTRACT_ADDRESS;
const nodeIpcPath = process.env.NODE_IPC_PATH;

let web3;

if (nodeIpcPath.includes('.ipc')) {
    web3 = new Web3(new Web3.providers.IpcProvider(nodeIpcPath, net));
} else {
    web3 = new Web3(nodeIpcPath);
}

async function init() {
    await initKafka();
    let contract;
    let computedBlock;
    let latestBlock = 0;
    const blockSize = parseInt(process.env.BLOCK_SIZE) || 1000;

    try {
        contract = new web3.eth.Contract(smartContractAbi, smartContractAddress);

        latestBlock = await web3.eth.getBlockNumber();
        log.logging().debug(`[CRX] latest: ${latestBlock}`);

        computedBlock = await readCachedBlockNumber();
        if (computedBlock) {
            log.logging().info(`[SC] Listen events from cache(latest cached block number + 1): ${computedBlock + 1}`);
        } else {
            computedBlock = 1;
            log.logging().info(`[SC] Listen events from historical_block + 1:  ${computedBlock}`);
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }

    while (latestBlock - computedBlock > blockSize) {
      log.logging().info(`[SC] Parse events from : ${computedBlock + 1} to: ${computedBlock + blockSize}`);
      const data = await contract.getPastEvents('Issued', {fromBlock: computedBlock + 1, toBlock: computedBlock + blockSize});
      for (const item of data) {
        await getTransferDetails(item);
      }
      computedBlock = computedBlock + blockSize;
    }

    // Эвентийг сонсох хэсэг
    contract.events.Issued({
        fromBlock: computedBlock + 1,
    }, async (error, event) => {
        if (error) console.error(error);
        else await getTransferDetails(event);
    }).on('error', (error, receipt) => {
        log.logging().error(error);
        log.logging().debug(receipt);
    });
}

async function getTransferDetails(dataEvent) {
    log.logging().info(`[SC] new event at block number: ${dataEvent.blockNumber}`);
    log.logging().debug(`[SC] event details: ${JSON.stringify(dataEvent['returnValues'])}`);

    let message = {
        blockNumber: dataEvent.blockNumber,
        issuer: dataEvent[ 'returnValues' ][ 'issuer' ],
        hash: dataEvent[ 'returnValues' ][ 'hash' ],
        metaHash: dataEvent[ 'returnValues' ][ 'metaHash' ],
        certNum: dataEvent[ 'returnValues' ][ 'certNum' ],
        timestamp: dataEvent[ 'returnValues' ][ 'timestamp' ]
    };

    await messageProducer(message);
}


async function messageProducer(message) {
    try {
        await producer.connect();
        const responses = await producer.send({
            topic: topicName,
            messages: [
                { key: message.certNum, value: JSON.stringify(message) }
            ],
        });

        log.logging().debug(`[KAFKA] Published message: ${JSON.stringify(responses)}`);

        await cacheBlockNumber(message.blockNumber);
    }  catch(error) {
        log.logging().error(error);
    }
    await producer.disconnect();
}

async function initKafka() {
    const admin = kafka.admin();
    try {
        await admin.connect();
        const list = await admin.listTopics();
        if (!list.find(item => item === topicName)) {
          await admin.createTopics({
            waitForLeaders: true,
            topics: [
              {
                topic: topicName
              }
            ],
          });
        }
    } catch(error) {
        log.logging().error(error);
    }
}

init();

