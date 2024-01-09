var childProcess = require("child_process");
var fs = require("fs");
function runScript(scriptPath, callback) {
  // keep track of whether callback has been invoked to prevent multiple invocations
  var invoked = false;

  var process = childProcess.fork(scriptPath);

  // listen for errors as they may prevent the exit event from firing
  process.on("error", function (err) {
    if (invoked) return;
    invoked = true;
    callback(err);
  });

  // execute the callback once the process has finished running
  process.on("exit", function (code) {
    if (invoked) return;
    invoked = true;
    var err = code === 0 ? null : new Error("exit code " + code);
    callback(err);
  });
}
var setup = null;
let dir = require("path").dirname(require.main.filename);
async function checkSetup() {
  try {
    await fs.readFile(dir + "/setup.json", "utf8", function read(err, data) {
      if (err) {
        throw err;
      }
      const content = JSON.parse(data);
      setup = content;
      if (setup.version) {
        runScript("./mqtt.js", function (err) {
          checkSetup();
        });
      } else {
        runScript("./configuratorScriptAuto.js", function (err) {
          setup = null;
          setup = require(dir + "/setup.json");
          checkSetup();
        });
      }
    });
  } catch (e) {
    runScript("./configuratorScript.js", function (err) {
      checkSetup();
    });
  }
}

checkSetup();
