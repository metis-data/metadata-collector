const main = require('./collect-runner');

class App {
    constructor() { }

    async start() {
        main();
        return;
    }
}

const app = new App();
app.start();