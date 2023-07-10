const express = require("express");

class Server {
  // iniciamos el servidor, con su puerto
  constructor() {
    this.app = express();
    this.port = 42069;

    // Middlewares (parseo del body)
    this.middlewares();
    // rutas (solo hay imprimir)
    this.routes();
  }

  // Middlewares (parseo del body)
  middlewares() {
    this.app.use(express.json());
  }
  // rutas (solo hay imprimir)
  routes() {
    this.app.use("/imprimir", require("../routes/imprimir"));
  }
  
  // escucha el puerto
  listen() {
    this.app.listen(this.port, () => {
      // console log con el emoji de un cohete
      console.log(`Servidor escuchando ${this.port} 🚀`);
    });
  }
}

module.exports = Server;
