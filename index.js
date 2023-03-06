const SerialPort = require('serialport');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
const MQTT = require('mqtt');
const ReadLineItf = require('readline').createInterface;
const usbDetect = require('usb-detection');
const setup = require('./setup');
const mqttClient = MQTT.connect(setup.mqtt);
usbDetect.startMonitoring();
let USBdevice = undefined
let serialReader = undefined
let serialReaderVisor = undefined
let serialVisor = undefined
let serial = undefined
/*
try{
    serial = new SerialPort(setup.port, {baudRate: setup.rate});
    serialReader = ReadLineItf({
        input: serial
    });
}catch(err){
    console.log("Error al cargar la impresora serie")
}

try{
    serialVisor = new SerialPort(setup.portVisor, {baudRate: setup.rateVisor});
    serialReaderVisor = ReadLineItf({
        input: serialVisor
    });
}catch(err){
    console.log("Error al cargar el visor serie")
}
*/
function SetUSBConection(USBInfo){
    console.log(USBInfo)
    USBdevice = new escpos.USB(USBInfo.vendorId, USBInfo.productId);    
}
try{
    usbDetect.find(function(err, devices) { 
        devices.forEach(element => {
            if(element.manufacturer == "HPRT")
            SetUSBConection(element); 
        });
    }); 
}catch(err){
    console.log("Error al cargar la impresora usb")
}

console.log("MQTT CONNECTED")
/*
serialReader.on('line', function (value) {
    console.log('out --> [' + value + ']');
    mqttClient.publish(setup.tout, value, {qos: setup.qos}); // MQTT pub
});
serialReaderVisor.on('line', function (value) {
    console.log('out --> [' + value + ']');
    mqttClient.publish(setup.tout, value, {qos: setup.qos}); // MQTT pub
});

*/
// MQTT subscriber (MQTT --> serial)
mqttClient.on('connect', function () {
    mqttClient.subscribe(setup.tin); // MQTT sub
    mqttClient.subscribe(setup.tinVisor); // MQTT sub
});

function Impresora(msg){
    let value = msg
    console.log('[' + value + '] --> in');
    //serial.write(value);
    const options = {encoding: 'GB18030'};
    const printer = new escpos.Printer(USBdevice, options);
    USBdevice.write(msg)
    USBdevice.open(function() {
        printer.model(msg)
      });
}

function Visor(msg){
    console.log('[' + msg + '] --> in');
    serialVisor.write(msg);
}

mqttClient.on('message', function (topic, message) {
    if(topic == "hit.hardware/printer"){
      console.log("si")  
      Impresora(message);
    }else if (topic == "hit.hardware/visor"){
        Visor(message);
    }

});
// -------
