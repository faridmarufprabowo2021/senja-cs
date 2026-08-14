type WsLike = {
  readyState: number;
  send: (data: string) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};

type Client = {
  socket: WsLike;
  userId: string;
  tenantId: string;
};

class RealtimeHub {
  private clients = new Set<Client>();

  add(client: Client) {
    this.clients.add(client);
    client.socket.on("close", () => this.clients.delete(client));
  }

  toTenant(tenantId: string, event: string, data: unknown) {
    const payload = JSON.stringify({ event, data });
    for (const c of this.clients) {
      if (c.tenantId === tenantId && c.socket.readyState === 1) {
        c.socket.send(payload);
      }
    }
  }

  toUser(tenantId: string, userId: string, event: string, data: unknown) {
    const payload = JSON.stringify({ event, data });
    for (const c of this.clients) {
      if (
        c.tenantId === tenantId &&
        c.userId === userId &&
        c.socket.readyState === 1
      ) {
        c.socket.send(payload);
      }
    }
  }
}

export const hub = new RealtimeHub();
