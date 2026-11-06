import socket
import struct
import sys

sys.path.insert(0, '/home/mert/clementine-web-remote/proto')
import remotecontrolmessages_pb2 as pb

def send_msg(sock, msg):
    payload = msg.SerializeToString()
    header = struct.pack('>I', len(payload))
    sock.sendall(header + payload)
    print(f"-> Sent message: type={pb.MsgType.Name(msg.type)} ({msg.type}), len={len(payload)}")

class ClementineReceiver:
    def __init__(self, sock):
        self.sock = sock
        self.buffer = bytearray()

    def recv_next(self):
        while len(self.buffer) < 4:
            chunk = self.sock.recv(65536)
            if not chunk:
                return None
            self.buffer.extend(chunk)

        msg_len = struct.unpack('>I', self.buffer[:4])[0]
        while len(self.buffer) < 4 + msg_len:
            chunk = self.sock.recv(65536)
            if not chunk:
                return None
            self.buffer.extend(chunk)

        msg_bytes = bytes(self.buffer[4:4 + msg_len])
        del self.buffer[:4 + msg_len]

        msg = pb.Message()
        msg.ParseFromString(msg_bytes)
        return msg

def main():
    host = '172.20.5.94'
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, 5500))
    print(f"Connected to Clementine on {host}:5500")

    receiver = ClementineReceiver(s)

    # Send CONNECT
    connect_msg = pb.Message()
    connect_msg.version = 23
    connect_msg.type = pb.CONNECT
    connect_msg.request_connect.auth_code = 77954
    connect_msg.request_connect.send_playlist_songs = True
    connect_msg.request_connect.downloader = False

    send_msg(s, connect_msg)

    # Receive handshake responses
    while True:
        msg = receiver.recv_next()
        if not msg:
            break
        type_name = pb.MsgType.Name(msg.type)
        print(f"<- Received: {type_name} ({msg.type})")
        if msg.type == pb.INFO:
            info = msg.response_clementine_info
            print(f"   Version: '{info.version}', State: {info.state}, ServerID: '{info.server_id}'")
        elif msg.type == pb.CURRENT_METAINFO:
            meta = msg.response_current_metadata.song_metadata
            art_len = len(meta.art) if meta.HasField('art') else 0
            print(f"   Current Song: title='{meta.title}', artist='{meta.artist}', album='{meta.album}', art_bytes={art_len}")
        elif msg.type == pb.PLAYLISTS:
            pl_resp = msg.response_playlists
            for p in pl_resp.playlist:
                print(f"   Playlist id={p.id}, name='{p.name}', items={p.item_count}, active={p.active}")
        elif msg.type == pb.PLAYLIST_SONGS:
            pl_songs = msg.response_playlist_songs
            req_pl = pl_songs.requested_playlist
            print(f"   Playlist songs for playlist id={req_pl.id}, total received={len(pl_songs.songs)}")
            for s_item in pl_songs.songs[:4]:
                print(f"     [{s_item.index}] {s_item.artist} - {s_item.title} ({s_item.length}s)")
        elif msg.type == pb.SET_VOLUME:
            print(f"   Volume: {msg.request_set_volume.volume}%")
        elif msg.type == pb.REPEAT:
            print(f"   Repeat Mode: {msg.repeat.repeat_mode}")
        elif msg.type == pb.SHUFFLE:
            print(f"   Shuffle Mode: {msg.shuffle.shuffle_mode}")
        elif msg.type == pb.FIRST_DATA_SENT_COMPLETE:
            print("   *** Handshake & initial sync complete! ***")
            break

    # Test playback control commands!
    print("\n--- Testing Playback Controls ---")
    # Test Volume
    vol_msg = pb.Message()
    vol_msg.version = 23
    vol_msg.type = pb.SET_VOLUME
    vol_msg.request_set_volume.volume = 75
    send_msg(s, vol_msg)

    # Listen for volume confirmation
    resp = receiver.recv_next()
    if resp and resp.type == pb.SET_VOLUME:
        print(f"<- Volume confirmation: {resp.request_set_volume.volume}%")

    s.close()
    print("\nLive protocol test completed successfully!")

if __name__ == '__main__':
    main()
