const { clear } = require("console");
var readline = require("readline");
var fs = require("fs");
const MQTT = require("mqtt");
const { exit } = require("process");
let shopInfo = { emp: null, lic: null };
let dir = require("path").dirname(require.main.filename);

var header =
  " ----------------------------------\n ------------ Cfg MQTT ------------\n ----------------------------------\n";
let setup = {
  version: "2.0.0",
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
    printerIP: false,
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
  ipPrinterOptions: {
    quantity: 1,
    printers: [],
  },
  visorOptions: { portVisor: "/dev/ttyUSB0", rateVisor: "s" },
  balanzaOptions: { balanca: "/dev/ttyS1" },
};

const mqttClient = MQTT.connect(setup.mqttOptions.mqtt);
mqttClient.on("connect", function () {
  mqttClient.subscribe("hit.hardware/shopinfo"); // MQTT sub
});
async function ask(questionText) {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.question(questionText, (input) => {
      rl.close();
      if (["s", "si"].includes(input.toLowerCase())) resolve(true);
      else if (["n", "n"].includes(input.toLowerCase())) resolve(false);
      else {
        clearConsole();
        ask(questionText).then((answer) => resolve(answer));
      }
    });
  });
}

async function askTXT(questionText) {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.question(questionText, (input) => {
      rl.close();
      resolve(input);
    });
  });
}

function clearConsole() {
  clear();
  console.log(header);
  console.log("\n\n ----------------------------------");
}

