const path = require("path");
const logger = require("node-file-logger");

const options = {
    timeZone: "Europe/Madrid",
    folderPath: path.join(__dirname, "logs"),
    dateBasedFileNaming: true,
    fileNamePrefix: "logMQTTimpresora_",
    fileNameExtension: ".log",
    dateFormat: "YYYY_MM_DD",
    timeFormat: "HH:mm:ss",
};

logger.SetUserOptions(options);

module.exports = { logger };