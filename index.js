const SerialPort = require("serialport");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");
const MQTT = require("mqtt");
const ReadLineItf = require("readline").createInterface;
const setup = require("./setup");
const mqttClient = MQTT.connect(setup.mqtt);
let serialReaderVisor = undefined;
let serialVisor = undefined;
escpos.Serial = require('escpos-serialport');

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
        .style("bu")
        .size(1, 1)
        .text("Impresora USB conectada")
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
});
// funciopn que recibe el mensaje y lo imprime
function imprimir(msg, device, options) {
  const logo = setup.logo;
  const encode = "cp858"
  const printer = new escpos.Printer(device);
  if(options && options.abrirCajon){
    device.open(function () {
      printer
        .pureText(msg)
        .close();
    });
  }
  escpos.Image.load(logo, function (image) {

      device.open(function () {
        printer
          .model("TP809")
          .font("A")
          .setCharacterCodeTable(19)
          .encode(encode)
          .align("ct")
          if(setup.imprimirLogo){
            printer.raster(image)
          }
          printer.text(msg)
          .cut("PAPER_FULL_CUT")
          .close();
      });
  });
}
// si la impresora es usb
function ImpresoraUSB(msg, options) {
  if (setup.useVidPid) {
    const device = new escpos.USB(setup.vId, setup.pId);
    imprimir(msg, device);
  } else {
    const devices = escpos.USB.findPrinter();
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

mqttClient.on("message", function (topic, message) {
  try {
    if (setup.ShowMessageLog) console.log(message);
    if (topic == "hit.hardware/printer") {
      setup.isUsbPrinter
        ? ImpresoraUSB(message)
        : ImpresoraSerial(message)
    } else if (topic == "hit.hardware/visor") {
      Visor(message);
    } else if (topic == "hit.hardware/cajon"){
      setup.isUsbPrinter
      ? ImpresoraUSB(message, {abrirCajon: true})
      : ImpresoraSerial(message, {abrirCajon: true})
    }
  } catch (e) {
    console.log("Error en MQTT: \n" + e);
  }
});

console.log("MQTT CONNECTED");
