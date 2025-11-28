// js/multiplayer.js

export class MultiplayerManager {
  constructor(onMoveReceived, onGameStart, onPlayerDisconnect) {
    this.peer = null;
    this.conn = null; // Data connection (PeerJS DataConnection)
    this.call = null; // Media connection (PeerJS MediaConnection)
    this.localStream = null;
    this.remoteStream = null;

    this.onMoveReceived = onMoveReceived;
    this.onGameStart = onGameStart;
    this.onPlayerDisconnect = onPlayerDisconnect;

    this.isHost = false;
    this.myId = null;
    this.opponentId = null;

    // Keepalive & reconnect
    this._pingInterval = null;
    this._lastPongAt = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 3;
  }

  /**
   * Inicializa PeerJS, solicita cámara y devuelve la parte corta del ID (shortId).
   * localVideoElement y remoteVideoElement son HTMLVideoElement opcionales.
   */
  async initialize(localVideoElement, remoteVideoElement) {
    // Generar código corto
    const shortId = Math.floor(100000 + Math.random() * 900000).toString();
    const prefix = "damas-game-v1-";
    const fullId = prefix + shortId;

    // Config ICE: STUN + TURN (ejemplo Metered TURN demo)
    // Si usas tu propio TURN, reemplaza las credenciales por las tuyas.
    const peerOptions = {
      debug: 2,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: "openai",
            credential: "openai123"
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "openai",
            credential: "openai123"
          },
          {
            urls: "turn:global.relay.metered.ca:443?transport=tcp",
            username: "openai",
            credential: "openai123"
          }
        ]
      }
    };

    // Crear Peer con el ID personalizado
    this.peer = new Peer(fullId, peerOptions);

    this.localVideoEl = localVideoElement || null;
    this.remoteVideoEl = remoteVideoElement || null;

    // Obtener stream local (cam + mic)
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (this.localVideoEl) {
        this.localVideoEl.srcObject = this.localStream;
        this.localVideoEl.muted = true;
        this.localVideoEl.play().catch(() => {});
      }
    } catch (err) {
      console.warn("No se pudo obtener la cámara/micrófono:", err);
      // No abortamos; la jugabilidad de datos sigue funcionando sin media.
      this.localStream = null;
    }

    // Promesa que resuelve cuando peer abre
    return new Promise((resolve, reject) => {
      const onOpen = (id) => {
        this.myId = id;
        console.log("Peer open, ID:", id);

        // listeners generales
        this.peer.on("connection", (conn) => {
          this.handleDataConnection(conn);
        });

        this.peer.on("call", (call) => {
          this.handleCall(call);
        });

        this.peer.on("disconnected", () => {
          console.warn("Peer disconnected, intentando reconectar...");
          // intento de reconectar simple
          try {
            this.peer.reconnect();
          } catch (e) {
            console.warn("Reconnect fallo:", e);
          }
        });

        this.peer.on("close", () => {
          console.log("Peer closed.");
        });

        this.peer.on("error", (err) => {
          console.error("Peer error:", err);
        });

        resolve(shortId);
      };

      // Si ya está abierto
      this.peer.on("open", onOpen);

      // Errores de inicialización
      this.peer.on("error", (err) => {
        console.error("Peer init error:", err);
        // Rechazar solo si es un error crítico
        if (err && err.type === "unavailable-id") {
          reject(err);
        }
        // para otros errores, dejamos que la app intente de nuevo manualmente
      });
    });
  }

  /**
   * Crea la sala (host). Devuelve el short code.
   * La promesa de initialize debe ya haberse resuelto.
   */
  createRoom() {
    this.isHost = true;
    if (!this.myId) {
      console.warn("createRoom: peer aún no inicializado/open.");
      return null;
    }
    // devolver solo el shortId sin prefijo
    return this.myId.replace("damas-game-v1-", "");
  }

  /**
   * Unirse a una sala usando el shortId (código de 6 dígitos).
   * Espera a que this.peer esté 'open' si todavía no lo está.
   */
  joinRoom(shortId) {
    this.isHost = false;
    const fullId = "damas-game-v1-" + shortId;
    this.opponentId = fullId;

    const connectNow = () => {
      try {
        // Conexión de datos
        const conn = this.peer.connect(fullId, {
          reliable: true
        });

        // Manejar data connection con retento si falla
        this.handleDataConnectionWithRetry(conn, fullId, 0);

        // Llamada de audio/video si tenemos stream local
        if (this.localStream) {
          const call = this.peer.call(fullId, this.localStream);
          this.handleCall(call);
        }
      } catch (err) {
        console.error("joinRoom error al conectar:", err);
      }
    };

    // Si peer todavía no tiene ID (no abierto), esperar 'open' una vez
    if (!this.peer || !this.myId) {
      this.peer.once("open", () => connectNow());
    } else {
      connectNow();
    }
  }

  /**
   * Wrapper que maneja reintentos simples al conectar data channel
   */
  handleDataConnectionWithRetry(conn, fullId, attempt) {
    conn.on("open", () => {
      this.handleDataConnection(conn);
    });

    conn.on("error", (err) => {
      console.warn("Data connection error:", err);
      if (attempt < 2) {
        console.log("Reintentando conexión de datos... intento:", attempt + 1);
        setTimeout(() => {
          const c = this.peer.connect(fullId, { reliable: true });
          this.handleDataConnectionWithRetry(c, fullId, attempt + 1);
        }, 800 * (attempt + 1));
      } else {
        console.error("No se pudo establecer data connection tras reintentos.");
      }
    });

    conn.on("close", () => {
      console.log("Data connection cerrada (retry wrapper).");
    });
  }

  /**
   * Configura la conexión de datos (PeerJS DataConnection)
   */
  handleDataConnection(conn) {
    // Si ya había una conexión de datos abierta, cerrarla y usar la nueva
    if (this.conn && this.conn.open) {
      try {
        this.conn.close();
      } catch (e) {}
    }
    this.conn = conn;

    const setupConn = () => {
      console.log("Data connection open (local):", this.conn.peer);

      // Si soy host y abrí la conexión al joiner, iniciar el juego
      if (this.isHost) {
        // enviar START_GAME al otro jugador
        try {
          this.conn.send({
            type: "START_GAME",
            color: "black" // el que se une es black
          });
        } catch (e) {
          console.warn("No se pudo enviar START_GAME:", e);
        }

        // además notificar localmente que el host arranca como red
        this.onGameStart({
          color: "red",
          opponentName: "Oponente"
        });
      }

      // iniciar keepalive ping/pong
      this._startPingPong();
    };

    // eventos
    this.conn.on("open", () => {
      setupConn();
    });

    this.conn.on("data", (data) => {
      // Soportar mensajes: MOVE, START_GAME, PING, PONG, CUSTOM
      if (!data || !data.type) return;

      if (data.type === "MOVE") {
        this.onMoveReceived && this.onMoveReceived(data.move);
      } else if (data.type === "START_GAME") {
        // recibir START_GAME: definimos color del jugador que recibe
        this.onGameStart && this.onGameStart({
          color: data.color,
          opponentName: data.opponentName || "Anfitrión"
        });
      } else if (data.type === "PING") {
        // responder PONG
        try {
          this.conn.send({ type: "PONG", ts: data.ts });
        } catch (e) {}
      } else if (data.type === "PONG") {
        this._lastPongAt = Date.now();
      } else {
        // otros mensajes
        // console.log("Data message:", data);
      }
    });

    this.conn.on("close", () => {
      console.log("Data connection closed.");
      this._stopPingPong();
      this.onPlayerDisconnect && this.onPlayerDisconnect();
    });

    this.conn.on("error", (err) => {
      console.error("Data connection error:", err);
      // intentar cerrar limpiamente
      try { this.conn.close(); } catch (e) {}
      this._stopPingPong();
    });
  }

  /**
   * Manejo de llamadas (MediaConnection).
   * Evita colisiones y responde solo si no hay llamada activa.
   */
  handleCall(call) {
    // Si ya tenemos una llamada activa, rechazamos la entrante para evitar colisiones.
    if (this.call && this.call.open) {
      try { call.close(); } catch (e) {}
      return;
    }

    this.call = call;

    // Responder con nuestro stream si está disponible
    if (this.localStream) {
      try {
        call.answer(this.localStream);
      } catch (e) {
        console.warn("Error al answer call:", e);
      }
    } else {
      // Si no tenemos media, aún aceptamos para recibir remote stream
      try {
        call.answer();
      } catch (e) {}
    }

    call.on("stream", (remoteStream) => {
      this.remoteStream = remoteStream;
      if (this.remoteVideoEl) {
        this.remoteVideoEl.srcObject = remoteStream;
        this.remoteVideoEl.play().catch(() => {});
      }
    });

    call.on("close", () => {
      console.log("Call closed.");
      this.call = null;
    });

    call.on("error", (err) => {
      console.warn("Call error:", err);
      try { call.close(); } catch (e) {}
      this.call = null;
    });
  }

  /**
   * Enviar movimiento por DataChannel.
   * move puede ser cualquier objeto serializable (por ejemplo: { from:{r,c}, to:{r,c}, capture:... })
   */
  sendMove(move) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send({
          type: "MOVE",
          move: move
        });
      } catch (e) {
        console.error("sendMove fallo:", e);
      }
    } else {
      console.warn("sendMove: no hay conexión abierta.");
    }
  }

  /**
   * Inicia un ping periódico para mantener la conexión y detectar fallos.
   */
  _startPingPong() {
    // limpiar previos
    this._stopPingPong();
    this._lastPongAt = Date.now();

    // enviar ping cada 5s
    this._pingInterval = setInterval(() => {
      if (!this.conn || !this.conn.open) {
        // si la conexión no está abierta, detenemos y notificamos
        console.warn("Ping: conexión no abierta.");
        clearInterval(this._pingInterval);
        this._pingInterval = null;
        this.onPlayerDisconnect && this.onPlayerDisconnect();
        return;
      }

      try {
        this.conn.send({ type: "PING", ts: Date.now() });
      } catch (e) {
        console.warn("Ping send error:", e);
      }

      // si no recibimos PONG en 12s consideramos desconexión
      if (Date.now() - this._lastPongAt > 12000) {
        console.warn("No se recibió PONG: posible desconexión.");
        // intentar cerrar y notificar
        try { this.conn.close(); } catch (e) {}
        this._stopPingPong();
        this.onPlayerDisconnect && this.onPlayerDisconnect();
      }
    }, 5000);
  }

  _stopPingPong() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  /**
   * Cierra todo y libera recursos.
   */
  disconnect() {
    // cerrar call
    if (this.call) {
      try { this.call.close(); } catch (e) {}
      this.call = null;
    }

    // cerrar data conn
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }

    // destruir peer
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    // parar local stream
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      this.localStream = null;
    }

    // limpiar ping
    this._stopPingPong();
  }
}