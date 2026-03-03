import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://127.0.0.1:3001/api/system/list-images', method='POST')
req.add_header('Content-Type', 'application/json')
data = json.dumps({'folderPaths': ['assets/gallery']}).encode('utf-8')

try:
    with urllib.request.urlopen(req, data=data, context=ctx) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(e)
