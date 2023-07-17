// imports de modulos de terceros
const SerialPort = require("serialport");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");
const MQTT = require("mqtt");
const ReadLineItf = require("readline").createInterface;
const Jimp = require("jimp");
const fs = require("fs");
const axios = require("axios");
escpos.Serial = require("escpos-serialport");
// cargamos la configuracion
const setup = require("./setup");
// iniciamos variables necesarias
const mqttClient = MQTT.connect(setup.mqtt);
let serialReaderVisor = undefined;
let serialVisor = undefined;
var impresion = {};

// visor serie
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
// test de la impresora USB
if (setup.testUsbImpresora) {
  var devices = escpos.USB.findPrinter();
  // si tenemos que usar el puerto manualmente establecido
  if (setup.useVidPid) {
    let device = new escpos.USB(setup.vId, setup.pId);
    const printer = new escpos.Printer(device);
    // probamos la impresion con los caracteres especiales incluidos
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
    // si no, buscamos la impresora
    devices.forEach(function (el) {
      let device = new escpos.USB(el);
      const printer = new escpos.Printer(device);
      // probamos la impresion con los caracteres especiales incluidos
      device.open(function () {
        printer
          .font("a")
          .align("ct")
          .style("bu")
          .size(1, 1)
          .text("Impresora USB conectada -> áàèéíìòóùúñÑ €")
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
// pedimos el logo por si nos encendemos despues del backend
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
// funcion que resetea el archivo que guarda cuanto papel queda
const resetRest = () => {
  fs.writeFileSync("rest.txt", "450");
};
// funcion que devuelve cuanto papel queda
const getRest = () => {
  return Number(fs.readFileSync("rest.txt", "utf8"));
};
// funcion que resta en el archivo
const restarRest = (cantidad) => {
  let rest = getRest();
  rest = rest - cantidad;
  fs.writeFileSync("rest.txt", rest.toString());
};

const calcularResta = (options) => {
  const logo = options.imprimirLogo && setup?.imprimirLogo ? 2.5 : 0;
  // recogemos las opciones y restamos el papel que se gasta (aproximado)
  switch (options.tipo) {
    case "venta":
      restarRest(14 + options.lExtra - 1 + logo);
      break;
    case "encargo":
      restarRest(9 + options.lExtra - 1 + logo);
      break;
    case "salida":
    case "entrada":
      restarRest(7.2 + logo);
      break;
    case "cierreCaja":
      restarRest(18.8 + logo);
      break;
  }
};

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
  // TODO: guardar el estado del papel a parte
  resetRest();
  calcularResta(options);
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
// si la impresora es serial
function ImpresoraSerial(msg) {
  const serialDevice = new escpos.Serial(setup.port, {
    baudRate: setup.rate,
  });
  imprimir(msg, serialDevice);
}
// mensajes para el visor
function Visor(msg) {
  serialVisor.write(msg);
}
// manejamos los mensajes mqtt
mqttClient.on("message", async function (topic, message) {
  try {
    // si tenemos que imprimir
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
      // si tenemos que mostrar algo por el visor
    } else if (topic == "hit.hardware/visor") {
      Visor(mensaje);
      // si tenemos que abrir el cajon
    } else if (topic == "hit.hardware/cajon") {
      options.abrirCajon = true;
      setup.isUsbPrinter
        ? ImpresoraUSB(arrayImprimir, options)
        : ImpresoraSerial(arrayImprimir, options);
      // si tenemos que cargar el logo al programa
    } else if (topic == "hit.hardware/logo") {
      // recibimos el buffer del logo en hex y lo pasamos a binario
      const mensaje = JSON.parse(
        Buffer.from(message, "binary").toString("utf8")
      );
      const buffer = Buffer.from(mensaje.logo, "hex");
      // lo cargamos con jimp para pasarlo a png siempre (de esta forma podemos imprimir mas extensiones)
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
