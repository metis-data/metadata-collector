import  main   from './collect-runner';

class App {

    start() {
        main();
        return;
    }
}

const app = new App();
app.start();