async function main() {
  clearConsole();
  header += `🔧 Configuración MQTT establecida en: Default`;
  /*
  await ask("❓ Desea modificar los valores MQTT [ Si / No ] ").then(
    async (answer) => {
      if (answer) {
        await mqttOptions();
        console.log("NO DISPONIBLE");
      }
      header += `🔧 Configuración MQTT establecida en: ${
        answer ? "Configuración" : "Valores por defecto"
      }`;
    }
  );*/
  header +=
    "\n\n ----------------------------------\n ----------- Cfg Global -----------\n ----------------------------------";
  clearConsole();
  mqttClient.publish("hit.hardware/getShopInfo");
  await ask("❓ Desea activar el visor [ Si / No ] ").then(async (answer) => {
    setup.GlobalOptions.visor = answer;
    header +=
      "\n🔧 Configuración visor establecida en: " +
      (answer ? "✔️  Activado" : "❌ Desactivado");
  });
  clearConsole();
  await ask("❓ Desea activar la balanza [ Si / No ] ").then(async (answer) => {
    setup.GlobalOptions.balanza = answer;
    header +=
      "\n🔧 Configuración balanza establecida en: " +
      (answer ? "✔️  Activado" : "❌ Desactivado");
  });
  clearConsole();
  await ask("❓ Tienes impresoras IP (comandero) [ Si / No ] ").then(async (answer) => {
    setup.GlobalOptions.printerIP = answer;
    header +=
      "\n🔧 Configuración impresoras IP establecida en: " +
      (answer ? "✔️  Activado" : "❌ Desactivado");
  });
  clearConsole();
  await ask("❓ Desea activar los Logs [ Si / No ] ").then(async (answer) => {
    setup.GlobalOptions.ShowMessageLog = answer;
    header +=
      "\n🔧 Configuración de Logs establecida en: " +
      (answer ? "✔️  Activado" : "❌ Desactivado");
  });
  header +=
    "\n\n ----------------------------------\n --------- Cfg Empresa -----------\n ----------------------------------";
  clearConsole();
  if (shopInfo.emp == null || shopInfo.lic == null) {
    await setShopInfo();
  } else {
    header += `\n🔧 Empresa: ✔️  ${shopInfo.emp} (BackEnd)\n🔧 Licencia:✔️  ${shopInfo.lic} (BackEnd)`;
  }
  setup.GlobalOptions.empresa = shopInfo.emp;
  setup.GlobalOptions.licencia = shopInfo.lic;
  setup.mqttOptions.LogTin = `hit.hardware/botigues/${shopInfo.emp}/${shopInfo.lic}/MQTTImpresoraVisor`;

  header +=
    "\n\n ----------------------------------\n --------- Cfg Impresora ----------\n ----------------------------------";
  clearConsole();
  await ask("❓ Es una impresora serie [ Si / No ] ").then(async (answer) => {
    setup.printerOptions.isUsbPrinter = !answer;
    header +=
      "\n🔧 Tipo de impresora: " + (answer ? "🖨️    Serie" : "🔌    USB");
    if (answer) await printerSerialOptions();
    else await printerUsbOptions();
  });
  clearConsole();
  await ask("❓ Impresión de prueba [ Si / No ] ").then(async (answer) => {
    setup.printerOptions.testPrinter = answer;
    header +=
      "\n🔧 Impresión de prueba: " +
      (answer ? "✔️  Activado" : "❌ Desactivado");
  });
  clearConsole();
  await ask("❓ Imprimir logo [ Si / No ] ").then(async (answer) => {
    setup.printerOptions.imprimirLogo = answer;
    header +=
      "\n🔧 Impresión del logo: " +
      (answer ? "✔️  Activado" : "❌ Desactivado");
  });

  if (setup.GlobalOptions.printerIP) {
    header +=
      "\n\n ----------------------------------\n ------------ Cfg Impresoras IP ------------\n ----------------------------------";
    clearConsole();
    await printerIPOptions();
  }

  if (setup.GlobalOptions.visor) {
    header +=
      "\n\n ----------------------------------\n ------------ Cfg Visor ------------\n ----------------------------------";
    clearConsole();
    await visorOptions();
  }
  clearConsole();
  if (setup.GlobalOptions.balanza) {
    header +=
      "\n\n ----------------------------------\n ----------- Cfg Balanza -----------\n ----------------------------------";
    clearConsole();
    await askTXT("❓ Puerto de la balanza (default: /dev/ttyS1) ").then(
      async (answer) => {
        if (answer != "") setup.balanzaOptions.balanca = answer;
        else setup.balanzaOptions.balanca = "/dev/ttyS1";
        header +=
          "\n🔧 Puerto de la balanza: 🔌    " + setup.balanzaOptions.balanca;
      }
    );
  }
  clearConsole();
  header += "\n\n" + JSON.stringify(setup);
  clearConsole();
  await ask("❓ La configuración es correcta (No = Repetir) [ Si / No ] ").then(
    async (answer) => {
      if (!answer) main();
      else saveOptions();
    }
  );
}

mqttClient.on("message", async function (topic, message) {
  shopInfo = JSON.parse(message.toString());
});

async function setShopInfo() {
  await askTXT("❓ Nombre de la empresa: (default: Demo) ").then(
    async (answer) => {
      if (answer == "") answer = "Demo";
      shopInfo.emp = answer;
      header += "\n🔧 Empresa: ✔️  " + shopInfo.emp + " (Manual)";
    }
  );
  clearConsole();
  await askTXT("❓ Licencia: (default: 904) ").then(async (answer) => {
    if (answer == "") answer = "904";
    shopInfo.lic = answer;
    header += "\n🔧 Licencia:✔️  " + shopInfo.lic + " (Manual)";
  });
  clearConsole();
}

async function mqttOptions() { }

async function printerUsbOptions() {
  clearConsole();
  await ask("❓ Usar Vid i Pid [ Si / No ] ").then(async (answer) => {
    if (answer) {
      setup.printerOptions.useVidPid = true;
      header += "\n🔧 Usar Vid i Pid: ✔️  Activado";
      clearConsole();
      await askTXT("❓ Vid (0x000) ").then(async (answer) => {
        setup.printerOptions.vId = answer;
      });
      await askTXT("❓ Pid (0x000) ").then(async (answer) => {
        setup.printerOptions.pId = answer;
      });
    } else {
      header += "\n🔧 Usar Vid i Pid: ❌ Desactivado";
      clearConsole();
    }
  });
}

