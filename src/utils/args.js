function initCLI(cmdArgs) {
    let option = 'info';

    switch (cmdArgs[0]) {
        case '--verbose':
            console.log('It\'s verbose');
            option = 'debug';
            break;
        default:
            console.log('Default mode');
            option = 'info';
    };

    return option;
}

module.exports = { initCLI };
