import struct
from typing import Optional, Generator
from . import remotecontrolmessages_pb2 as pb

def pack_message(msg: pb.Message) -> bytes:
    """Pack a protobuf Message with a 4-byte big-endian length prefix."""
    payload = msg.SerializeToString()
    header = struct.pack('>I', len(payload))
    return header + payload

class AsyncMessageParser:
    """Incrementally parse length-prefixed protobuf messages from an async stream."""
    def __init__(self):
        self.buffer = bytearray()
        self.expected_length: Optional[int] = None

    def feed(self, chunk: bytes) -> Generator[pb.Message, None, None]:
        self.buffer.extend(chunk)

        while True:
            if self.expected_length is None:
                if len(self.buffer) < 4:
                    return
                self.expected_length = struct.unpack('>I', self.buffer[:4])[0]
                del self.buffer[:4]

            if len(self.buffer) < self.expected_length:
                return

            msg_bytes = bytes(self.buffer[:self.expected_length])
            del self.buffer[:self.expected_length]
            self.expected_length = None

            msg = pb.Message()
            msg.ParseFromString(msg_bytes)
            yield msg
