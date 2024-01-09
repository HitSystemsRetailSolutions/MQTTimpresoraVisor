const { clear } = require("console");
var readline = require("readline");
var fs = require("fs");
const MQTT = require("mqtt");
const { exit } = require("process");
let shopInfo = { emp: null, lic: null };
let version = "2.0.0";
var header = `----------------------------------
------ 🤖 AutoInstalador 🤖 ----- 
------ 📜 Versión: ${version} 📜 ----- 
----------------------------------\n`;
let oldSetup = require("./setup.json");
let setup = {
  version: version,
  mqttOptions: {
    mqtt: "mqtt://127.0.0.1:1883",
    http: "http://127.0.0.1:3000",
    tout: "robot/out",
    tin: "hit.hardware/printer",
    tinVisor: "hit.hardware/visor",
    LogTin: "hit.hardware/botigues/NomEmpresa/lic/MQTTImpresoraVisor",
    qos: 2,
  },
  GlobalOptions: {
    visor: false,
    balanza: false,
    ShowMessageLog: false,
    empresa: null,
    licencia: null,
  },
  printerOptions: {
    port: "/dev/ttyS0",
    rate: "ss",
    isUsbPrinter: true,
    useVidPid: false,
    vId: "0x000",
    pId: "0x000",
    testPrinter: false,
    imprimirLogo: false,
  },
  visorOptions: { portVisor: "/dev/ttyUSB0", rateVisor: "s" },
  balanzaOptions: { balanca: "/dev/ttyS1" },
};

const mqttClient = MQTT.connect(oldSetup.mqtt);
mqttClient.on("connect", function () {
  mqttClient.subscribe("hit.hardware/shopinfo"); // MQTT sub
});

function printConsole(msg) {
  header += msg + "\n";
  clear();
  console.log(header);
}

async function main() {
  if (oldSetup.version == version) {
    printConsole(
      `📌  La versión actual es la misma que la que se va a instalar, no es necesario actualizar`
    );
    exit(0);
  }
  printConsole(`🛍️  Recibiendo información de tienda en: BackEnd`);
  mqttClient.publish("hit.hardware/getShopInfo");
  setTimeout(() => {
    if (shopInfo.emp == null || shopInfo.lic == null) {
      printConsole(`🛍️  No se ha podido descargar la información de la tienda`);
      console.log("💻 Intentalo de nuevo más tarde");
      exit(0);
    }
    printConsole(`📌  Nombre de la empresa: ${shopInfo.emp}`);
    printConsole(`📌  Licencia de la tienda: ${shopInfo.lic}`);
    setup.mqttOptions.LogTin = `hit.hardware/botigues/${shopInfo.emp}/${shopInfo.lic}/MQTTImpresoraVisor`;
    printConsole(`📌  Configuración MQTT actualizada correctamente! ✔️`);
    setup.GlobalOptions = {
      visor: oldSetup.visor,
      balanza: false,
      ShowMessageLog: oldSetup.ShowMessageLog,
      empresa: shopInfo.emp,
      licencia: shopInfo.lic,
    };
    printConsole(`📌  Configuración Global actualizada correctamente! ✔️`);
    setup.printerOptions = {
      port: oldSetup.port,
      rate: oldSetup.rate,
      isUsbPrinter: oldSetup.isUsbPrinter,
      useVidPid: oldSetup.useVidPid,
      vId: oldSetup.vId,
      pId: oldSetup.pId,
      testPrinter: oldSetup.testUsbImpresora,
      imprimirLogo: false,
    };
    printConsole(
      `📌  Configuración de impresora actualizada correctamente! ✔️`
    );
    setup.visorOptions = {
      portVisor: oldSetup.portVisor,
      rateVisor: oldSetup.rateVisor,
    };
    printConsole(`📌  Configuración de visor actualizada correctamente! ✔️`);
    setup.balanzaOptions = { balanca: oldSetup.balanca };
    printConsole(`📌  Configuración de balanza actualizada correctamente! ✔️`);
    printConsole(`\n\n🏁  Se ha actualizado correctamente el setup`);
    saveOptions();
  }, 1000);
}

async function saveOptions() {
  fs.writeFile("setup.json", JSON.stringify(setup), "utf8", function (err) {
    if (err) return console.log(err);
    console.log("Archivo guardado correctamente");
    process.exit();
  });
}
mqttClient.on("message", async function (topic, message) {
  shopInfo = JSON.parse(message.toString());
});

main();
