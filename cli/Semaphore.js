class Semaphore {
    constructor(maxRunning) {
        this.maxRunning = maxRunning;
        this.running = 0;
        this.queue = [];
    }

    /**
    * Add a worker in process queue.
    */
    async acquire() {
        if (this.running < this.maxRunning) {
            this.running++;
            return;
        }

        return new Promise(resolve => {
            this.queue.push(resolve);
        });
    }

    /**
    * Release a worker in process queue.
    */
    release() {
        this.running--;
        if (this.queue.length > 0) {
            this.running++;
            const resolve = this.queue.shift();
            resolve();
        }
    }
}
module.exports = Semaphore;