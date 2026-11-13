#!/usr/bin/env python3
# One Drop dev server: like `python3 -m http.server` but never caches,
# so every reload (on Mac or phone) gets the newest files.
#
#   python3 serve.py            plain http on 8080
#   python3 serve.py --https    https on 8443, so the microphone works on the phone
#
# The microphone only works on a "secure origin". localhost counts; a plain
# http://192.168.x.x address does not. --https makes a self-signed certificate
# (stored in .cert/ beside this file) so the phone can record. Safari will warn
# that the certificate is not trusted: tap Show Details, then Visit This Website.
import http.server, socket, ssl, subprocess, sys, os

HTTPS = '--https' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('-')]
PORT = int(args[0]) if args else (8443 if HTTPS else 8080)
HERE = os.path.dirname(os.path.abspath(__file__))

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.m4a': 'audio/mp4', '.js': 'text/javascript'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, *a): pass

def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except Exception:
        return '127.0.0.1'

def make_cert():
    d = os.path.join(HERE, '.cert')
    os.makedirs(d, exist_ok=True)
    crt, key = os.path.join(d, 'cert.pem'), os.path.join(d, 'key.pem')
    if not (os.path.exists(crt) and os.path.exists(key)):
        ip = lan_ip()
        print('making a certificate for', ip, '...')
        subprocess.run([
            'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
            '-keyout', key, '-out', crt, '-subj', '/CN=One Drop',
            '-addext', f'subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost',
        ], check=True, capture_output=True)
    return crt, key

ip = lan_ip()
scheme = 'https' if HTTPS else 'http'
print(f'One Drop\n  Mac:    {scheme}://localhost:{PORT}\n  iPhone: {scheme}://{ip}:{PORT}')
if HTTPS:
    print('  (Safari will warn about the certificate once: Show Details > Visit This Website)')
else:
    print('  (the microphone needs --https to work on the phone)')
print('ctrl+c to stop')

os.chdir(HERE)
httpd = http.server.ThreadingHTTPServer(('', PORT), H)
if HTTPS:
    crt, key = make_cert()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(crt, key)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
