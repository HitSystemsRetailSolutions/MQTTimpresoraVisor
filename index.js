const SerialPort = require("serialport");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");
const MQTT = require("mqtt");
const ReadLineItf = require("readline").createInterface;
const setup = require("./setup");
const mqttClient = MQTT.connect(setup.mqtt);
const axios = require("axios");
let serialReaderVisor = undefined;
let serialVisor = undefined;
escpos.Serial = require("escpos-serialport");
var impresion = {};
const Jimp = require("jimp");

if (setup.visor) {
  try {
    serialVisor = new SerialPort(setup.portVisor, {
      baudRate: setup.rateVisor,
    });
    serialReaderVisor = ReadLineItf({ serialVisor });
    serialReaderVisor.on("line", function (value) {
      console.log("out --> [" + value + "]");
      mqttClient.publish(setup.tout, value, { qos: setup.qos }); // MQTT pub
    });
  } catch (err) {
    console.log("Error al cargar el visor serie");
  }
}

if (setup.testUsbImpresora) {
  var devices = escpos.USB.findPrinter();
  if (setup.useVidPid) {
    let device = new escpos.USB(setup.vId, setup.pId);
    const printer = new escpos.Printer(device);
    device.open(function () {
      printer
        .font("a")
        .align("ct")
        .setCharacterCodeTable(19)
        .encode("cp858")
        .style("bu")
        .size(1, 1)
        .text("Impresora USB conectada -> áàèéíìòóùúñÑ €")
        .cut()
        .close();
    });
  } else {
    devices.forEach(function (el) {
      let device = new escpos.USB(el);
      const printer = new escpos.Printer(device);
      device.open(function () {
        printer
          .font("a")
          .align("ct")
          .style("bu")
          .size(1, 1)
          .text("Impresora USB conectada")
          .cut()
          .close();
      });
    });
  }
}

// MQTT subscriber (MQTT --> serial)
mqttClient.on("connect", function () {
  mqttClient.subscribe(setup.tin); // MQTT sub
  mqttClient.subscribe(setup.tinVisor); // MQTT sub
  mqttClient.subscribe("hit.hardware/logo");
});
axios.defaults.baseURL = setup.http;

axios
  .post("/impresora/getLogo")
  .then((res) => {
    if (!res.data) {
      throw new Error("No hay logo");
    }
  })
  .catch(() => {
    console.log(
      "error al cargar el logo. Se imprimiran los tickets sin el logo"
    );
  });

// funcion que recibe el mensaje y lo imprime

function imprimir(imprimirArray = [], device, options) {
  const printer = new escpos.Printer(device);
  let size = [0, 0];
  // cargamos el logo
  // abrimos el dispositivo
  device.open(async function () {
    // configuraciones iniciales de la impresora
    printer
      .model("TP809")
      .font("A")
      .setCharacterCodeTable(19)
      .encode("cp858")
      .align("ct");
    // si tenemos que imprimir el logo, lo imprimimos
    if (setup.imprimirLogo && options?.imprimirLogo) {
      printer.image(impresion.logo).then(() => {
        imprimirArray.forEach((linea) => {
          // si la linea es para cambiar el tamaño, lo cambiamos
          if (linea.tipo == "size") {
            size = linea.payload;
          } else {
            // si no, imprimimos la linea del tipo que sea con su contenido.
            if (typeof linea.payload != "object")
              printer.size(size[0], size[1])[linea.tipo](linea.payload);
            else printer.size(size[0], size[1])[linea.tipo](...linea.payload);
          }
        });
        printer.close();
      });
    } else {
      // recorremos el array de impresion
      imprimirArray.forEach((linea) => {
        // si la linea es para cambiar el tamaño, lo cambiamos
        if (linea.tipo == "size") {
          size = linea.payload;
        } else {
          // si no, imprimimos la linea del tipo que sea con su contenido.
          if (typeof linea.payload != "object")
            printer.size(size[0], size[1])[linea.tipo](linea.payload);
          else printer.size(size[0], size[1])[linea.tipo](...linea.payload);
        }
      });
      printer.close();
    }
  });
}
// si la impresora es usb
function ImpresoraUSB(msg, options) {
  if (setup.useVidPid) {
    let device = new escpos.USB(setup.vId, setup.pId);
    imprimir(msg, device, options);
  } else {
    var devices = escpos.USB.findPrinter();
    devices.forEach(function (el) {
      const device = new escpos.USB(el);
      imprimir(msg, device, options);
    });
  }
}

function ImpresoraSerial(msg) {
  const serialDevice = new escpos.Serial(setup.port, {
    baudRate: setup.rate,
  });
  imprimir(msg, serialDevice);
}

function Visor(msg) {
  serialVisor.write(msg);
}

mqttClient.on("message", async function (topic, message) {
  try {
    if (topic == "hit.hardware/printer") {
      const mensaje = JSON.parse(
        Buffer.from(message, "binary").toString("utf8")
      );
      let { arrayImprimir, options } = mensaje;
      if (setup.isUsbPrinter) {
        ImpresoraUSB(arrayImprimir, options);
        return;
      }
      ImpresoraSerial(arrayImprimir, options);
    } else if (topic == "hit.hardware/visor") {
      Visor(mensaje);
    } else if (topic == "hit.hardware/cajon") {
      options.abrirCajon = true;
      setup.isUsbPrinter
        ? ImpresoraUSB(arrayImprimir, options)
        : ImpresoraSerial(arrayImprimir, options);
    } else if (topic == "hit.hardware/logo") {
      const mensaje = JSON.parse(
        Buffer.from(message, "binary").toString("utf8")
      );
      const buffer = Buffer.from(mensaje.logo, "hex");

      await Jimp.read(buffer)
        .then(async (fotico) => {
          // despues de casi morir, me di cuenta de que el logo se puede pasar como un buffer por la funcion de escpos
          // pero como los tios no tienen casi documentacion me he tenido que leer el codigo fuente de la libreria para enterarme
          /* Yasai :D  👍 */
          const fotico2 = await fotico.getBufferAsync(Jimp.MIME_PNG);
          escpos.Image.load(fotico2, Jimp.MIME_PNG, function (image) {
            impresion.logo = image;
            setup.imprimirLogo = true;
            console.log("logo cargado!");
          });
        })
        .catch((e) => {
          console.log("Error al cargar el logo: \n" + e);
          impresion.logo = null;
          setup.imprimirLogo = false;
        });
    }
  } catch (e) {
    console.log("Error en MQTT: \n" + e);
  }
});

console.log("MQTT CONNECTED");
