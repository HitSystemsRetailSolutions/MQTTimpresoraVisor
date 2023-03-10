const SerialPort = require('serialport');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
const MQTT = require('mqtt');
const ReadLineItf = require('readline').createInterface;
const setup = require('./setup');
const mqttClient = MQTT.connect(setup.mqtt);
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
    serialReaderVisor = ReadLineItf        input: serialVisor
    });
}catch(err){
    console.log("Error al cargar el visor serie")
}
*/
var devices = escpos.USB.findPrinter();

devices.forEach(function(el) { 
    let device = new escpos.USB(el)
    const printer = new escpos.Printer(device);
    device.open(function(){
        printer
        .font('a')
        .align('ct')
        .style('bu')
        .size(1, 1)
        .text('The quick brown fox jumps over the lazy dog')
        .cut()
        .close()
    });
})

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
    console.log("entro");
    //serial.write(value);
var devices = escpos.USB.findPrinter();

devices.forEach(function(el) { 
    let device = new escpos.USB(el)
    const printer = new escpos.Printer(device);
    device.open(function(){
        printer
        .pureText(Buffer.from(msg,'hex')).close();
    });
})
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
