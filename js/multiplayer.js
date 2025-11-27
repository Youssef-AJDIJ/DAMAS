// js/multiplayer.js

export class MultiplayerManager {
  constructor(onMoveReceived, onGameStart, onPlayerDisconnect) {
    this.peer = null;
    this.conn = null; // Data connection
    this.call = null; // Media connection
    this.localStream = null;
    this.remoteStream = null;

    this.onMoveReceived = onMoveReceived;
    this.onGameStart = onGameStart;
    this.onPlayerDisconnect = onPlayerDisconnect;

    this.isHost = false;
    this.myId = null;
    this.opponentId = null;
  }

  async initialize(localVideoElement, remoteVideoElement) {
    // Generate a random 6-digit code
    const shortId = Math.floor(100000 + Math.random() * 900000).toString();
    const prefix = "damas-game-v1-";
    const fullId = prefix + shortId;

    // Initialize PeerJS with custom ID
    this.peer = new Peer(fullId, {
      debug: 2,
    });

    this.localVideoEl = localVideoElement;
    this.remoteVideoEl = remoteVideoElement;

    // Get local camera stream
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (this.localVideoEl) {
        this.localVideoEl.srcObject = this.localStream;
        this.localVideoEl.muted = true; // Mute local video to avoid feedback
      }
    } catch (err) {
      console.error("Failed to get local stream", err);
      alert(
        "No se pudo acceder a la cámara/micrófono. La videollamada no funcionará."
      );
    }

    return new Promise((resolve, reject) => {
      this.peer.on("open", (id) => {
        this.myId = id;
        console.log("My Peer ID is: " + id);
        // Return only the short code to the UI
        resolve(shortId);
      });

      this.peer.on("connection", (conn) => {
        this.handleDataConnection(conn);
      });

      this.peer.on("call", (call) => {
        this.handleCall(call);
      });

      this.peer.on("error", (err) => {
        console.error(err);
        // If ID is taken (unlikely with 6 digits + prefix), we could retry,
        // but for now just reject or let the user try again.
        if (err.type === "unavailable-id") {
          alert(
            "Error: El código generado ya está en uso. Por favor, recarga la página."
          );
        }
        reject(err);
      });
    });
  }

  createRoom() {
    this.isHost = true;
    // Return the short ID (remove prefix)
    return this.myId.replace("damas-game-v1-", "");
  }

  joinRoom(shortId) {
    this.isHost = false;
    const prefix = "damas-game-v1-";
    const fullId = prefix + shortId;
    this.opponentId = fullId;

    // Connect data
    const conn = this.peer.connect(fullId);
    this.handleDataConnection(conn);

    // Connect video
    if (this.localStream) {
      const call = this.peer.call(fullId, this.localStream);
      this.handleCall(call);
    }
  }

  handleDataConnection(conn) {
    this.conn = conn;

    this.conn.on("open", () => {
      console.log("Data connection established");
      // If we are host, we start the game (Host is Red, Joiner is Black)
      if (this.isHost) {
        this.onGameStart({
          color: "red", // Host is red
          opponentName: "Oponente",
        });
        // Tell opponent they are black
        this.conn.send({
          type: "START_GAME",
          color: "black",
        });
      }
    });

    this.conn.on("data", (data) => {
      console.log("Received data", data);

      if (data.type === "MOVE") {
        this.onMoveReceived(data.move);
      } else if (data.type === "START_GAME") {
        this.onGameStart({
          color: data.color,
          opponentName: "Anfitrión",
        });
      }
    });

    this.conn.on("close", () => {
      this.onPlayerDisconnect();
    });
  }

  handleCall(call) {
    this.call = call;

    // Answer incoming call if we haven't initiated it (or just always answer)
    if (this.localStream) {
      call.answer(this.localStream);
    }

    call.on("stream", (remoteStream) => {
      this.remoteStream = remoteStream;
      if (this.remoteVideoEl) {
        this.remoteVideoEl.srcObject = remoteStream;
      }
    });
  }

  sendMove(move) {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: "MOVE",
        move: move,
      });
    }
  }

  disconnect() {
    if (this.call) this.call.close();
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
  }
}
