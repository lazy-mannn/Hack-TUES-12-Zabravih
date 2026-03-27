import socket

req = b"""POST /api/measurements/ HTTP/1.1\r\nHost: zabravih.org\r\nContent-Type: multipart/form-data; boundary=Esp32Boundary7b\r\nContent-Length: 0\r\nMac-Address: 11:22:33:44\r\nConnection: close\r\n\r\n"""
import ssl
context = ssl.create_default_context()
with socket.create_connection(('zabravih.org', 443)) as sock:
    with context.wrap_socket(sock, server_hostname='zabravih.org') as ssock:
        ssock.sendall(req)
        print(ssock.recv(1024))
