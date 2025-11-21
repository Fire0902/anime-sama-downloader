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
        rl.question(message, (answer) => resolve(answer));
    });
}

/**
 * @param message text to prompt
 * @returns user input as string.
 */
async function askName(message = "\nEnter a name"){
    let name = await ask(message);
    return name.replace(" ", "+");
}

/**
 * @param message text to prompt
 * @param isArrayIndex if selected number is a index in an array
 * @returns user input as integer.
 */
async function askNumber(message = "\nChoose a result (Number)", isArrayIndex = false){
    let number = await ask(message);
    number = parseInt(number);
    if (isArrayIndex) number--;
    return number;
}

/**
 * The rl.close() method closes the Interface instance and relinquishes control over the input and output streams. 
 * When called, the 'close' event will be emitted.
 * 
 * Calling rl.close() does not immediately stop other events (including 'line') from being emitted by the Interface instance.
 */
function closeReader() {
    rl.close();
}

module.exports = { ask, askName, askNumber, closeReader };