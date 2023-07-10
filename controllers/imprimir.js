const escpos = require("escpos");
escpos.USB = require("escpos-usb");
escpos.Serial = require("escpos-serialport");
const SerialPort = require("serialport");

const setup = require("../setup");

function imprimir(imprimirArray = [], device) {
  // recojemos el logo, creamos la impresora a partir del dispositivo y iniciamos el tamaño
  const logo = setup.logo;
  const printer = new escpos.Printer(device);
  let size = [0, 0];
  // cargamos el logo
  escpos.Image.load(logo, function (image) {
    // abrimos el dispositivo
    device.open(function () {
      // configuraciones iniciales de la impresora
      printer
        .model("TP809")
        .font("A")
        .setCharacterCodeTable(19)
        .encode("cp858")
        .align("ct");
      // si tenemos que imprimir el logo, lo imprimimos
      if (setup.imprimirLogo) {
        printer.raster(image);
      }
      // recorremos el array de impresion
      imprimirArray.forEach((linea) => {
        // si la linea es para cambiar el tamaño, lo cambiamos
        if (linea.tipo == "size") {
          size = linea.payload;
        } else {
          // si no, imprimimos la linea. Abajo de la funcion explico porque lo hago asi *1
          printer.size(size[0], size[1])[linea.tipo](linea.payload);
        }
      });
      printer.close();
    });
  });
}
// ===============================================
// *1: A la hora de especificar el tamaño normalmente pondrias algo tipo: 
// printer.size(1,1)
// .text("texto")
// pero al estar recorriendo el array no podemos hacerlo asi, ya que tendriamos que estar llamando a la impresora todo el rato con:
// printer.size(1,1)
// printer.text("texto")
// La solucion que he encontrado es guardar un array con el tamaño y declarar el tamaño en cada linea. A efectos practicos,
// es lo mismo que mantener el size de antes con
// printer.size(1,1)
// .text("texto1")
// .text("texto2")
// que con
// printer.size(1,1).text("texto1")
// printer.size(1,1).text("texto2")
// ===============================================

// segun el tipo de impresora, crea el dispositivo de una manera o de otra
const imprimirPost = (req, res) => {
  const { imprimirArray } = req.body;
  // si la impresora es usb
  if (setup.isUsbPrinter) {
    // si tenemos el puerto exacto
    if (setup.useVidPid) {
      const device = new escpos.USB(setup.vId, setup.pId);
      // imprimimos
      imprimir(imprimirArray, device);
    } else {
      // si no lo tenemos, buscamos
      var devices = escpos.USB.findPrinter();
      devices.forEach(function (el) {
        const device = new escpos.USB(el);
        // imprimimos
        imprimir(imprimirArray, device);
      });
    }
  } else {
    // si la impresora es serial creamos el dispositivo con el puerto del setup
    const device = new escpos.Serial(setup.port, {
      baudRate: setup.rate,
    });
    // imprimimos
    imprimir(imprimirArray, device);
  }
};

module.exports = { imprimirPost };
