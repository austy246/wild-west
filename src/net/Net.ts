import Peer, { DataConnection } from 'peerjs';

/**
 * Peer-to-peer session for up to three players.
 *
 * The page is served as static files, so there is no server of ours to run a
 * lobby on. Instead everyone meets through PeerJS's public broker, which is
 * used only for the introduction — once two browsers know about each other the
 * game data travels directly between them.
 *
 * The topology is a star: clients connect to the host, and the host repeats
 * what it hears to the others. With three players that's cheap, and it means a
 * client only has to hold one connection open.
 *
 * The six-digit code the host reads out is its peer id, prefixed so we don't
 * collide with unrelated apps using the same public broker.
 */

const ID_PREFIX = 'wildwest-';
const MAX_PLAYERS = 3;
/** Give up on the broker after this long and let them play alone */
const CONNECT_TIMEOUT_MS = 12000;

export type NetRole = 'host' | 'client';

export interface PlayerState {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Riding something, so the model sits higher */
  mounted: boolean;
}

type Message =
  | { t: 'state'; s: PlayerState }
  | { t: 'roster'; ids: string[] }
  | { t: 'bye'; id: string }
  | { t: 'chat'; id: string; name: string; text: string }
  | { t: 'full' };

/** Colours so the three players can tell each other apart */
const PLAYER_COLORS = [0x2e7d32, 0x1565c0, 0x8e24aa];

export class Net {
  private peer: Peer | null = null;
  private conns = new Map<string, DataConnection>();

  role: NetRole = 'host';
  /** The six digits the host reads out */
  code = '';
  selfId = '';
  selfName = '';
  selfColor = PLAYER_COLORS[0];

  /** Everyone else, by peer id */
  readonly others = new Map<string, PlayerState>();

  onPeerJoined: ((id: string) => void) | null = null;
  onPeerLeft: ((id: string) => void) | null = null;
  onChat: ((name: string, text: string) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  get isConnected(): boolean {
    return this.peer !== null && !this.peer.destroyed;
  }

  get playerCount(): number {
    return this.others.size + 1;
  }

  /**
   * Open a session and return the six-digit code others type in.
   * Rejects with a human-readable reason if the broker can't be reached.
   */
  async host(name: string): Promise<string> {
    this.role = 'host';
    this.selfName = name;
    this.selfColor = PLAYER_COLORS[0];

    // Six digits, no leading zero, so it reads cleanly out loud
    this.code = String(Math.floor(100000 + Math.random() * 900000));
    this.selfId = ID_PREFIX + this.code;

    await this.openPeer(this.selfId);

    this.peer!.on('connection', (conn) => {
      if (this.conns.size + 1 >= MAX_PLAYERS) {
        // Room is full — tell them why rather than dropping silently
        conn.on('open', () => {
          conn.send({ t: 'full' } as Message);
          setTimeout(() => conn.close(), 400);
        });
        return;
      }
      this.acceptConnection(conn);
    });

    return this.code;
  }

  /** Join the session with the given six-digit code. */
  async join(code: string, name: string): Promise<void> {
    this.role = 'client';
    this.selfName = name;
    this.code = code;
    this.selfColor = PLAYER_COLORS[1 + Math.floor(Math.random() * (PLAYER_COLORS.length - 1))];

    // Clients get a broker-assigned id; only the host needs a memorable one
    await this.openPeer();

    const conn = this.peer!.connect(ID_PREFIX + code, { reliable: false });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Hostitel neodpovídá. Zkontroluj kód.')),
        CONNECT_TIMEOUT_MS
      );
      conn.on('open', () => { clearTimeout(timer); resolve(); });
      conn.on('error', () => { clearTimeout(timer); reject(new Error('Připojení selhalo.')); });
    });

    this.acceptConnection(conn);
  }

  /** Broadcast where we are. Called every frame or two — keep it small. */
  sendState(state: Omit<PlayerState, 'id' | 'name' | 'color'>): void {
    if (!this.isConnected) return;
    const msg: Message = {
      t: 'state',
      s: { ...state, id: this.selfId, name: this.selfName, color: this.selfColor },
    };
    this.broadcast(msg);
  }

  sendChat(text: string): void {
    if (!this.isConnected) return;
    this.broadcast({ t: 'chat', id: this.selfId, name: this.selfName, text });
  }

  /** Leave cleanly so the others don't wait on a ghost. */
  disconnect(): void {
    this.broadcast({ t: 'bye', id: this.selfId });
    for (const conn of this.conns.values()) conn.close();
    this.conns.clear();
    this.others.clear();
    this.peer?.destroy();
    this.peer = null;
  }

  // ---------------- internals ----------------

  private openPeer(id?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.peer = id ? new Peer(id) : new Peer();

      const timer = setTimeout(
        () => reject(new Error('Server pro spojení hráčů neodpovídá.')),
        CONNECT_TIMEOUT_MS
      );

      this.peer.on('open', (assigned) => {
        clearTimeout(timer);
        this.selfId = assigned;
        resolve();
      });

      this.peer.on('error', (err) => {
        clearTimeout(timer);
        const taken = String(err).includes('is taken');
        reject(new Error(taken ? 'Kód je obsazený, zkus to znovu.' : 'Spojení se nepodařilo.'));
      });

      this.peer.on('disconnected', () => {
        this.onError?.('Spojení se serverem se přerušilo.');
      });
    });
  }

  private acceptConnection(conn: DataConnection): void {
    const register = () => {
      this.conns.set(conn.peer, conn);
      this.onPeerJoined?.(conn.peer);
    };

    if (conn.open) register();
    else conn.on('open', register);

    conn.on('data', (raw) => this.handle(raw as Message, conn));

    conn.on('close', () => this.dropPeer(conn.peer));
    conn.on('error', () => this.dropPeer(conn.peer));
  }

  private handle(msg: Message, from: DataConnection): void {
    switch (msg.t) {
      case 'state':
        this.others.set(msg.s.id, msg.s);
        // The host is the only one everyone can hear, so it repeats
        if (this.role === 'host') this.relay(msg, from.peer);
        break;

      case 'chat':
        this.onChat?.(msg.name, msg.text);
        if (this.role === 'host') this.relay(msg, from.peer);
        break;

      case 'bye':
        this.others.delete(msg.id);
        this.onPeerLeft?.(msg.id);
        if (this.role === 'host') this.relay(msg, from.peer);
        break;

      case 'full':
        this.onError?.('Hra je plná — hrají už tři hráči.');
        break;

      case 'roster':
        break;
    }
  }

  private dropPeer(id: string): void {
    const state = [...this.others.values()].find((s) => s.id === id);
    this.conns.delete(id);
    if (state) this.others.delete(state.id);
    this.others.delete(id);
    this.onPeerLeft?.(id);
  }

  private broadcast(msg: Message): void {
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  private relay(msg: Message, exceptPeerId: string): void {
    for (const [id, conn] of this.conns) {
      if (id !== exceptPeerId && conn.open) conn.send(msg);
    }
  }
}

export { MAX_PLAYERS };
