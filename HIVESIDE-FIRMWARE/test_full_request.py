import socket, ssl

boundary = "Esp32Boundary7b"
dataJson = '{"temperature": 25.5, "humidity": 50, "battery": 3.7}'

bodyStart = f"--{boundary}\r\n"
bodyStart += "Content-Disposition: form-data; name=\"data\"\r\n\r\n"
bodyStart += dataJson + "\r\n"
bodyStart += f"--{boundary}\r\n"
bodyStart += "Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n"
bodyStart += "Content-Type: audio/wav\r\n\r\n"

bodyEnd = f"\r\n--{boundary}--\r\n"

dataSize = 16000 * 1 * 2 * 10

contentLength = len(bodyStart) + 44 + dataSize + len(bodyEnd)
macAddress = "11:22:33:44"

req = f"POST /api/measurements/ HTTP/1.1\r\nHost: zabravih.org\r\nContent-Type: multipart/form-data; boundary={boundary}\r\nContent-Length: {contentLength}\r\nMac-Address: {macAddress}\r\nUser-Agent: ESP32\r\nConnection: close\r\n\r\n"
req = req.encode('utf-8')

# just sending zeroes for dataSize
dummy_audio = b'\x00' * dataSize
wav_header = b'RIFF\x00\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00'

context = ssl.create_default_context()
with socket.create_connection(('zabravih.org', 443)) as sock:
    with context.wrap_socket(sock, server_hostname='zabravih.org') as ssock:
        ssock.sendall(req + bodyStart.encode('utf-8') + wav_header + dummy_audio + bodyEnd.encode('utf-8'))
        
        while True:
            resp = ssock.recv(4096)
            if not resp: break
            print(resp)
