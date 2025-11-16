class Semaphore {
    constructor(max) {
        this.max = max;
        this.running = 0;
        this.queue = [];
    }

    async acquire() {
        if (this.running < this.max) {
            this.running++;
            return;
        }

        return new Promise(resolve => {
            this.queue.push(resolve);
        });
    }

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