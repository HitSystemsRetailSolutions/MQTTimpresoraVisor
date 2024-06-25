// imports de modulos de terceros
const SerialPort = require("serialport");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");
const MQTT = require("mqtt");
const Jimp = require("jimp");
const fs = require("fs");
const axios = require("axios");
const { get } = require("http");
escpos.Serial = require("escpos-serialport");
// cargamos la configuracion
let dir = require("path").dirname(require.main.filename);
let setup = require(dir + "/setup.json");
// iniciamos variables necesarias
const mqttClient = MQTT.connect(setup.mqttOptions.mqtt);

//Global Vars
let serialVisor = undefined;
let serialBalanca = undefined;

//barlanza vars
var lastPes = "";
var lastPesEstable = "";
var avisat = false;

async function log(msg) {
  mqttClient.publish(setup.mqttOptions.LogTin, msg);
  console.log(msg);
}

async function initializer() {
  //iniciar mqtt
  log("\n◌ Inicializando MQTT...");
  try {
    await mqttClient.on("connect", function () {
      mqttClient.subscribe(setup.mqttOptions.tin); // MQTT sub
      mqttClient.subscribe(setup.mqttOptions.tinVisor); // MQTT sub
      mqttClient.subscribe("hit.hardware/logo");
      mqttClient.subscribe("hit.hardware/getSetup");
      mqttClient.subscribe("hit.hardware/sendSetup");
    });
    log(" -> MQTT iniciado correctamente ✓");
  } catch (e) {
    log(
      " ❗ Error urgente: Error al iniciar MQTT\nError --> " +
        e +
        "\n     - Solucion --> Revisar la configuracion de MQTT en el archivo setup.js\n"
    );
  }

  if (setup.GlobalOptions.balanza) {
    log("◌ Inicializando balanza...");
    await exists(setup.balanzaOptions.balanca)
      .then((res) => {
        if (!res)
          throw new Error("No se ha encontrado la balanza en el sistema.");
        serialBalanca = SerialPort(setup.balanzaOptions.balanca, {
          baudRate: 9600,
          parser: new SerialPort.parsers.Readline("\r"),
        });
        log(" -> Balanza inicializada ✓");
      })
      .catch((e) => {
        log(
          " ❗ Error urgente: Error al inicializar la balanza\n     - Error --> " +
            e +
            "\n     - Solucion --> Revisar la configuracion de la balanza en el archivo setup.js\n"
        );
      });
  }
  if (setup.GlobalOptions.visor) {
    log("\n◌ Inicializando visor...");
    try {
      serialVisor = await getVisor();
      if (!serialVisor)
        throw new Error("No se ha encontrado el visor en el sistema.");
      log(" -> Visor inicializado ✓");
    } catch (e) {
      log(
        " ❗ Error urgente: Error al inicializar el visor\n     - Error --> " +
          e +
          "\n     - Solucion --> Revisar la configuracion del visor en el archivo setup.js\n"
      );
    }
  }

  axios.defaults.baseURL = setup.mqttOptions.http;
  log("\n◌ Inicializando Logo...");
  await axios
    .post("/impresora/getLogo")
    .then((res) => {
      if (!res.data) {
        throw new Error("No hay logo");
      }
      log(" -> Logo cargado correctamente ✓");
    })
    .catch((e) => {
      log(
        " ⚠️  Error NO urgente: error al cargar el logo. Se imprimiran los tickets sin el logo (NO DEBERIA DEJAR DE FUNCIONAR)\n"
      );
    });

  if (setup.printerOptions.testPrinter) {
    log("\n◌ Inicializando TestPrinter...");
    testPrinter();
  }

  log("\n\n\n\n📌 Inicializacion finalizada   \n");
}

initializer();

function testPrinter() {
  if (setup.printerOptions.isUsbPrinter) {
    const imprimirUSB = (device) => {
      imprimir(
        [
          { tipo: "font", payload: "a" },
          { tipo: "align", payload: "ct" },
          { tipo: "setCharacterCodeTable", payload: 19 },
          { tipo: "encode", payload: "cp858" },
          { tipo: "style", payload: "bu" },
          { tipo: "size", payload: [1, 1] },
          { tipo: "text", payload: "Impresora USB conectada" },
          { tipo: "cut", payload: "" },
        ],
        device,
        { imprimirLogo: false }
      );
    };

    if (setup.printerOptions.useVidPid) {
      const device = new escpos.USB(
        setup.printerOptions.vId,
        setup.printerOptions.pId
      );
      imprimirUSB(device);
    } else {
      const devices = escpos.USB.findPrinter();
      devices.forEach((el) => {
        const device = new escpos.USB(el);
        imprimirUSB(device);
      });
    }
  } else {
    const serialDevice = new escpos.Serial(setup.printerOptions.port, {
      baudRate: setup.printerOptions.rate,
    });
    imprimir(
      [
        { tipo: "font", payload: "a" },
        { tipo: "align", payload: "ct" },
        { tipo: "setCharacterCodeTable", payload: 19 },
        { tipo: "encode", payload: "cp858" },
        { tipo: "style", payload: "bu" },
        { tipo: "size", payload: [1, 1] },
        { tipo: "text", payload: "Impresora serie conectada" },
        { tipo: "cut", payload: "" },
      ],
      serialDevice,
      { imprimirLogo: false }
    );
  }
  log(" -> TestPrinter finalizado ✓");
}

