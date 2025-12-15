/**
 * 
 */
export default class Semaphore {

    private readonly maxWorkers: number;
    private runningWorkers: number;
    private queue: [];

    constructor(maxWorkers: number) {
        this.maxWorkers = maxWorkers;
        this.runningWorkers = 0;
        this.queue = [];
    }

    /**
    * Add a worker in process queue.
    */
    async acquire() {
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
        this.runningWorkers--;
        if (this.queue.length > 0) {
            this.runningWorkers++;
            this.queue.shift();
        }
    }
}
