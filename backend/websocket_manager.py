from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # maps a group_id to the list of open WebSocket connections for that group
        self.active_connections: dict[int, list[WebSocket]] = {}
    
    async def connect(self, websocket : WebSocket, group_id : int):
        await websocket.accept()
        self.active_connections.setdefault(group_id, []).append(websocket)
    
    def disconnect(self, websocket : WebSocket, group_id : int):
        if group_id in self.active_connections:
            if websocket in self.active_connections[group_id]:
                self.active_connections[group_id].remove(websocket)
    
    async def broadcast(self, group_id: int, message: dict):
        connections = self.active_connections.get(group_id, [])
        dead_connections = []

        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)

        # remove any connections that failed (clients that disconnected mid-send)
        for dead in dead_connections:
            self.disconnect(dead, group_id)