if (serialBalanca)
  serialBalanca.on("open", function () {
    serialBalanca.on("data", function (data) {
      readData = data.toString();
      for (var i = 1; i < readData.length; i++)
        if (readData.charCodeAt(i) == 13) {
          var pes = readData.substring(0, i);
          if (pes != "0000000") {
            lastPesEstable = lastPes;
            lastPes = pes;
            if (lastPesEstable == lastPes) {
              if (!avisat) {
                mqttClient.publish("hit/hardware/pes", lastPesEstable);
              }
              avisat = true;
            } else {
              avisat = false;
            }
            lastPesEstable = lastPes;
          }
        } else {
          lastPesEstable = "";
        }
    });
  });

var impresion = {};
function exists(portName) {
  return SerialPort.list().then((res) => {
    return res.some((port) => port.path === portName);
  });
}

async function getVisor() {
  try {
    return await exists(setup.visorOptions.portVisor).then((res) => {
      if (res)
        serialVisor = new SerialPort(setup.visorOptions.portVisor, {
          baudRate: setup.visorOptions.rateVisor,
        });
      return serialVisor;
    });
  } catch (e) {
    log(e);
    return undefined;
  }
}

function imprimir(imprimirArray = [], device, options) {
  const printer = new escpos.Printer(device);
  let size = [0, 0];
  let qr = undefined;
  device.open(async function () {
    printer
      .model("TP809")
      .font("A")
      .setCharacterCodeTable(19)
      .encode("cp858")
      .align("ct");
      
    if (setup.printerOptions.imprimirLogo && options?.imprimirLogo) {
      try {
        await printer.image(impresion.logo);
      } catch (error) {
        setup.printerOptions.imprimirLogo = false;
        options.imprimirLogo = false;
        console.log(error)
      }
    }

    imprimirArray.forEach((linea) => {
      if (linea.tipo != "cut") {
        if (linea.tipo == "qrimage") {
          qr = linea;
        } else if (linea.tipo == "size") {
          if (Array.isArray(linea.payload)) {
            size = linea.payload;
          }
        } else {
          if (typeof linea.payload != "object")
            printer.size(size[0], size[1])[linea.tipo](linea.payload);
          else printer.size(size[0], size[1])[linea.tipo](...linea.payload);
        }
      } else if (!qr) printer.cut();
    });

    if (qr)
      printer.qrimage(
        qr.payload,
        { type: "png", mode: "dhdw", size: 2 },
        function (err) {
          this.cut();
          this.close();
        }
      );
    else printer.close();
  });
}

function ImpresoraUSB(msg, options) {
  if (setup.printerOptions.useVidPid) {
    let device = new escpos.USB(
      setup.printerOptions.vId,
      setup.printerOptions.pId
    );
    imprimir(msg, device, options);
  } else {
    var devices = escpos.USB.findPrinter();
    devices.forEach(function (el) {
      const device = new escpos.USB(el);
      imprimir(msg, device, options);
    });
  }
}

function ImpresoraSerial(msg, options) {
  const serialDevice = new escpos.Serial(setup.printerOptions.port, {
    baudRate: setup.printerOptions.rate,
  });
  imprimir(msg, serialDevice, options);
}

function Visor(msg) {
  if (!serialVisor) return;
  serialVisor.write(msg);
}

function x() {
  process.exit();
}

mqttClient.on("message", async function (topic, message) {
  try {
    if (topic == "hit.hardware/getSetup")
      return mqttClient.publish(
        setup.mqttOptions.LogTin,
        JSON.stringify(setup)
      );
    if (topic == "hit.hardware/sendSetup") {
      let msg = Buffer.from(message, "binary")
        .toString("utf8")
        .split("'")
        .join('"');
      log(msg);
      fs.writeFile(dir + "/setup.json", msg, function (err) {
        if (err) return log(err);
        mqttClient.publish(
          setup.mqttOptions.LogTin,
          "Setup updated to:\n" +
            JSON.stringify(Buffer.from(message, "binary").toString("utf8"))
        );
        log("Archivo guardado correctamente");
        x();
      });
    }
    let mensaje = Buffer.from(message, "binary").toString("utf8");
    if (mensaje != "")
      if (topic != "hit.hardware/visor") mensaje = JSON.parse(mensaje);
    if (topic == "hit.hardware/printer") {
      let { arrayImprimir, options } = mensaje;
      if (setup.printerOptions.isUsbPrinter) {
        ImpresoraUSB(arrayImprimir, options);
        return;
      }
      ImpresoraSerial(arrayImprimir, options);
    } else if (topic == "hit.hardware/visor") {
      Visor(mensaje);
    } else if (topic == "hit.hardware/cajon") {
      options.abrirCajon = true;
      setup.printerOptions.isUsbPrinter
        ? ImpresoraUSB(arrayImprimir, options)
        : ImpresoraSerial(arrayImprimir, options);
    } else if (topic == "hit.hardware/logo") {
      const buffer = Buffer.from(mensaje.logo, "hex");
      await Jimp.read(buffer)
        .then(async (fotico) => {
          const fotico2 = await fotico.getBufferAsync(Jimp.MIME_PNG);
          escpos.Image.load(fotico2, Jimp.MIME_PNG, function (image) {
            impresion.logo = image;
            setup.printerOptions.imprimirLogo = true;
          });
        })
        .catch((e) => {
          impresion.logo = null;
          setup.printerOptions.imprimirLogo = false;
        });
    }
  } catch (e) {
    log("Error en MQTT: \n" + e);
  }
});