async function printerSerialOptions() {
  clearConsole();
  await askTXT("❓ Puerto de la impresora (default: /dev/ttyS0) ").then(
    async (answer) => {
      if (answer != "") setup.printerOptions.port = answer;
      else setup.printerOptions.port = "/dev/ttyS0";
      header += "\n🔧 Puerto de la impresora: 🔌  " + setup.printerOptions.port;
    }
  );
  clearConsole();
  await askTXT("❓ Ratio de la impresora (default: 115200) ").then(
    async (answer) => {
      if (answer != "") setup.printerOptions.rate = Number(answer);
      else setup.printerOptions.rate = 115200;
      header +=
        "\n🔧 Ratio de la impresora: ⏱️     " + setup.printerOptions.rate;
    }
  );
  clearConsole();
}

async function visorOptions() {
  clearConsole();
  await askTXT("❓ Puerto del visor (default: /dev/ttyUSB0) ").then(
    async (answer) => {
      if (answer != "") setup.visorOptions.portVisor = answer;
      else setup.visorOptions.portVisor = "/dev/ttyUSB0";
      header += "\n🔧 Puerto del visor: 🔌    " + setup.visorOptions.portVisor;
    }
  );
  clearConsole();
  await askTXT("❓ Ratio del visor (default: 9600) ").then(async (answer) => {
    if (answer != "") setup.visorOptions.rateVisor = answer;
    else setup.visorOptions.rateVisor = 9600;
    header += "\n🔧 Ratio del visor: ⏱️     " + setup.visorOptions.rateVisor;
  });
  clearConsole();
}
async function printerIPOptions() {
  clearConsole();
  //cuantas impresoras tiene
  await askTXT("❓ Cuantas impresoras IP tienes? (default: 1) ").then(
    async (answer) => {
      if (answer == "") answer = "1";
      setup.ipPrinterOptions.quantity = Number(answer);
      header +=
        "\n🔧 Cantidad de impresoras IP: ✔️  " + setup.ipPrinterOptions.quantity;
    }
  );
  clearConsole();
  for (let i = 0; i < setup.ipPrinterOptions.quantity; i++) {
    await askTXT(
      `❓ Nombre de la impresora ${i + 1} (default: ${shopInfo.lic}_cafe ) `
    ).then(async (answer) => {
      if (answer == "") answer = shopInfo.lic + "_cafe";
      setup.ipPrinterOptions.printers[i] = {
        name: answer,
        ip: "0.0.0.0",
        port: "9100",
      };
      header +=
        "\n🔧 Nombre de la impresora " + (i + 1) + ": ✔️  " + setup.ipPrinterOptions.printers[i].name;
    });
    clearConsole();
    await askTXT(
      `❓ IP de la impresora ${i + 1} (default: 0.0.0.0) `
    ).then(async (answer) => {
      if (answer == "") answer = "0.0.0.0";
      setup.ipPrinterOptions.printers[i].ip = answer;
      header +=
        "\n🔧 IP de la impresora " + (i + 1) + ": ✔️  " + setup.ipPrinterOptions.printers[i].ip;
    });
    clearConsole();
    await askTXT(
      `❓ Puerto de la impresora ${i + 1} (default: 9100) `
    ).then(async (answer) => {
      if (answer == "") answer = "9100";
      setup.ipPrinterOptions.printers[i].port = answer;
      header +=
        "\n🔧 Puerto de la impresora " + (i + 1) + ": ✔️  " + setup.ipPrinterOptions.printers[i].port;
    });
  }
  clearConsole();
}
async function saveOptions() {
  fs.writeFile(
    dir + "/setup.json",
    JSON.stringify(setup),
    "utf8",
    function (err) {
      if (err) return console.log(err);
      console.log("Archivo guardado correctamente");
      exit();
    }
  );
}
main();
