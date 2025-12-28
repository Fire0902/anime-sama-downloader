import Log from '../log/Log.ts';

/**
 * Class for handling download process semamphore.
 */
export default class Semaphore {
    private static readonly logger = Log.create(this.name);

    private readonly maxWorkers: number;
    private runningWorkers: number;
    private readonly queue: [];

    constructor(maxWorkers: number) {
        Semaphore.logger.info('Creating new semaphore');
        this.maxWorkers = maxWorkers;
        this.runningWorkers = 0;
        this.queue = [];
    }

    /**
    * Add a worker in process queue.
    */
    async acquire() {
        Semaphore.logger.info('Acquiring semaphore worker');
        if (this.runningWorkers < this.maxWorkers) {
            this.runningWorkers++;
            return;
        }
        return new Promise(resolve => this.queue.push(resolve));
    }

    /**
    * Release a worker in process queue.
    */
    release() {
        Semaphore.logger.info('Releasing semaphore worker');
        this.runningWorkers--;
        if (this.queue.length > 0) {
            this.runningWorkers++;
            const resolve = this.queue.shift();
            resolve();
        }
    }
}
