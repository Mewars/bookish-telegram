"""Optional local TLS fixture: python tests/vk-bridge-browser.py (Playwright/Chromium/OpenSSL)."""
import asyncio, base64, hashlib, json, ssl, subprocess, tempfile, threading, urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlencode, urlparse
from playwright.async_api import async_playwright

ORIGIN='https://cptbmepnbzogqkfhflsg.supabase.co'
BASE=ORIGIN+'/functions/v1/vk-oauth-bridge'
CALLBACK=ORIGIN+'/auth/v1/callback'
async def main():
    relay=subprocess.Popen(['node','--loader','./tests/typescript-loader.mjs','tests/vk-bridge-browser-server.mjs'],stdout=subprocess.PIPE,text=True)
    server=None
    try:
        config=json.loads(relay.stdout.readline()); captured=[]; cookies=[]
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_GET(self):
                path=urlparse(self.path)
                if path.path=='/mock-vk/authorize':
                    params=parse_qs(path.query)
                    assert 'code_verifier' not in params and 'client_secret' not in params
                    location=f'https://127.0.0.1:{server.server_port}/functions/v1/vk-oauth-bridge/callback?'+urlencode({'state':params['state'][0],'code':'fixture-code','device_id':'fixture-device'})
                    self.send_response(302);self.send_header('Location',location);self.end_headers();return
                if path.path=='/auth/v1/callback':
                    captured.append(parse_qs(path.query));self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"fixture":"completed"}');return
                if path.path.endswith('/callback'):cookies.append(self.headers.get('Cookie',''))
                data=json.dumps({'url':ORIGIN+self.path,'method':'GET','headers':dict(self.headers),'body':None}).encode()
                result=json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{config["port"]}/relay',data=data,headers={'Content-Type':'application/json'})).read())
                self.send_response(result['status'])
                for key,value in result['headers'].items():
                    if key.lower()=='location':
                        value=value.replace('https://id.vk.com/authorize',f'https://localhost:{server.server_port}/mock-vk/authorize').replace(ORIGIN,f'https://127.0.0.1:{server.server_port}')
                    self.send_header(key,value)
                self.end_headers();self.wfile.write(result['body'].encode())
        with tempfile.TemporaryDirectory(prefix='vk-bridge-tls-') as temp:
            subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',temp+'/key.pem','-out',temp+'/cert.pem','-days','1','-subj','/CN=localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
            tls=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);tls.load_cert_chain(temp+'/cert.pem',temp+'/key.pem');server.socket=tls.wrap_socket(server.socket,server_side=True)
            threading.Thread(target=server.serve_forever,daemon=True).start()
            async with async_playwright() as p:
                browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
                for mobile in [False,True]:
                    context=await browser.new_context(ignore_https_errors=True,viewport={'width':390 if mobile else 1440,'height':844},is_mobile=mobile,has_touch=mobile)
                    page=await context.new_page();errors=[];requests=[]
                    page.on('pageerror',lambda error:errors.append(str(error)));page.on('request',lambda request:requests.append(request.url))
                    challenge=base64.urlsafe_b64encode(hashlib.sha256(b'v'*43).digest()).decode().rstrip('=')
                    url=f'https://127.0.0.1:{server.server_port}/functions/v1/vk-oauth-bridge/authorize?'+urlencode({'client_id':config['clientId'],'redirect_uri':CALLBACK,'response_type':'code','state':'supabase-state','code_challenge':challenge,'code_challenge_method':'S256','scope':'profile'})
                    await page.goto(url)
                    assert captured[-1]['state']==['supabase-state'] and len(captured[-1]['code'][0])==43,captured
                    assert cookies and '__Host-ryadom-vk-' in cookies[-1]
                    assert not await context.cookies(f'https://127.0.0.1:{server.server_port}'), 'callback must delete cookie'
                    assert all(urlparse(url).hostname in ['127.0.0.1','localhost'] for url in requests),requests
                    assert not errors,errors
                    await context.close()
                await browser.close()
            server.shutdown();server=None
        print('PASS: desktop/mobile cross-site top-level TLS redirects, Secure/HttpOnly/SameSite=Lax cookie binding and deletion; all traffic loopback; VK/Supabase mocked, no real session')
    finally:
        if server:server.shutdown()
        relay.terminate();relay.wait(timeout=10)
asyncio.run(main())
