
const SerialPort = require("serialport");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");
const MQTT = require("mqtt");
const ReadLineItf = require("readline").createInterface;
const setup = require("./setup");
const mqttClient = MQTT.connect(setup.mqtt);
let serialReader = undefined;
let serialReaderVisor = undefined;
let serialVisor = undefined;
let serial = undefined;

if (setup.isUsbPrinter) {
  try {
    serial = new SerialPort(setup.port, { baudRate: setup.rate });
    serialReader = ReadLineItf({
      input: serial,
    });
    serialReader.on("line", function (value) {
      console.log("out --> [" + value + "]");
      mqttClient.publish(setup.tout, value, { qos: setup.qos }); // MQTT pub
    });
  } catch (err) {
    console.log("Error al cargar la impresora serie");
  }
}

try {
  serialVisor = new SerialPort(setup.portVisor, { baudRate: setup.rateVisor });
  serialReaderVisor = ReadLineItf({ serialVisor });
  serialReaderVisor.on("line", function (value) {
    console.log("out --> [" + value + "]");
    mqttClient.publish(setup.tout, value, { qos: setup.qos }); // MQTT pub
  });
} catch (err) {
  console.log("Error al cargar el visor serie");
}

if (setup.testUsbImpresora) {
  var devices = escpos.USB.findPrinter();
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

// MQTT subscriber (MQTT --> serial)
mqttClient.on("connect", function () {
  mqttClient.subscribe(setup.tin); // MQTT sub
  mqttClient.subscribe(setup.tinVisor); // MQTT sub
});

function ImpresoraUSB(msg) {
  var devices = escpos.USB.findPrinter();

  devices.forEach(function (el) {
    let device = new escpos.USB(el);
    const printer = new escpos.Printer(device);
    device.open(function () {
      printer.encode("CP858").pureText(Buffer.from(msg, 'hex')).close();
    });
  });
}

function ImpresoraSerial(msg) {
  serial.write(msg);
}

function Visor(msg) {
  serialVisor.write(msg);
}

mqttClient.on("message", function (topic, message) {
  try {
    if (setup.ShowMessageLog) console.log(message);
    if (topic == "hit.hardware/printer") {
      if (setup.isUsbPrinter) {
        ImpresoraUSB(message);
        return;
      }
      ImpresoraSerial(message);
    } else if (topic == "hit.hardware/visor") {
      Visor(message);
    }
  } catch (e) {
    console.log("Error en MQTT: \n" + e);
  }
});

console.log("MQTT CONNECTED");
