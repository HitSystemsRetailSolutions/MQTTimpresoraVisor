
const SerialPort = require("serialport");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");
escpos.Serial = require("escpos-serialport")
const MQTT = require("mqtt");
const ReadLineItf = require("readline").createInterface;
const setup = require("./setup");
const mqttClient = MQTT.connect(setup.mqtt);
let impresoraSerialReader = undefined;
let serialReaderVisor = undefined;
let serialVisor = undefined;
let impresoraSerial = undefined;

if (!setup.isUsbPrinter) {
  try {
    impresoraSerial = new escpos.Serial(setup.port, { baudRate: setup.rate });
    impresoraSerialReader = ReadLineItf({
      input: serial,
    });
    impresoraSerialReader.on("line", function (value) {
      console.log("out --> [" + value + "]");
      mqttClient.publish(setup.tout, value, { qos: setup.qos }); // MQTT pub
    });
  } catch (err) {
    console.log("Error al cargar la impresora serie");
  }
}

if (setup.visor) {
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
      printer
      .setCharacterCodeTable(19)
      .encode("CP858")
      .pureText(msg)
      .close();
    });
  });
}

function ImpresoraSerial(msg) {
  impresoraSerial.write(msg);
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
