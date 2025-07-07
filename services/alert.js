const chalk = require('chalk')
const readline = require('readline');
const figlet = require('figlet')
const clear = require('clear')

const constant = require('./constant')
const template = require('../helpers/template');
const file = require('../helpers/file');

exports.message = (title, message) => {
    if (!message) {
        message = title;
        console.log(
            chalk.yellow(message)
        );
    } else {
        console.log(
            chalk.bgYellow.black.bold(title),
            chalk.yellow(message)
        );
    }
}

exports.banner = (message) => {
    clear();
    console.log(chalk.yellow(figlet.textSync(message, { horizontalLayout: 'full' })));
}


const _timestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
exports.error = (code, data, error) => {

    if (error) {
        file.append({
            folder: ['$logs', 'errors'],
            file: `${_timestamp()}.json`
        }, error)
    }

    if (!data) {
        data = code;
    }

    let key = code || data.code || data.message || data;

    let item = constant.errors.get(key)

    if (!item) {
        item = {
            code: key,
            level: 'fatal',
            name: data.name || data.message || 'Error',
            actions: []
        };

        // if (typeof error === 'object') {

        //   if (error.message) {
        //     key = error.message;
        //   }
        //   error = JSON.stringify(error)
        // }
    }



    let icon;
    /* eslint-disable */
    switch (item.level) {
        case 'fatal':
            icon = '☠️';
            break;
        case 'warning':
            icon = '⚠️';
            break;
        default:
            icon = '✖';
    }
    /* eslint-enable */

    if (!item.message) {
        item.message = JSON.stringify(data);
    } else if (typeof item.message === 'string' && item.message.indexOf("{{") !== -1) {
        item.message = template.formatter(item.message).inject({
            data: data
        });
    }

    console.error(
        chalk.bgRed.white.bold(`${icon}  ${item.name}:  `),
        chalk.red(item.message)
    );

}

exports.info = (title, message) => {

    if (!message) {
        message = title;
        title = 'Info:'
    }

    let icon = 'ⓘ';
    console.log(
        chalk.bgBlue.black.bold(`${icon}  ${title}:  `),
        chalk.blue(message)
    );
}


exports.success = (title, message) => {

    if (!message) {
        message = title;
        title = 'Success:'
    }

    let icon = '✔';
    console.log(
        chalk.green.bold(`${icon}  ${title}:  `),
        chalk.green(message)
    );
}


class Progress {
    constructor() {
        this.total = 0;
        this.count = 0;
        this.message = '';
    }

    getElapsedTime() {
        const elapsedMs = Date.now() - this.startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        if (elapsedSeconds < 60) {
            return `${elapsedSeconds}s`;
        } else if (elapsedSeconds < 3600) {
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            return `${minutes}m ${seconds}s`;
        } else {
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            const seconds = elapsedSeconds % 60;
            return `${hours}h ${minutes}m ${seconds}s`;
        }
    }


    start(total, message = '') {
        if (typeof total !== 'number') {
            throw new Error("Total must be a number.");
        }
        this.total = total;
        this.count = 0;
        this.message = message;

        this.startTime = Date.now();
        this.display();
        return this; // Enable chaining
    }

    // Update the progress count and optional message
    update(count, message = this.message) {
        if (typeof count !== 'number') {
            throw new Error("Count must be a number.");
        }
        this.count = count;
        this.message = message;
        this.display();
        return this; // Enable chaining
    }

    // End the progress with an optional final message
    end(message = 'Completed') {
        this.count = this.total;
        this.message = message;
        this.display();
        return this; // Enable chaining
    }

    // Display the current progress (can be customized)
    display() {

        const percentage = this.total ? (this.count / this.total) * 100 : 0;


        const barWidth = 30; // Total width of the progress bar
        const filledBarLength = Math.round(barWidth * (percentage / 100));

        const filledBar = '█'.repeat(filledBarLength); // Filled portion
        const emptyBar = '░'.repeat(barWidth - filledBarLength); // Empty portion

        // Clear the line and update with the new progress
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`${chalk.blue(filledBar)}${chalk.gray(emptyBar)} [${this.getElapsedTime()}] ${this.message} `);
    }
}



exports.progress = () => {
    return new Progress();
}
