import { createSubLogger } from "../logging";
const logger = createSubLogger('scheduled-task');

class ScheduledJob {
  PERIOD_IN_MINUTES;
  timer: any;
  task;

  constructor(func: any, PERIOD_IN_MINUTES: any) {
    this.task = func;
    this.PERIOD_IN_MINUTES = PERIOD_IN_MINUTES;
  }

  async start() {
    try {
      const start = process.hrtime();
      const results = await this.task();
      const end = process.hrtime(start);
      logger.debug(`task execution took ${end[0]} sec`);

      let ms;

      if (end[0] < this.PERIOD_IN_MINUTES * 60) {
        ms = (this.PERIOD_IN_MINUTES * 60 - end[0]) * 1000;
      } else {
        ms = 0;
      }

      logger.debug(`will run in ${Math.round(ms / 60000)} minutes`);
      this.timer = setTimeout(this.start.bind(this), ms);
      return results;
    } catch (e) {
      logger.error('error in task execution: ', e);
    }
  }

  stop() {
    clearTimeout(this.timer);
    return;
  }
}

export default ScheduledJob;
