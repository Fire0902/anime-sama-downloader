const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Prompt and read user input.
 * @param message text to prompt
 * @returns user input. 
 */
async function ask(message = "Prompt something") {
    message = message.concat(' : ');
    return new Promise((resolve) => {
        rl.question(message, (answer) => {
            resolve(answer);
            rl.close();
        });
    });
}

module.exports = { ask };