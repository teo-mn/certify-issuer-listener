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

const web3 = new Web3(nodeIpcPath, net);

async function init() {
    await initKafka();
    let contract;
    let computedBlock;

    try {
        contract = new web3.eth.Contract(smartContractAbi, smartContractAddress);

        let latestBlock = await web3.eth.getBlockNumber();
        let historicalBlock = latestBlock - 1000;
        log.logging().debug(`[CRX] latest: ${latestBlock}, historical_block: ${historicalBlock}`);

        computedBlock = await readCachedBlockNumber();
        if (computedBlock) {
            log.logging().info(`[SC] Listen events from cache(latest cached block number + 1): ${computedBlock + 1}`);
        } else {
            computedBlock = historicalBlock + 1;
            log.logging().info(`[SC] Listen events from historical_block + 1:  ${computedBlock}`);
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    } 

    // Эвентийг сонсох хэсэг
    contract.events.Issued({
        fromBlock: computedBlock + 1,
    }, async (error, event) => {
        if (error) log.logging().error(error);
        await getTransferDetails(event);
    }).on('error', (error, receipt) => {
        log.logging().error(error);
        log.logging().debug(receipt);
    });
}

async function getTransferDetails(dataEvent) {
    log.logging().info(`[SC] new event at block number: ${dataEvent.blockNumber},`);
    log.logging().debug(`[SC] event details: ${JSON.stringify(dataEvent['returnValues'])}`);

    let message = {
        blockNumber: dataEvent.blockNumber,
        issuer: dataEvent[ 'returnValues' ][ 'issuer' ],
        hash: dataEvent[ 'returnValues' ][ 'hash' ],
        imageHash: dataEvent[ 'returnValues' ][ 'imageHash' ],
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

        log.logging().debug(`[KAFKA] Published message:`);
        log.logging().debug(`[KAFKA] ${JSON.stringify(responses)}`);

        cacheBlockNumber(message.blockNumber);
    }  catch(error) {
        log.logging().error(error);
    }
    await producer.disconnect();
}

async function initKafka() {
    const admin = kafka.admin();
    try {
        await admin.connect();
        await admin.createTopics({
            waitForLeaders: true,
            topics: [
                {
                    topic: topicName,
                    replicationFactor: 3
                }
            ],
        });
    } catch(error) {
        log.logging().error(error);
    }
}

init();

